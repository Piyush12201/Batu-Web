const express = require('express');
const db = require('../config/database');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Get all approved users (for network discovery)
router.get('/all', authenticateUser, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(`
      SELECT 
        u.id,
        u.full_name,
        u.email,
        u.designation,
        u.company_name,
        u.branch,
        u.years_of_experience,
        u.skills,
        u.linkedin_profile,
        u.current_city,
        EXISTS(SELECT 1 FROM user_connections WHERE follower_id = $1 AND following_id = u.id) as is_connected
      FROM users u
      WHERE u.status = 'approved'
        AND u.id != $1
      ORDER BY u.full_name
      LIMIT $2 OFFSET $3
    `, [req.userId, limit, offset]);

    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM users u
      WHERE u.status = 'approved' AND u.id != $1
    `, [req.userId]);

    res.json({
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Search users
router.get('/search', authenticateUser, async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Allow empty query - return all users
    let searchPattern = query ? `%${query}%` : null;

    const baseQuery = `
      SELECT 
        u.id,
        u.full_name,
        u.email,
        u.designation,
        u.company_name,
        u.branch,
        u.years_of_experience,
        u.skills,
        u.linkedin_profile,
        u.current_city,
        EXISTS(SELECT 1 FROM user_connections WHERE follower_id = $1 AND following_id = u.id) as is_connected
      FROM users u
      WHERE u.status = 'approved'
        AND u.id != $1
    `;

    const baseCountQuery = `
      SELECT COUNT(*) as total FROM users u
      WHERE u.status = 'approved' AND u.id != $1
    `;

    let params = [req.userId];
    let countParams = [req.userId];

    if (searchPattern) {
      params.push(searchPattern);
      countParams.push(searchPattern);
      const result = await db.query(baseQuery + ` AND (u.full_name ILIKE $2 OR u.company_name ILIKE $2 OR u.designation ILIKE $2 OR u.current_city ILIKE $2) ORDER BY u.full_name LIMIT $3 OFFSET $4`, [...params, limit, offset]);
      const countResult = await db.query(baseCountQuery + ` AND (u.full_name ILIKE $2 OR u.company_name ILIKE $2 OR u.designation ILIKE $2 OR u.current_city ILIKE $2)`, countParams);

      return res.json({
        users: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total)
        }
      });
    } else {
      const result = await db.query(baseQuery + ` ORDER BY u.full_name LIMIT $2 OFFSET $3`, [...params, limit, offset]);
      const countResult = await db.query(baseCountQuery, countParams);

      if (query) {
        // Log search
        await db.query(`
          INSERT INTO search_history (user_id, search_query, search_type)
          VALUES ($1, $2, 'person')
        `, [req.userId, query]);
      }

      return res.json({
        users: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total)
        }
      });
    }
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get user profile for network (when tapping on user)
router.get('/user/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await db.query(`
      SELECT 
        u.id,
        u.full_name,
        u.email,
        u.mobile_number,
        u.designation,
        u.company_name,
        u.branch,
        u.passport_year,
        u.years_of_experience,
        u.job_type,
        u.linkedin_profile,
        u.skills,
        u.current_city,
        u.sector,
        u.id_proof_url,
        u.profile_picture_url,
        u.created_at,
        (SELECT COUNT(*) FROM user_connections WHERE following_id = u.id) as connections_count,
        (SELECT COUNT(*) FROM feed_posts WHERE user_id = u.id) as posts_count,
        EXISTS(SELECT 1 FROM user_connections WHERE follower_id = $1 AND following_id = u.id) as is_connected
      FROM users u
      WHERE u.id = $2 AND u.status = 'approved'
    `, [req.userId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Get user connections
router.get('/:userId/connections', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(`
      SELECT 
        u.id,
        u.full_name,
        u.designation,
        u.company_name,
        u.linkedin_profile,
        EXISTS(SELECT 1 FROM user_connections WHERE follower_id = $1 AND following_id = u.id) as is_connected
      FROM user_connections uc
      JOIN users u ON uc.following_id = u.id
      WHERE uc.follower_id = $2 AND u.status = 'approved'
      ORDER BY uc.created_at DESC
      LIMIT $3 OFFSET $4
    `, [req.userId, userId, limit, offset]);

    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM user_connections
      WHERE follower_id = $1
    `, [userId]);

    res.json({
      connections: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// Connect to user
router.post('/:userId/connect', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot connect with yourself' });
    }

    // Check if already connected
    const existing = await db.query(`
      SELECT id FROM user_connections
      WHERE follower_id = $1 AND following_id = $2
    `, [req.userId, userId]);

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already connected' });
    }

    await db.query(`
      INSERT INTO user_connections (follower_id, following_id, status)
      VALUES ($1, $2, 'connected')
    `, [req.userId, userId]);

    res.status(201).json({ message: 'Connected successfully' });
  } catch (error) {
    console.error('Error connecting to user:', error);
    res.status(500).json({ error: 'Failed to connect to user' });
  }
});

// Disconnect from user
router.post('/:userId/disconnect', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;

    await db.query(`
      DELETE FROM user_connections
      WHERE follower_id = $1 AND following_id = $2
    `, [req.userId, userId]);

    res.json({ message: 'Disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// Get network stats
router.get('/stats/overview', authenticateUser, async (req, res) => {
  try {
    const connectionsResult = await db.query(`
      SELECT COUNT(*) as total FROM user_connections
      WHERE follower_id = $1
    `, [req.userId]);

    const postsResult = await db.query(`
      SELECT COUNT(*) as total FROM feed_posts
      WHERE user_id = $1
    `, [req.userId]);

    const bookmarksResult = await db.query(`
      SELECT COUNT(*) as total FROM bookmarks
      WHERE user_id = $1
    `, [req.userId]);

    res.json({
      stats: {
        connections: parseInt(connectionsResult.rows[0].total),
        posts: parseInt(postsResult.rows[0].total),
        bookmarks: parseInt(bookmarksResult.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Connect to a user
router.post('/connect', authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.body;
    const currentUserId = req.userId;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Check if already connected
    const existingConnection = await db.query(`
      SELECT id FROM user_connections 
      WHERE follower_id = $1 AND following_id = $2
    `, [currentUserId, user_id]);

    if (existingConnection.rows.length > 0) {
      return res.status(400).json({ error: 'Already connected to this user' });
    }

    // Create connection
    await db.query(`
      INSERT INTO user_connections (follower_id, following_id, status, created_at)
      VALUES ($1, $2, 'accepted', CURRENT_TIMESTAMP)
    `, [currentUserId, user_id]);

    res.json({ message: 'Connected successfully' });
  } catch (error) {
    console.error('Error connecting to user:', error);
    res.status(500).json({ error: 'Failed to connect' });
  }
});

// Disconnect from a user
router.post('/disconnect', authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.body;
    const currentUserId = req.userId;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Delete connection
    await db.query(`
      DELETE FROM user_connections 
      WHERE (follower_id = $1 AND following_id = $2) OR 
            (follower_id = $2 AND following_id = $1)
    `, [currentUserId, user_id]);

    res.json({ message: 'Disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting from user:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

module.exports = router;
