const { verifyAccessToken, verifyRefreshToken } = require('../utils/jwt');
const db = require('../config/database');
const logger = require('../config/logger');

const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.isAdmin) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Optionally verify user still exists and is active
    const userCheck = await db.query(`
      SELECT id, status FROM users WHERE id = $1
    `, [decoded.userId]);

    if (userCheck.rows.length === 0 || userCheck.rows[0].status !== 'approved') {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.userId = decoded.userId;
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.warn('⚠️ No token provided in Authorization header');
      return res.status(401).json({ error: 'No token provided' });
    }

    console.log('🔐 Attempting to verify admin token...');
    const decoded = verifyAccessToken(token);
    
    console.log('📋 Decoded token:', decoded);
    
    if (!decoded) {
      console.warn('❌ Token verification failed - invalid signature or expired');
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (!decoded.isAdmin) {
      console.warn('❌ Token does not have isAdmin flag. Token payload:', decoded);
      return res.status(401).json({ error: 'Invalid admin token - not an admin token' });
    }

    req.adminId = decoded.userId;
    req.admin = decoded;
    console.log('✅ Admin authenticated:', req.adminId);
    next();
  } catch (error) {
    logger.error('Admin authentication error:', error);
    res.status(401).json({ error: 'Admin authentication failed' });
  }
};

const authenticateRefreshToken = async (req, res, next) => {
  try {
    const token = req.body.refreshToken || req.cookies.refreshToken;
    
    if (!token) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const decoded = verifyRefreshToken(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if refresh token exists in database and is not revoked
    const tokenCheck = await db.query(`
      SELECT id, user_id, expires_at, revoked_at
      FROM refresh_tokens
      WHERE token = $1
    `, [token]);

    if (tokenCheck.rows.length === 0) {
      return res.status(401).json({ error: 'Refresh token not found' });
    }

    const tokenRecord = tokenCheck.rows[0];

    if (tokenRecord.revoked_at) {
      return res.status(401).json({ error: 'Refresh token has been revoked' });
    }

    if (new Date() > new Date(tokenRecord.expires_at)) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    req.userId = tokenRecord.user_id;
    req.refreshToken = token;
    next();
  } catch (error) {
    logger.error('Refresh token authentication error:', error);
    res.status(401).json({ error: 'Refresh token authentication failed' });
  }
};

module.exports = {
  authenticateUser,
  authenticateAdmin,
  authenticateRefreshToken
};
