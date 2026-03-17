const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const NotificationService = require('../services/notification.service');
const logger = require('../config/logger');

// Get user notifications with pagination
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 20;
    const cursor = req.query.cursor; // timestamp-based cursor

    let query = `
      SELECT 
        n.id,
        n.type,
        n.title,
        n.message,
        n.related_id,
        n.related_type,
        n.action_url,
        n.is_read,
        n.read_at,
        n.created_at,
        u.id as actor_id,
        u.full_name as actor_name,
        u.profile_picture_url as actor_picture
      FROM notifications n
      LEFT JOIN users u ON n.actor_id = u.id
      WHERE n.user_id = $1
    `;

    const params = [userId];

    // Cursor-based pagination
    if (cursor) {
      query += ` AND n.created_at < $2`;
      params.push(cursor);
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1); // Fetch one extra to determine if there are more

    const result = await db.query(query, params);
    
    const hasMore = result.rows.length > limit;
    const notifications = hasMore ? result.rows.slice(0, limit) : result.rows;

    // Get unread count
    const unreadCount = await NotificationService.getUnreadCount(userId);

    res.json({
      notifications,
      unreadCount,
      hasMore,
      nextCursor: hasMore ? notifications[notifications.length - 1].created_at : null
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get unread count
router.get('/unread-count', authenticateUser, async (req, res) => {
  try {
    const count = await NotificationService.getUnreadCount(req.userId);
    res.json({ count });
  } catch (error) {
    logger.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Mark notification as read
router.put('/:notificationId/read', authenticateUser, async (req, res) => {
  try {
    const { notificationId } = req.params;
    await NotificationService.markAsRead(notificationId, req.userId);
    
    // Get updated unread count
    const unreadCount = await NotificationService.getUnreadCount(req.userId);
    
    res.json({ 
      message: 'Notification marked as read',
      unreadCount
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all as read
router.put('/read-all', authenticateUser, async (req, res) => {
  try {
    await NotificationService.markAllAsRead(req.userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/:notificationId', authenticateUser, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const deleted = await NotificationService.delete(notificationId, req.userId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
