const express = require('express');
const db = require('../config/database');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.*,
        ua.is_login_enabled,
        ua.last_login_at
      FROM users u
      LEFT JOIN user_auth ua ON u.id = ua.user_id
      WHERE u.id = $1
    `, [req.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateUser, async (req, res) => {
  try {
    const {
      fullName,
      mobileNumber,
      currentCity,
      linkedIn,
      jobType,
      sector,
      company,
      designation,
      yearsOfExperience,
      skills
    } = req.body;

    const result = await db.query(`
      UPDATE users 
      SET 
        full_name = COALESCE($1, full_name),
        mobile_number = COALESCE($2, mobile_number),
        current_city = COALESCE($3, current_city),
        linkedin_profile = COALESCE($4, linkedin_profile),
        job_type = COALESCE($5, job_type),
        sector = COALESCE($6, sector),
        company_name = COALESCE($7, company_name),
        designation = COALESCE($8, designation),
        years_of_experience = COALESCE($9, years_of_experience),
        skills = COALESCE($10, skills),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING id, full_name, email, mobile_number, designation, company_name, years_of_experience, sector, skills, profile_picture_url, created_at
    `, [
      fullName, mobileNumber, currentCity, linkedIn,
      jobType, sector, company, designation,
      yearsOfExperience, Array.isArray(skills) ? skills : (skills ? [skills] : null), req.userId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user verification status
router.get('/status', authenticateUser, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, status, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      status: user.status,
      message:
        user.status === 'approved'
          ? 'Your account is approved. You can now login.'
          : user.status === 'pending_approval'
          ? 'Your account is pending approval from admin.'
          : 'Your account has been rejected.'
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Upload profile picture
router.post('/upload-profile-picture', authenticateUser, async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const result = await db.query(`
      UPDATE users 
      SET 
        profile_picture_url = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [imageUrl, req.userId]);

    res.json({
      message: 'Profile picture updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

// Get user's feed posts
router.get('/posts', authenticateUser, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await db.query(`
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
        u.company_name as author_company
      FROM feed_posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.userId, limit, offset]);

    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM feed_posts 
      WHERE user_id = $1
    `, [req.userId]);

    res.json({
      posts: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

module.exports = router;
