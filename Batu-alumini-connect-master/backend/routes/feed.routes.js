const express = require('express');
const db = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const { emitToUser, emitToRoom } = require('../config/socket');
const { cache } = require('../config/redis');
const { postLimiter } = require('../middleware/rateLimiter');
const { validate, schemas } = require('../middleware/validation');
const QueueService = require('../services/queue.service');
const logger = require('../config/logger');

const router = express.Router();

// Get feed posts with cursor-based pagination and ranking
router.get('/posts', authenticateUser, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const cursor = req.query.cursor; // timestamp-based cursor
    const userId = req.userId;

    // Try to get from cache first
    const cacheKey = `feed:${userId}:${cursor || 'initial'}:${limit}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      logger.info(`Feed cache hit for user ${userId}`);
      return res.json(cached);
    }

    let query = `
      SELECT 
        p.id,
        p.content,
        p.image_url,
        p.likes_count,
        p.comments_count,
        p.shares_count,
        p.engagement_score,
        p.is_trending,
        p.hashtags,
        p.created_at,
        p.updated_at,
        p.user_id as author_id,
        u.full_name as author_name,
        u.designation as author_title,
        u.company_name as author_company,
        u.profile_picture_url as author_picture,
        EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as is_liked,
        EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = $1) as is_saved
      FROM feed_posts p
      JOIN users u ON p.user_id = u.id
      WHERE u.status = 'approved' AND p.deleted_at IS NULL
    `;

    const params = [userId];

    // Cursor-based pagination
    if (cursor) {
      query += ` AND p.created_at < $2`;
      params.push(cursor);
    }

    // Feed ranking: Recent posts + engagement score
    query += `
      ORDER BY 
        p.is_pinned DESC,
        p.is_trending DESC,
        (EXTRACT(EPOCH FROM p.created_at) / 3600) + (p.engagement_score * 0.1) DESC,
        p.created_at DESC
      LIMIT $${params.length + 1}
    `;
    params.push(limit + 1); // Fetch one extra to check if there are more

    const result = await db.query(query, params);
    
    const hasMore = result.rows.length > limit;
    const posts = hasMore ? result.rows.slice(0, limit) : result.rows;

    const response = {
      posts,
      hasMore,
      nextCursor: hasMore ? posts[posts.length - 1].created_at : null
    };

    // Cache for 30 seconds
    await cache.set(cacheKey, response, 30);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching feed posts:', error);
    res.status(500).json({ error: 'Failed to fetch feed posts' });
  }
});

// Create post with hashtags and mentions
router.post('/posts', authenticateUser, postLimiter, validate(schemas.createPost), async (req, res) => {
  try {
    const { content, image_url, hashtags, mentions } = req.validatedBody;
    const userId = req.userId;

    // Insert post
    const result = await db.query(`
      INSERT INTO feed_posts (user_id, content, image_url, hashtags)
      VALUES ($1, $2, $3, $4)
      RETURNING 
        id, user_id, content, image_url, hashtags,
        likes_count, comments_count, shares_count,
        created_at, updated_at
    `, [userId, content, image_url, hashtags]);

    const post = result.rows[0];

    // Handle mentions
    if (mentions && mentions.length > 0) {
      for (const mentionedUserId of mentions) {
        await db.query(`
          INSERT INTO post_mentions (post_id, mentioned_user_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [post.id, mentionedUserId]);
      }
    }

    // Get author details
    const authorResult = await db.query(`
      SELECT full_name, designation, company_name, profile_picture_url
      FROM users WHERE id = $1
    `, [userId]);

    const author = authorResult.rows[0];
    post.author_name = author.full_name;
    post.author_title = author.designation;
    post.author_company = author.company_name;
    post.author_picture = author.profile_picture_url;

    // Invalidate feed cache
    await cache.delPattern(`feed:*`);

    // Emit real-time update to followers/connections
    emitToRoom('feed', 'post:new', post);

    // Queue background job to notify connections (followers)
    const connectionsResult = await db.query(`
      SELECT follower_id as connection_id FROM user_connections 
      WHERE following_id = $1 AND status = 'connected'
    `, [userId]);

    const connectionIds = connectionsResult.rows.map(row => row.connection_id);
    
    if (connectionIds.length > 0) {
      await QueueService.addNotificationJob('new_post', {
        postId: post.id,
        authorId: userId,
        connectionIds
      });
    }

    logger.info(`Post created: ${post.id} by user ${userId}`);

    res.status(201).json({
      message: 'Post created successfully',
      post
    });
  } catch (error) {
    logger.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Update post
router.put('/posts/:postId', authenticateUser, validate(schemas.updatePost), async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.validatedBody;
    const userId = req.userId;

    // Check ownership
    const ownerCheck = await db.query(`
      SELECT user_id FROM feed_posts WHERE id = $1 AND deleted_at IS NULL
    `, [postId]);

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (ownerCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to edit this post' });
    }

    // Update post
    const result = await db.query(`
      UPDATE feed_posts
      SET content = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING *
    `, [content, postId]);

    // Invalidate cache
    await cache.delPattern(`feed:*`);

    // Emit real-time update
    emitToRoom('feed', 'post:updated', result.rows[0]);

    res.json({
      message: 'Post updated successfully',
      post: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post (soft delete)
router.delete('/posts/:postId', authenticateUser, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    logger.info(`[DELETE-POST] User ${userId} attempting to delete post ${postId}`);

    // Check ownership
    const ownerCheck = await db.query(`
      SELECT user_id FROM feed_posts WHERE id = $1 AND deleted_at IS NULL
    `, [postId]);

    if (ownerCheck.rows.length === 0) {
      logger.warn(`[DELETE-POST] Post ${postId} not found`);
      return res.status(404).json({ error: 'Post not found' });
    }

    const postOwnerId = ownerCheck.rows[0].user_id;
    logger.info(`[DELETE-POST] Post belongs to user ${postOwnerId}, requester is ${userId}`);

    if (postOwnerId !== userId) {
      logger.warn(`[DELETE-POST] User ${userId} unauthorized to delete post ${postId} owned by ${postOwnerId}`);
      return res.status(403).json({ error: 'Unauthorized to delete this post' });
    }

    // Soft delete
    await db.query(`
      UPDATE feed_posts
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [postId]);

    logger.info(`[DELETE-POST] Post ${postId} successfully deleted by user ${userId}`);

    // Invalidate cache
    await cache.delPattern(`feed:*`);

    // Emit real-time update
    emitToRoom('feed', 'post:deleted', { postId });

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    logger.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});


// Like post
router.post('/posts/:postId/like', authenticateUser, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    // Check if already liked
    const existingLike = await db.query(`
      SELECT id FROM post_likes 
      WHERE post_id = $1 AND user_id = $2
    `, [postId, userId]);

    if (existingLike.rows.length > 0) {
      return res.status(400).json({ error: 'Already liked this post' });
    }

    // Add like
    await db.query(`
      INSERT INTO post_likes (post_id, user_id)
      VALUES ($1, $2)
    `, [postId, userId]);

    // Update likes count
    const result = await db.query(`
      UPDATE feed_posts 
      SET likes_count = likes_count + 1
      WHERE id = $1
      RETURNING user_id, likes_count
    `, [postId]);

    const post = result.rows[0];

    // Invalidate cache
    await cache.delPattern(`feed:*`);

    // Emit real-time update
    emitToRoom('feed', 'post:liked', {
      postId,
      userId,
      likesCount: post.likes_count
    });

    // Queue notification for post author
    if (post.user_id !== userId) {
      await QueueService.addNotificationJob('post_like', {
        postId,
        likerId: userId,
        postAuthorId: post.user_id
      });
    }

    // Update engagement score (background job)
    await QueueService.addFeedJob('update_engagement', { postId });

    res.json({ 
      message: 'Post liked successfully',
      likesCount: post.likes_count
    });
  } catch (error) {
    logger.error('Error liking post:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// Unlike post
router.post('/posts/:postId/unlike', authenticateUser, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    // Remove like
    await db.query(`
      DELETE FROM post_likes 
      WHERE post_id = $1 AND user_id = $2
    `, [postId, userId]);

    // Update likes count
    const result = await db.query(`
      UPDATE feed_posts 
      SET likes_count = GREATEST(likes_count - 1, 0)
      WHERE id = $1
      RETURNING likes_count
    `, [postId]);

    // Invalidate cache
    await cache.delPattern(`feed:*`);

    // Emit real-time update
    emitToRoom('feed', 'post:unliked', {
      postId,
      userId,
      likesCount: result.rows[0].likes_count
    });

    // Update engagement score
    await QueueService.addFeedJob('update_engagement', { postId });

    res.json({ 
      message: 'Like removed successfully',
      likesCount: result.rows[0].likes_count
    });
  } catch (error) {
    logger.error('Error unliking post:', error);
    res.status(500).json({ error: 'Failed to unlike post' });
  }
});

// Save post
router.post('/posts/:postId/save', authenticateUser, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    await db.query(`
      INSERT INTO saved_posts (user_id, post_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, post_id) DO NOTHING
    `, [userId, postId]);

    res.json({ message: 'Post saved successfully' });
  } catch (error) {
    logger.error('Error saving post:', error);
    res.status(500).json({ error: 'Failed to save post' });
  }
});

// Unsave post
router.post('/posts/:postId/unsave', authenticateUser, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    await db.query(`
      DELETE FROM saved_posts
      WHERE user_id = $1 AND post_id = $2
    `, [userId, postId]);

    res.json({ message: 'Post unsaved successfully' });
  } catch (error) {
    logger.error('Error unsaving post:', error);
    res.status(500).json({ error: 'Failed to unsave post' });
  }
});

// Get saved posts
router.get('/saved', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 20;
    const cursor = req.query.cursor;

    let query = `
      SELECT 
        p.id,
        p.content,
        p.image_url,
        p.likes_count,
        p.comments_count,
        p.shares_count,
        p.created_at,
        u.full_name as author_name,
        u.designation as author_title,
        u.company_name as author_company,
        u.profile_picture_url as author_picture,
        sp.created_at as saved_at,
        true as is_saved,
        EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as is_liked
      FROM saved_posts sp
      JOIN feed_posts p ON sp.post_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE sp.user_id = $1 AND p.deleted_at IS NULL
    `;

    const params = [userId];

    if (cursor) {
      query += ` AND sp.created_at < $2`;
      params.push(cursor);
    }

    query += ` ORDER BY sp.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1);

    const result = await db.query(query, params);
    
    const hasMore = result.rows.length > limit;
    const posts = hasMore ? result.rows.slice(0, limit) : result.rows;

    res.json({
      posts,
      hasMore,
      nextCursor: hasMore ? posts[posts.length - 1].saved_at : null
    });
  } catch (error) {
    logger.error('Error fetching saved posts:', error);
    res.status(500).json({ error: 'Failed to fetch saved posts' });
  }
});

// Share post
router.post('/posts/:postId/share', authenticateUser, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    // Record share
    await db.query(`
      INSERT INTO post_shares (post_id, user_id)
      VALUES ($1, $2)
    `, [postId, userId]);

    // Update share count
    const result = await db.query(`
      UPDATE feed_posts 
      SET shares_count = shares_count + 1
      WHERE id = $1
      RETURNING shares_count
    `, [postId]);

    // Invalidate cache
    await cache.delPattern(`feed:*`);

    // Emit real-time update
    emitToRoom('feed', 'post:shared', {
      postId,
      userId,
      sharesCount: result.rows[0].shares_count
    });

    // Update engagement score
    await QueueService.addFeedJob('update_engagement', { postId });

    res.json({ 
      message: 'Post shared successfully',
      sharesCount: result.rows[0].shares_count
    });
  } catch (error) {
    logger.error('Error sharing post:', error);
    res.status(500).json({ error: 'Failed to share post' });
  }
});


