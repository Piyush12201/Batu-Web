const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const { emitToUser } = require('../config/socket');
const { cache } = require('../config/redis');
const { messageLimiter } = require('../middleware/rateLimiter');
const { validate, schemas } = require('../middleware/validation');
const QueueService = require('../services/queue.service');
const logger = require('../config/logger');

// Get all conversations for current user with cursor pagination
router.get('/conversations', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 20;
    const cursor = req.query.cursor;

    // Try cache first
    const cacheKey = `conversations:${userId}:${cursor || 'initial'}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    let query = `
      SELECT DISTINCT 
        u.id,
        u.full_name,
        u.company_name,
        u.designation,
        u.profile_picture_url,
        (SELECT content FROM messages 
         WHERE ((sender_id = $1 AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = $1))
           AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT image_url FROM messages 
         WHERE ((sender_id = $1 AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = $1))
           AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1) as last_message_image,
        (SELECT created_at FROM messages 
         WHERE ((sender_id = $1 AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = $1))
           AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM messages 
         WHERE sender_id = u.id AND receiver_id = $1 AND is_read = false AND deleted_at IS NULL) as unread_count
      FROM users u
      WHERE u.id != $1 AND EXISTS (
        SELECT 1 FROM messages 
        WHERE ((sender_id = u.id AND receiver_id = $1) OR (sender_id = $1 AND receiver_id = u.id))
          AND deleted_at IS NULL
      )
    `;

    const params = [userId];

    if (cursor) {
      query += ` AND last_message_time < $2`;
      params.push(cursor);
    }

    query += ` ORDER BY last_message_time DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1);

    const result = await db.query(query, params);

    const hasMore = result.rows.length > limit;
    const conversations = hasMore ? result.rows.slice(0, limit) : result.rows;

    const response = {
      conversations,
      hasMore,
      nextCursor: hasMore ? conversations[conversations.length - 1].last_message_time : null
    };

    // Cache for 10 seconds
    await cache.set(cacheKey, response, 10);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages between two users with cursor pagination
