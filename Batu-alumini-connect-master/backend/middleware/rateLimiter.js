const rateLimit = require('express-rate-limit');
const { redis } = require('../config/redis');
const logger = require('../config/logger');

// Create a Redis store for rate limiting
class RedisStore {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rl:';
    this.resetExpiryOnChange = options.resetExpiryOnChange || false;
  }

  async increment(key) {
    const redisKey = `${this.prefix}${key}`;
    const current = await redis.incr(redisKey);
    
    if (current === 1) {
      // First request, set expiry
      await redis.expire(redisKey, 60); // 60 seconds window
    }
    
    return {
      totalHits: current,
      resetTime: new Date(Date.now() + 60000)
    };
  }

  async decrement(key) {
    const redisKey = `${this.prefix}${key}`;
    await redis.decr(redisKey);
  }

  async resetKey(key) {
    const redisKey = `${this.prefix}${key}`;
    await redis.del(redisKey);
  }
}

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10000, // Allow 10,000 requests per minute for dev
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: 60 // seconds
    });
  }
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Allow 1,000 auth attempts per minute for dev
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please wait 1 minute before trying again.',
      retryAfter: 60
    });
  }
});

// Upload limiter
const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Allow 1,000 uploads per minute for dev
  message: 'Too many uploads, please try again later.',
  handler: (req, res) => {
    logger.warn(`Upload rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many uploads',
      message: 'You have exceeded the upload limit. Please try again later.',
      retryAfter: 60
    });
  }
});

// Post creation limiter
const postLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Allow 1,000 posts per minute for dev
  message: 'Too many posts created, please try again later.',
  keyGenerator: (req) => req.userId || req.ip,
  handler: (req, res) => {
    logger.warn(`Post creation rate limit exceeded for user: ${req.userId}`);
    res.status(429).json({
      error: 'Too many posts',
      message: 'You have exceeded the post creation limit. Please try again later.',
      retryAfter: 60
    });
  }
});

// Message limiter
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Allow 1,000 messages per minute for dev
  message: 'Too many messages sent, please slow down.',
  keyGenerator: (req) => req.userId || req.ip,
  handler: (req, res) => {
    logger.warn(`Message rate limit exceeded for user: ${req.userId}`);
    res.status(429).json({
      error: 'Too many messages',
      message: 'Please slow down your messaging rate.',
      retryAfter: 60
    });
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  postLimiter,
  messageLimiter,
  RedisStore
};
