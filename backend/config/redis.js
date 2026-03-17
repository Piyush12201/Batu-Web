const Redis = require('ioredis');
require('dotenv').config();

// Flag to track Redis availability
let isRedisAvailable = false;

// Redis client for caching
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    // Stop retrying after 3 attempts to prevent crashes
    if (times > 3) {
      console.log('⚠️  Redis unavailable - running without cache');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: null, // Disable max retries to prevent crashes
  enableOfflineQueue: false, // Don't queue commands when disconnected
  lazyConnect: true // Don't connect immediately
});

// Redis client for pub/sub
const redisPubSub = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    if (times > 3) return null;
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  lazyConnect: true
});

// Event handlers must be set up before connection attempt
redis.on('connect', () => {
  isRedisAvailable = true;
  console.log('✅ Redis connected successfully');
});

redis.on('ready', () => {
  isRedisAvailable = true;
});

redis.on('error', (err) => {
  isRedisAvailable = false;
  // Only log once, don't spam errors
  if (!redis._errorLogged) {
    console.log('⚠️  Redis connection failed - running without cache');
    redis._errorLogged = true;
  }
});

redis.on('close', () => {
  isRedisAvailable = false;
});

redis.on('end', () => {
  isRedisAvailable = false;
});

// Try to connect but don't crash if it fails
redis.connect().then(() => {
  // Connection successful, flag already set by 'connect' event
}).catch((err) => {
  isRedisAvailable = false;
  console.log('⚠️  Redis not available - running without cache');
});

// Cache helper functions
const cache = {
  // Get cached data
  async get(key) {
    if (!isRedisAvailable || redis.status !== 'ready') return null;
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      isRedisAvailable = false;
      return null;
    }
  },

  // Set cache with expiration (in seconds)
  async set(key, value, expirationInSeconds = 3600) {
    if (!isRedisAvailable || redis.status !== 'ready') return false;
    try {
      await redis.setex(key, expirationInSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      isRedisAvailable = false;
      return false;
    }
  },

  // Delete cache
  async del(key) {
    if (!isRedisAvailable || redis.status !== 'ready') return false;
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      isRedisAvailable = false;
      return false;
    }
  },

  // Delete multiple keys by pattern
  async delPattern(pattern) {
    if (!isRedisAvailable || redis.status !== 'ready') return false;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      isRedisAvailable = false;
      return false;
    }
  },

  // Increment counter
  async incr(key) {
    if (!isRedisAvailable || redis.status !== 'ready') return null;
    try {
      return await redis.incr(key);
    } catch (error) {
      console.error('Cache incr error:', error);
      isRedisAvailable = false;
      return null;
    }
  },

  // Set expiration on existing key
  async expire(key, seconds) {
    if (!isRedisAvailable || redis.status !== 'ready') return false;
    try {
      await redis.expire(key, seconds);
      return true;
    } catch (error) {
      console.error('Cache expire error:', error);
      isRedisAvailable = false;
      return false;
    }
  }
};

module.exports = { redis, redisPubSub, cache };
