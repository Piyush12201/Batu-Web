const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const db = require('../config/database');
const { generateAuthTokens, generateLoginCredentials } = require('../utils/jwt');
const { authenticateUser, authenticateRefreshToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate, schemas } = require('../middleware/validation');
const logger = require('../config/logger');

const router = express.Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10) },
});

// Upload ID proof document
router.post('/upload-id-proof', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const publicPath = `/uploads/${req.file.filename}`;

  res.json({
    url: publicPath,
    filename: req.file.originalname
  });
});

// User Registration
router.post('/register', async (req, res) => {
  try {
    const {
      full_name,
      email,
      mobile_number,
      branch,
      graduation_year,
      passport_year,
      city,
      current_city,
      linkedin_url,
      linkedin_profile,
      job_type,
      job_sector,
      sector,
      company_name,
      designation,
      years_of_experience,
      skills,
      password,
      id_proof_url
    } = req.body;

    const resolvedPassportYear = passport_year || graduation_year || null;
    const resolvedCurrentCity = current_city || city || null;
    const resolvedLinkedinProfile = linkedin_profile || linkedin_url || null;
    const resolvedSector = sector || job_sector || null;
    const resolvedIdProofUrl = id_proof_url || null;
    const parsedPassportYear = resolvedPassportYear !== null && resolvedPassportYear !== undefined
      ? parseInt(resolvedPassportYear, 10)
      : null;
    const parsedYearsOfExperience = years_of_experience !== undefined && years_of_experience !== null
      ? parseInt(years_of_experience, 10)
      : null;

    // Validation
    if (!full_name || !email || !mobile_number || !branch) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!resolvedPassportYear || !resolvedCurrentCity) {
      return res.status(400).json({ error: 'Missing required profile fields' });
    }

    if (!resolvedIdProofUrl) {
      return res.status(400).json({ error: 'ID proof is required' });
    }

    if (Number.isNaN(parsedPassportYear)) {
      return res.status(400).json({ error: 'Invalid graduation year' });
    }

    if (parsedYearsOfExperience !== null && Number.isNaN(parsedYearsOfExperience)) {
      return res.status(400).json({ error: 'Invalid years of experience' });
    }

    // Validate password
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await db.query(
      `INSERT INTO users (
        full_name, email, mobile_number, branch, passport_year,
        current_city, linkedin_profile, job_type, sector, company_name,
        designation, years_of_experience, skills, id_proof_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, full_name, email, status`,
      [
        full_name, email, mobile_number, branch, parsedPassportYear,
        resolvedCurrentCity, resolvedLinkedinProfile, job_type, resolvedSector, company_name,
        designation, parsedYearsOfExperience, skills || [], resolvedIdProofUrl, 'pending_approval'
      ]
    );

    const userId = userResult.rows[0].id;

    // Create authentication record with password (login disabled until admin approval)
    await db.query(
      'INSERT INTO user_auth (user_id, password_hash, is_login_enabled) VALUES ($1, $2, $3)',
      [userId, hashedPassword, false]
    );

    res.status(201).json({
      message: 'Registration successful. Awaiting admin approval.',
      user: {
        id: userId,
        full_name: userResult.rows[0].full_name,
        email: userResult.rows[0].email,
        status: 'pending_approval'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User Login with rate limiting
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { loginId, password, email } = req.body;

    // Find user by login_id or email
    let query = `
      SELECT u.id, u.full_name, u.email, u.status, ua.password_hash, ua.is_login_enabled
      FROM users u
      JOIN user_auth ua ON u.id = ua.user_id
      WHERE ua.login_id = $1 OR u.email = $1
    `;
    
    const result = await db.query(query, [loginId || email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check if user is approved
    if (user.status !== 'approved') {
      return res.status(403).json({ 
        error: 'Account not approved yet',
        status: user.status 
      });
    }

    // Check if login is enabled
    if (!user.is_login_enabled) {
      return res.status(403).json({ error: 'Login not enabled for this account' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateAuthTokens(user.id, false);

    // Update last login
    await db.query(
      'UPDATE user_auth SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.id]
    );

    // Store refresh token
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
      [user.id, refreshToken]
    );

    logger.info(`User logged in: ${user.id}`);

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Admin Login
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await db.query(
      'SELECT id, name, email, password_hash FROM admin_users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateAuthTokens(admin.id, true);

    // Update last login
    await db.query(
      'UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [admin.id]
    );

    // Store refresh token
    await db.query(
      'INSERT INTO admin_refresh_tokens (admin_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
      [admin.id, refreshToken]
    );

    res.json({
      message: 'Admin login successful',
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Admin login failed' });
  }
});

// Generate new access token from refresh token
router.post('/refresh-token', authenticateRefreshToken, async (req, res) => {
  try {
    const userId = req.userId;
    const oldRefreshToken = req.refreshToken;

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateAuthTokens(userId, false);

    // Revoke old refresh token
    await db.query(`
      UPDATE refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE token = $1
    `, [oldRefreshToken]);

    // Store new refresh token
    await db.query(`
      INSERT INTO refresh_tokens (user_id, token, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '7 days')
    `, [userId, newRefreshToken]);

    // Get user details
    const userResult = await db.query(`
      SELECT id, full_name, email FROM users WHERE id = $1
    `, [userId]);

    const user = userResult.rows[0];

    logger.info(`Token refreshed for user: ${userId}`);

    res.json({
      message: 'Token refreshed successfully',
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email
      }
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout - Revoke refresh token
router.post('/logout', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Revoke specific refresh token
      await db.query(`
        UPDATE refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE token = $1 AND user_id = $2 AND revoked_at IS NULL
      `, [refreshToken, userId]);
    } else {
      // Revoke all refresh tokens for this user
      await db.query(`
        UPDATE refresh_tokens
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND revoked_at IS NULL
      `, [userId]);
    }

    logger.info(`User logged out: ${userId}`);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user profile
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await db.query(`
      SELECT 
        id, full_name, email, mobile_number, branch, passport_year,
        designation, company_name, years_of_experience, job_type,
        sector, skills, profile_picture_url, bio, location,
        current_city, linkedin_profile, id_proof_url, status, created_at
      FROM users
      WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
