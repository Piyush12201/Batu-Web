const Queue = require('bull');
const logger = require('../config/logger');
const NotificationService = require('./notification.service');
const db = require('../config/database');

// Create queues
const notificationQueue = new Queue('notifications', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  }
});

const emailQueue = new Queue('emails', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  }
});

const feedQueue = new Queue('feed', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  }
});

// Process notification queue
notificationQueue.process(async (job) => {
  const { type, data } = job.data;
  logger.info(`Processing notification job: ${type}`, data);

  try {
    switch (type) {
      case 'post_like':
        await NotificationService.notifyPostLike(
          data.postId,
          data.likerId,
          data.postAuthorId
        );
        break;

      case 'post_comment':
        await NotificationService.notifyPostComment(
          data.postId,
          data.commenterId,
          data.postAuthorId,
          data.commentText
        );
        break;

      case 'connection':
        await NotificationService.notifyConnection(
          data.userId,
          data.connectorId
        );
        break;

      case 'message':
        await NotificationService.notifyMessage(
          data.receiverId,
          data.senderId,
          data.messagePreview
        );
        break;

      case 'new_post':
        await NotificationService.notifyNewPost(
          data.postId,
          data.authorId,
          data.connectionIds
        );
        break;

      case 'new_opportunity':
        await NotificationService.notifyNewOpportunity(
          data.opportunityId,
          data.posterId
        );
        break;

      default:
        logger.warn(`Unknown notification type: ${type}`);
    }

    return { success: true };
  } catch (error) {
    logger.error(`Error processing notification job:`, error);
    throw error;
  }
});

// Process feed update queue
feedQueue.process(async (job) => {
  const { type, data } = job.data;
  logger.info(`Processing feed job: ${type}`, data);

  try {
    switch (type) {
      case 'update_engagement':
        // Update engagement scores for feed ranking
        await db.query(`
          UPDATE feed_posts
          SET engagement_score = (
            likes_count * 2 + 
            comments_count * 3 + 
            shares_count * 5
          )
          WHERE id = $1
        `, [data.postId]);
        break;

      case 'update_trending':
        // Update trending posts (posts with high engagement in last 24 hours)
        await db.query(`
          UPDATE feed_posts
          SET is_trending = (
            engagement_score > 10 AND
            created_at > NOW() - INTERVAL '24 hours'
          )
          WHERE created_at > NOW() - INTERVAL '48 hours'
        `);
        break;

      default:
        logger.warn(`Unknown feed job type: ${type}`);
    }

    return { success: true };
  } catch (error) {
    logger.error(`Error processing feed job:`, error);
    throw error;
  }
});

// Email queue processor (placeholder for future email implementation)
emailQueue.process(async (job) => {
  const { type, data } = job.data;
  logger.info(`Processing email job: ${type}`, data);

  // TODO: Implement email sending logic
  // Can use services like SendGrid, AWS SES, or Nodemailer

  return { success: true };
});

// Queue event handlers
const setupQueueEvents = (queue, queueName) => {
  queue.on('completed', (job) => {
    logger.info(`${queueName} job completed:`, job.id);
  });

  queue.on('failed', (job, err) => {
    logger.error(`${queueName} job failed:`, job.id, err);
  });

  queue.on('stalled', (job) => {
    logger.warn(`${queueName} job stalled:`, job.id);
  });
};

setupQueueEvents(notificationQueue, 'Notification');
setupQueueEvents(emailQueue, 'Email');
setupQueueEvents(feedQueue, 'Feed');

// Queue helper functions
const QueueService = {
  // Add notification job
  async addNotificationJob(type, data, options = {}) {
    return await notificationQueue.add(
      { type, data },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        ...options
      }
    );
  },

  // Add email job
  async addEmailJob(type, data, options = {}) {
    return await emailQueue.add(
      { type, data },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        ...options
      }
    );
  },

  // Add feed job
  async addFeedJob(type, data, options = {}) {
    return await feedQueue.add(
      { type, data },
      {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 3000
        },
        ...options
      }
    );
  },

  // Get queue stats
  async getQueueStats(queueName) {
    const queue = queueName === 'notifications' ? notificationQueue :
                  queueName === 'emails' ? emailQueue :
                  feedQueue;

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount()
    ]);

    return { waiting, active, completed, failed };
  }
};

module.exports = QueueService;
