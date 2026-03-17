const express = require('express');
const db = require('../config/database');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Get all help desk posts
router.get('/posts', authenticateUser, async (req, res) => {
  try {
    const { category, is_asking, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        h.id,
        h.user_id,
        h.category,
        h.title,
        h.description,
        h.status,
        h.is_asking,
        h.responses_count,
        h.created_at,
        u.full_name as author_name,
        u.designation as author_title
      FROM help_desk_posts h
      JOIN users u ON h.user_id = u.id
      WHERE u.status = 'approved'
    `;

    const params = [];

    if (category) {
      params.push(category);
      query += ` AND h.category = $${params.length}`;
    }

    if (is_asking !== undefined) {
      params.push(is_asking === 'true');
      query += ` AND h.is_asking = $${params.length}`;
    }

    query += ` ORDER BY h.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    const countQuery = `
      SELECT COUNT(*) as total FROM help_desk_posts h
      JOIN users u ON h.user_id = u.id
      WHERE u.status = 'approved'
      ${category ? `AND h.category = $1` : ''}
      ${is_asking !== undefined ? `AND h.is_asking = $${category ? 2 : 1}` : ''}
    `;

    const countParams = [];
    if (category) countParams.push(category);
    if (is_asking !== undefined) countParams.push(is_asking === 'true');

    const countResult = await db.query(countQuery, countParams);

    res.json({
      posts: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error fetching help desk posts:', error);
    res.status(500).json({ error: 'Failed to fetch help desk posts' });
  }
});

// Get single post with responses
router.get('/posts/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    const postResult = await db.query(`
      SELECT 
        h.id,
        h.user_id,
        h.category,
        h.title,
        h.description,
        h.status,
        h.is_asking,
        h.responses_count,
        h.created_at,
        u.full_name as author_name,
        u.designation as author_title,
        u.company_name as author_company
      FROM help_desk_posts h
      JOIN users u ON h.user_id = u.id
      WHERE h.id = $1
    `, [id]);

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const responsesResult = await db.query(`
      SELECT 
        r.id,
        r.content,
        r.is_solution_accepted,
        r.created_at,
        u.full_name as author_name,
        u.designation as author_title
      FROM help_desk_responses r
      JOIN users u ON r.user_id = u.id
      WHERE r.post_id = $1
      ORDER BY r.created_at DESC
    `, [id]);

    res.json({
      post: postResult.rows[0],
      responses: responsesResult.rows
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Create help desk post
router.post('/posts', authenticateUser, async (req, res) => {
  try {
    const { category, title, description, is_asking } = req.body;

    if (!category || !title || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(`
      INSERT INTO help_desk_posts (user_id, category, title, description, is_asking)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.userId, category, title, description, is_asking]);

    res.status(201).json({
      message: 'Post created successfully',
      post: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Add response to post
router.post('/posts/:id/respond', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Response content is required' });
    }

    const result = await db.query(`
      INSERT INTO help_desk_responses (post_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [id, req.userId, content]);

    // Update responses count
    await db.query(`
      UPDATE help_desk_posts 
      SET responses_count = responses_count + 1
      WHERE id = $1
    `, [id]);

    res.status(201).json({
      message: 'Response added successfully',
      response: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding response:', error);
    res.status(500).json({ error: 'Failed to add response' });
  }
});

// Mark response as solution
router.post('/responses/:id/mark-solution', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify user owns the post
    const responseResult = await db.query(`
      SELECT post_id FROM help_desk_responses WHERE id = $1
    `, [id]);

    if (responseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Response not found' });
    }

    const postId = responseResult.rows[0].post_id;

    const postResult = await db.query(`
      SELECT user_id FROM help_desk_posts WHERE id = $1
    `, [postId]);

    if (postResult.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Mark as solution
    await db.query(`
      UPDATE help_desk_responses 
      SET is_solution_accepted = true
      WHERE id = $1
    `, [id]);

    // Update post status to resolved
    await db.query(`
      UPDATE help_desk_posts 
      SET status = 'resolved'
      WHERE id = $1
    `, [postId]);

    res.json({ message: 'Marked as solution' });
  } catch (error) {
    console.error('Error marking solution:', error);
    res.status(500).json({ error: 'Failed to mark as solution' });
  }
});

// Close post
router.post('/posts/:id/close', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    const postResult = await db.query(`
      SELECT user_id FROM help_desk_posts WHERE id = $1
    `, [id]);

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (postResult.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.query(`
      UPDATE help_desk_posts 
      SET status = 'closed'
      WHERE id = $1
    `, [id]);

    res.json({ message: 'Post closed successfully' });
  } catch (error) {
    console.error('Error closing post:', error);
    res.status(500).json({ error: 'Failed to close post' });
  }
});

module.exports = router;
