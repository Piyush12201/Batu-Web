const express = require('express');
const db = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const { emitToUser } = require('../config/socket');
const { cache } = require('../config/redis');
const logger = require('../config/logger');

const router = express.Router();

// Create new opportunity
router.post('/create', authenticateUser, async (req, res) => {
  try {
    const { title, company_name, type, location, salary_range, experience_required, description, skills_required } = req.body;

    if (!title || !company_name || !type) {
      return res.status(400).json({ error: 'Title, company name, and type are required' });
    }

    const result = await db.query(`
      INSERT INTO opportunities (
        title, 
        company_name, 
        type, 
        location, 
        salary_range, 
        experience_required, 
        description, 
        skills_required, 
        posted_by_user_id,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *
    `, [
      title, 
      company_name, 
      type, 
      location || null, 
      salary_range || null, 
      experience_required || '', 
      description || '', 
      skills_required || [],
      req.userId
    ]);

    res.status(201).json({
      message: 'Opportunity posted successfully',
      opportunity: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating opportunity:', error);
    res.status(500).json({ error: 'Failed to create opportunity' });
  }
});

// Get all opportunities with filters
router.get('/list', authenticateUser, async (req, res) => {
  try {
    const { type, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        o.id,
        o.title,
        o.company_name,
        o.type,
        o.location,
        o.salary_range,
        o.experience_required,
        o.description,
        o.skills_required,
        o.created_at,
        EXISTS(SELECT 1 FROM bookmarks WHERE opportunity_id = o.id AND user_id = $1) as is_bookmarked,
        EXISTS(SELECT 1 FROM opportunity_applications WHERE opportunity_id = o.id AND user_id = $1) as is_applied
      FROM opportunities o
      WHERE o.is_active = true
    `;

    const params = [req.userId];

    if (type && type !== 'All') {
      params.push(type);
      query += ` AND o.type = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (o.title ILIKE $${params.length} OR o.company_name ILIKE $${params.length})`;
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    let countQuery = `
      SELECT COUNT(*) as total FROM opportunities o
      WHERE o.is_active = true
    `;

    const countParams = [];
    if (type && type !== 'All') {
      countParams.push(type);
      countQuery += ` AND o.type = $${countParams.length}`;
    }

    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND (o.title ILIKE $${countParams.length} OR o.company_name ILIKE $${countParams.length})`;
    }

    const countResult = await db.query(countQuery, countParams);

    res.json({
      opportunities: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

// Get single opportunity details
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT 
        o.*,
        EXISTS(SELECT 1 FROM bookmarks WHERE opportunity_id = o.id AND user_id = $1) as is_bookmarked,
        EXISTS(SELECT 1 FROM opportunity_applications WHERE opportunity_id = o.id AND user_id = $1) as has_applied
      FROM opportunities o
      WHERE o.id = $2 AND o.is_active = true
    `, [req.userId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    res.json({ opportunity: result.rows[0] });
  } catch (error) {
    console.error('Error fetching opportunity:', error);
    res.status(500).json({ error: 'Failed to fetch opportunity' });
  }
});

// Apply to opportunity
router.post('/:id/apply', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { cover_letter, resume_url } = req.body;

    // Check if already applied
    const existing = await db.query(`
      SELECT id FROM opportunity_applications
      WHERE opportunity_id = $1 AND user_id = $2
    `, [id, req.userId]);

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already applied to this opportunity' });
    }

    // Get opportunity details
    const opportunityResult = await db.query(`
      SELECT posted_by_user_id, title, company_name
      FROM opportunities
      WHERE id = $1
    `, [id]);

    if (opportunityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const opportunity = opportunityResult.rows[0];
    const posterUserId = opportunity.posted_by_user_id;

    // Get applicant details
    const applicantResult = await db.query(`
      SELECT full_name, company_name, designation
      FROM users
      WHERE id = $1
    `, [req.userId]);

    const applicant = applicantResult.rows[0];

    // Create application
    const result = await db.query(`
      INSERT INTO opportunity_applications (opportunity_id, user_id, cover_letter, resume_url)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id, req.userId, cover_letter || null, resume_url || null]);

    // Send automatic message to opportunity poster
    if (posterUserId && posterUserId !== req.userId) {
      const messageContent = `Hi! I've applied for the ${opportunity.title} position at ${opportunity.company_name}. Looking forward to discussing this opportunity with you.`;
      
      const messageResult = await db.query(`
        INSERT INTO messages (sender_id, receiver_id, content, status)
        VALUES ($1, $2, $3, 'sent')
        RETURNING id, sender_id, receiver_id, content, status, is_read, created_at
      `, [req.userId, posterUserId, messageContent]);

      const message = messageResult.rows[0];

      // Invalidate conversations cache for both users
      await cache.del(`conversations:${req.userId}:initial`);
      await cache.del(`conversations:${posterUserId}:initial`);

      // Increment unread message count in cache
      await cache.incr(`unread_messages:${posterUserId}`);

      // Emit real-time message to poster
      emitToUser(posterUserId, 'message:new', {
        ...message,
        sender_name: applicant.full_name,
        sender_company: applicant.company_name
      });

      // Emit unread count update
      const unreadResult = await db.query(`
        SELECT COUNT(*) as count 
        FROM messages 
        WHERE receiver_id = $1 AND is_read = false AND deleted_at IS NULL
      `, [posterUserId]);

      emitToUser(posterUserId, 'messages:unread_count', {
        count: parseInt(unreadResult.rows[0]?.count || 0)
      });

      logger.info(`Auto-message sent from ${req.userId} to ${posterUserId} for opportunity application`);
    }

    res.status(201).json({
      message: 'Application submitted successfully',
      application: result.rows[0]
    });
  } catch (error) {
    console.error('Error applying to opportunity:', error);
    logger.error('Error applying to opportunity:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Bookmark opportunity
router.post('/:id/bookmark', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if already bookmarked
    const existing = await db.query(`
      SELECT id FROM bookmarks
      WHERE opportunity_id = $1 AND user_id = $2
    `, [id, req.userId]);

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already bookmarked' });
    }

    await db.query(`
      INSERT INTO bookmarks (opportunity_id, user_id)
      VALUES ($1, $2)
    `, [id, req.userId]);

    res.json({ message: 'Opportunity bookmarked successfully' });
  } catch (error) {
    console.error('Error bookmarking opportunity:', error);
    res.status(500).json({ error: 'Failed to bookmark opportunity' });
  }
});

// Remove bookmark
router.post('/:id/unbookmark', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(`
      DELETE FROM bookmarks
      WHERE opportunity_id = $1 AND user_id = $2
    `, [id, req.userId]);

    res.json({ message: 'Bookmark removed successfully' });
  } catch (error) {
    console.error('Error removing bookmark:', error);
    res.status(500).json({ error: 'Failed to remove bookmark' });
  }
});

// Get bookmarked opportunities
router.get('/bookmarks/list', authenticateUser, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        o.id,
        o.title,
        o.company_name,
        o.type,
        o.location,
        o.salary_range,
        o.created_at,
        true as is_bookmarked
      FROM opportunities o
      JOIN bookmarks b ON o.id = b.opportunity_id
      WHERE b.user_id = $1 AND o.is_active = true
      ORDER BY b.created_at DESC
    `, [req.userId]);

    res.json({ bookmarks: result.rows });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
});

module.exports = router;