// Get post comments with pagination
router.get('/posts/:postId/comments', authenticateUser, async (req, res) => {
  try {
    const { postId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const cursor = req.query.cursor;

    let query = `
      SELECT 
        c.id,
        c.content,
        c.created_at,
        c.updated_at,
        c.user_id,
        u.full_name as author_name,
        u.designation as author_title,
        u.profile_picture_url as author_picture
      FROM post_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1 AND c.deleted_at IS NULL
    `;

    const params = [postId];

    if (cursor) {
      query += ` AND c.created_at < $2`;
      params.push(cursor);
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1);

    const result = await db.query(query, params);
    
    const hasMore = result.rows.length > limit;
    const comments = hasMore ? result.rows.slice(0, limit) : result.rows;

    res.json({ 
      comments,
      hasMore,
      nextCursor: hasMore ? comments[comments.length - 1].created_at : null
    });
  } catch (error) {
    logger.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Add comment
router.post('/posts/:postId/comments', authenticateUser, validate(schemas.comment), async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.validatedBody;
    const userId = req.userId;

    const result = await db.query(`
      INSERT INTO post_comments (post_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, content, created_at, user_id
    `, [postId, userId, content]);

    const comment = result.rows[0];

    // Update comments count and get post author
    const postResult = await db.query(`
      UPDATE feed_posts 
      SET comments_count = comments_count + 1
      WHERE id = $1
      RETURNING user_id, comments_count
    `, [postId]);

    const post = postResult.rows[0];

    // Get commenter details
    const userResult = await db.query(`
      SELECT full_name, designation, profile_picture_url
      FROM users WHERE id = $1
    `, [userId]);

    const user = userResult.rows[0];
    comment.author_name = user.full_name;
    comment.author_title = user.designation;
    comment.author_picture = user.profile_picture_url;

    // Invalidate cache
    await cache.delPattern(`feed:*`);

    // Emit real-time update
    emitToRoom('feed', 'post:commented', {
      postId,
      comment,
      commentsCount: post.comments_count
    });

    // Queue notification for post author
    if (post.user_id !== userId) {
      await QueueService.addNotificationJob('post_comment', {
        postId,
        commenterId: userId,
        postAuthorId: post.user_id,
        commentText: content
      });
    }

    // Update engagement score
    await QueueService.addFeedJob('update_engagement', { postId });

    res.status(201).json({
      message: 'Comment added successfully',
      comment,
      commentsCount: post.comments_count
    });
  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Delete comment
router.delete('/posts/:postId/comments/:commentId', authenticateUser, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.userId;

    // Check ownership
    const ownerCheck = await db.query(`
      SELECT user_id FROM post_comments 
      WHERE id = $1 AND post_id = $2 AND deleted_at IS NULL
    `, [commentId, postId]);

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (ownerCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this comment' });
    }

    // Soft delete comment
    await db.query(`
      UPDATE post_comments
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [commentId]);

    // Update comments count
    await db.query(`
      UPDATE feed_posts 
      SET comments_count = GREATEST(comments_count - 1, 0)
      WHERE id = $1
    `, [postId]);

    // Invalidate cache
    await cache.delPattern(`feed:*`);

    // Emit real-time update
    emitToRoom('feed', 'comment:deleted', { postId, commentId });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    logger.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Get posts by specific user
router.get('/user/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const cursor = req.query.cursor;

    let query = `
      SELECT 
        p.id,
        p.content,
        p.image_url,
        p.likes_count,
        p.comments_count,
        p.shares_count,
        p.hashtags,
        p.created_at,
        p.updated_at,
        u.full_name as author_name,
        u.designation as author_title,
        u.company_name as author_company,
        u.profile_picture_url as author_picture,
        EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as is_liked,
        EXISTS(SELECT 1 FROM saved_posts WHERE post_id = p.id AND user_id = $1) as is_saved
      FROM feed_posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = $2 AND u.status = 'approved' AND p.deleted_at IS NULL
    `;

    const params = [req.userId, userId];

    if (cursor) {
      query += ` AND p.created_at < $3`;
      params.push(cursor);
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1);

    const result = await db.query(query, params);
    
    const hasMore = result.rows.length > limit;
    const posts = hasMore ? result.rows.slice(0, limit) : result.rows;

    res.json({ 
      posts,
      hasMore,
      nextCursor: hasMore ? posts[posts.length - 1].created_at : null
    });
  } catch (error) {
    logger.error('Error fetching user posts:', error);
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

// Get trending posts
router.get('/trending', authenticateUser, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Try cache first
    const cacheKey = `feed:trending:${limit}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const result = await db.query(`
      SELECT 
        p.id,
        p.content,
        p.image_url,
        p.likes_count,
        p.comments_count,
        p.shares_count,
        p.engagement_score,
        p.created_at,
        u.full_name as author_name,
        u.designation as author_title,
        u.company_name as author_company,
        u.profile_picture_url as author_picture,
        EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) as is_liked
      FROM feed_posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_trending = true 
        AND p.deleted_at IS NULL
        AND p.created_at > NOW() - INTERVAL '48 hours'
      ORDER BY p.engagement_score DESC, p.created_at DESC
      LIMIT $2
    `, [req.userId, limit]);

    const response = { posts: result.rows };

    // Cache for 5 minutes
    await cache.set(cacheKey, response, 300);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching trending posts:', error);
    res.status(500).json({ error: 'Failed to fetch trending posts' });
  }
});

module.exports = router;

