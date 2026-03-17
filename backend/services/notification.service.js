const db = require('../config/database');
const { emitToUser } = require('../config/socket');
const { cache } = require('../config/redis');
const logger = require('../config/logger');

class NotificationService {
  // Notification types
  static TYPES = {
    LIKE: 'like',
    COMMENT: 'comment',
    CONNECTION: 'connection',
    MESSAGE: 'message',
    POST: 'post',
    OPPORTUNITY: 'opportunity',
    JOB_APPLICATION: 'job_application',
    MENTION: 'mention'
  };

  /**
   * Create and send notification
   */
  static async create({
    userId,
    actorId,
    type,
    title,
    message,
    relatedId = null,
    relatedType = null,
    actionUrl = null
  }) {
    try {
      // Don't send notification to self
      if (userId === actorId) {
        return null;
      }

      // Insert notification into database
      const result = await db.query(`
        INSERT INTO notifications (
          user_id, actor_id, type, title, message, 
          related_id, related_type, action_url, is_read
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
        RETURNING 
          id, user_id, actor_id, type, title, message,
          related_id, related_type, action_url, is_read, created_at
      `, [userId, actorId, type, title, message, relatedId, relatedType, actionUrl]);

      const notification = result.rows[0];

      // Get actor details
      const actorResult = await db.query(`
        SELECT id, full_name, profile_picture_url
        FROM users WHERE id = $1
      `, [actorId]);

      const actor = actorResult.rows[0];
      notification.actor = actor;

      // Increment unread count in Redis
      const unreadKey = `notifications:unread:${userId}`;
      await cache.incr(unreadKey);
      await cache.expire(unreadKey, 86400); // 24 hours

      // Emit real-time notification via Socket.IO
      emitToUser(userId, 'notification:new', notification);

      logger.info(`Notification created: ${type} for user ${userId} by ${actorId}`);
      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Create notification for post like
   */
  static async notifyPostLike(postId, likerId, postAuthorId) {
    try {
      const postResult = await db.query(`
        SELECT content FROM feed_posts WHERE id = $1
      `, [postId]);

      const post = postResult.rows[0];
      const preview = post.content.substring(0, 50) + (post.content.length > 50 ? '...' : '');

      return await this.create({
        userId: postAuthorId,
        actorId: likerId,
        type: this.TYPES.LIKE,
        title: 'New Like',
        message: `liked your post: "${preview}"`,
        relatedId: postId,
        relatedType: 'post',
        actionUrl: `/feed/post/${postId}`
      });
    } catch (error) {
      logger.error('Error notifying post like:', error);
    }
  }

  /**
   * Create notification for post comment
   */
  static async notifyPostComment(postId, commenterId, postAuthorId, commentText) {
    try {
      const preview = commentText.substring(0, 50) + (commentText.length > 50 ? '...' : '');

      return await this.create({
        userId: postAuthorId,
        actorId: commenterId,
        type: this.TYPES.COMMENT,
        title: 'New Comment',
        message: `commented: "${preview}"`,
        relatedId: postId,
        relatedType: 'post',
        actionUrl: `/feed/post/${postId}`
      });
    } catch (error) {
      logger.error('Error notifying post comment:', error);
    }
  }

  /**
   * Create notification for new connection
   */
  static async notifyConnection(userId, connectorId) {
    try {
      return await this.create({
        userId,
        actorId: connectorId,
        type: this.TYPES.CONNECTION,
        title: 'New Connection',
        message: 'connected with you',
        relatedId: connectorId,
        relatedType: 'user',
        actionUrl: `/profile/${connectorId}`
      });
    } catch (error) {
      logger.error('Error notifying connection:', error);
    }
  }

  /**
   * Create notification for new message
   */
  static async notifyMessage(receiverId, senderId, messagePreview) {
    try {
      const preview = messagePreview.substring(0, 50) + (messagePreview.length > 50 ? '...' : '');

      return await this.create({
        userId: receiverId,
        actorId: senderId,
        type: this.TYPES.MESSAGE,
        title: 'New Message',
        message: `sent you a message: "${preview}"`,
        relatedId: senderId,
        relatedType: 'conversation',
        actionUrl: `/messages/${senderId}`
      });
    } catch (error) {
      logger.error('Error notifying message:', error);
    }
  }

  /**
   * Create notification for new post from connection
   */
  static async notifyNewPost(postId, authorId, connectionIds) {
    try {
      const postResult = await db.query(`
        SELECT content FROM feed_posts WHERE id = $1
      `, [postId]);

      const post = postResult.rows[0];
      const preview = post.content.substring(0, 50) + (post.content.length > 50 ? '...' : '');

      // Notify all connections
      for (const userId of connectionIds) {
        await this.create({
          userId,
          actorId: authorId,
          type: this.TYPES.POST,
          title: 'New Post',
          message: `posted: "${preview}"`,
          relatedId: postId,
          relatedType: 'post',
          actionUrl: `/feed/post/${postId}`
        });
      }
    } catch (error) {
      logger.error('Error notifying new post:', error);
    }
  }

  /**
   * Create notification for new opportunity
   */
  static async notifyNewOpportunity(opportunityId, posterId) {
    try {
      const oppResult = await db.query(`
        SELECT title FROM opportunities WHERE id = $1
      `, [opportunityId]);

      const opportunity = oppResult.rows[0];

      // Get all approved users (broadcast to everyone)
      const usersResult = await db.query(`
        SELECT id FROM users WHERE status = 'approved' AND id != $1
      `, [posterId]);

      // Notify in batches to avoid overwhelming
      for (const user of usersResult.rows) {
        await this.create({
          userId: user.id,
          actorId: posterId,
          type: this.TYPES.OPPORTUNITY,
          title: 'New Opportunity',
          message: `posted: "${opportunity.title}"`,
          relatedId: opportunityId,
          relatedType: 'opportunity',
          actionUrl: `/opportunities/${opportunityId}`
        });
      }
    } catch (error) {
      logger.error('Error notifying new opportunity:', error);
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    try {
      await db.query(`
        UPDATE notifications 
        SET is_read = true, read_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2
      `, [notificationId, userId]);

      // Decrement unread count
      const unreadKey = `notifications:unread:${userId}`;
      const current = await cache.get(unreadKey);
      if (current && current > 0) {
        await cache.set(unreadKey, current - 1, 86400);
      }

      return true;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId) {
    try {
      await db.query(`
        UPDATE notifications 
        SET is_read = true, read_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND is_read = false
      `, [userId]);

      // Reset unread count
      const unreadKey = `notifications:unread:${userId}`;
      await cache.del(unreadKey);

      return true;
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get unread count
   */
  static async getUnreadCount(userId) {
    try {
      const unreadKey = `notifications:unread:${userId}`;
      let count = await cache.get(unreadKey);

      // If not in cache, fetch from database
      if (count === null) {
        const result = await db.query(`
          SELECT COUNT(*) as count
          FROM notifications
          WHERE user_id = $1 AND is_read = false
        `, [userId]);

        count = parseInt(result.rows[0].count);
        await cache.set(unreadKey, count, 86400);
      }

      return count;
    } catch (error) {
      logger.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Delete notification
   */
  static async delete(notificationId, userId) {
    try {
      const result = await db.query(`
        DELETE FROM notifications
        WHERE id = $1 AND user_id = $2
        RETURNING is_read
      `, [notificationId, userId]);

      if (result.rows.length > 0 && !result.rows[0].is_read) {
        // Decrement unread count if it was unread
        const unreadKey = `notifications:unread:${userId}`;
        const current = await cache.get(unreadKey);
        if (current && current > 0) {
          await cache.set(unreadKey, current - 1, 86400);
        }
      }

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error deleting notification:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