router.get('/with/:userId', authenticateUser, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const otherUserId = req.params.userId;
    const limit = parseInt(req.query.limit) || 50;
    const cursor = req.query.cursor;

    let query = `
      SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        m.content,
        m.image_url,
        m.status,
        m.is_read,
        m.read_at,
        m.delivered_at,
        m.created_at,
        m.updated_at,
        u.full_name as sender_name,
        u.company_name as sender_company,
        u.profile_picture_url as sender_picture
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.deleted_at IS NULL AND (
        (m.sender_id = $1 AND m.receiver_id = $2) OR
        (m.sender_id = $2 AND m.receiver_id = $1)
      )
    `;

    const params = [currentUserId, otherUserId];

    if (cursor) {
      query += ` AND m.created_at < $3`;
      params.push(cursor);
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1);

    const result = await db.query(query, params);

    const hasMore = result.rows.length > limit;
    const messages = hasMore ? result.rows.slice(0, limit) : result.rows;

    // Mark unread messages as delivered and read
    await db.query(`
      UPDATE messages 
      SET 
        is_read = true,
        read_at = CURRENT_TIMESTAMP,
        status = 'read',
        delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
      WHERE receiver_id = $1 
        AND sender_id = $2 
        AND is_read = false
        AND deleted_at IS NULL
      RETURNING id
    `, [currentUserId, otherUserId]);

    // Invalidate conversations cache
    await cache.del(`conversations:${currentUserId}:initial`);
    await cache.del(`conversations:${otherUserId}:initial`);

    // Emit read receipt to sender
    const readMessageIds = result.rows
      .filter(m => m.sender_id === otherUserId && !m.is_read)
      .map(m => m.id);

    if (readMessageIds.length > 0) {
      emitToUser(otherUserId, 'messages:read', {
        userId: currentUserId,
        messageIds: readMessageIds
      });
    }

    res.json({
      messages: messages.reverse(), // Return in chronological order
      hasMore,
      nextCursor: hasMore ? messages[messages.length - 1].created_at : null
    });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message with real-time delivery
router.post('/send', authenticateUser, messageLimiter, validate(schemas.sendMessage), async (req, res) => {
  try {
    const { receiver_id, content, image_url } = req.validatedBody;
    const sender_id = req.userId;

    const result = await db.query(`
      INSERT INTO messages (sender_id, receiver_id, content, image_url, status)
      VALUES ($1, $2, $3, $4, 'sent')
      RETURNING 
        id, sender_id, receiver_id, content, image_url, 
        status, is_read, created_at
    `, [sender_id, receiver_id, content, image_url]);

    const message = result.rows[0];

    // Get sender details
    const senderResult = await db.query(`
      SELECT full_name, company_name, profile_picture_url
      FROM users WHERE id = $1
    `, [sender_id]);

    const sender = senderResult.rows[0];
    message.sender_name = sender.full_name;
    message.sender_company = sender.company_name;
    message.sender_picture = sender.profile_picture_url;

    // Invalidate conversations cache
    await cache.delPattern(`conversations:${sender_id}:*`);
    await cache.delPattern(`conversations:${receiver_id}:*`);

    // Emit real-time message to receiver
    emitToUser(receiver_id, 'message:new', message);

    // Update message status to delivered if user is online
    const { isUserOnline } = require('../config/socket');
    const isOnline = await isUserOnline(receiver_id);

    if (isOnline) {
      await db.query(`
        UPDATE messages
        SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [message.id]);

      message.status = 'delivered';
      message.delivered_at = new Date();

      // Emit delivery receipt to sender
      emitToUser(sender_id, 'message:delivered', {
        messageId: message.id,
        receiverId: receiver_id
      });
    }

    // Queue notification
    await QueueService.addNotificationJob('message', {
      receiverId: receiver_id,
      senderId: sender_id,
      messagePreview: content || '[Image]'
    });

    logger.info(`Message sent: ${message.id} from ${sender_id} to ${receiver_id}`);

    res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});


// Get unread messages count
router.get('/unread/count', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;

    // Try cache first
    const cacheKey = `messages:unread:${userId}`;
    const cached = await cache.get(cacheKey);
    
    if (cached !== null) {
      return res.json({ unread_count: cached });
    }

    const result = await db.query(`
      SELECT COUNT(*) as unread_count
      FROM messages
      WHERE receiver_id = $1 AND is_read = false AND deleted_at IS NULL
    `, [userId]);

    const count = parseInt(result.rows[0].unread_count);

    // Cache for 30 seconds
    await cache.set(cacheKey, count, 30);

    res.json({ unread_count: count });
  } catch (error) {
    logger.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Mark message as read
router.put('/:messageId/read', authenticateUser, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const result = await db.query(`
      UPDATE messages 
      SET 
        is_read = true,
        read_at = CURRENT_TIMESTAMP,
        status = 'read'
      WHERE id = $1 AND receiver_id = $2 AND deleted_at IS NULL
      RETURNING id, sender_id
    `, [messageId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = result.rows[0];

    // Invalidate cache
    await cache.del(`messages:unread:${userId}`);

    // Emit read receipt to sender
    emitToUser(message.sender_id, 'message:read', {
      messageId,
      userId
    });

    res.json({ success: true, message: 'Message marked as read' });
  } catch (error) {
    logger.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// Delete message (soft delete)
router.delete('/:messageId', authenticateUser, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const result = await db.query(`
      UPDATE messages
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL
      RETURNING receiver_id
    `, [messageId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or already deleted' });
    }

    // Invalidate cache
    await cache.delPattern(`conversations:${userId}:*`);
    await cache.delPattern(`conversations:${result.rows[0].receiver_id}:*`);

    // Emit deletion event (optional, for real-time UI update)
    emitToUser(result.rows[0].receiver_id, 'message:deleted', { messageId });

    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    logger.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Create or get conversation with a user
router.post('/conversations/create', authenticateUser, async (req, res) => {
  try {
    const { participant_id } = req.body;
    const userId = req.userId;

    if (!participant_id) {
      return res.status(400).json({ error: 'participant_id is required' });
    }

    // Check if user exists
    const userCheck = await db.query(`
      SELECT id FROM users WHERE id = $1
    `, [participant_id]);

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return conversation indicator (just the participant ID for now)
    // Real conversation is created when first message is sent
    res.json({ 
      conversation_id: `${userId}_${participant_id}`,
      participant_id 
    });
  } catch (error) {
    logger.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get connected users for messaging
router.get('/connected-users', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;

    // Try cache first
    const cacheKey = `connected_users:${userId}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json({ users: cached });
    }

    const result = await db.query(`
      SELECT DISTINCT 
        u.id, 
        u.full_name, 
        u.company_name, 
        u.designation,
        u.profile_picture_url
      FROM users u
      INNER JOIN user_connections uc ON 
        (uc.follower_id = $1 AND uc.following_id = u.id) OR
        (uc.following_id = $1 AND uc.follower_id = u.id)
      WHERE u.id != $1 AND u.status = 'approved'
      ORDER BY u.full_name
    `, [userId]);

    // Cache for 5 minutes
    await cache.set(cacheKey, result.rows, 300);

    res.json({ users: result.rows });
  } catch (error) {
    logger.error('Error fetching connected users:', error);
    res.status(500).json({ error: 'Failed to fetch connected users' });
  }
});

// Search users for messaging
router.get('/search-users', authenticateUser, async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.userId;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const result = await db.query(`
      SELECT 
        id,
        full_name,
        company_name,
        designation,
        profile_picture_url
      FROM users
      WHERE id != $1 
        AND status = 'approved'
        AND (
          full_name ILIKE $2 OR
          company_name ILIKE $2 OR
          designation ILIKE $2
        )
      ORDER BY full_name
      LIMIT 20
    `, [userId, `%${query}%`]);

    res.json({ users: result.rows });
  } catch (error) {
    logger.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

module.exports = router;

