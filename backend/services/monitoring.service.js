const logger = require('../config/logger');
const { cache } = require('../config/redis');
const { getIO } = require('../config/socket');
const pool = require('../config/database');

/**
 * Monitoring service for tracking application health and performance
 */
class MonitoringService {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      apiLatency: [],
      socketConnections: 0,
      cacheHits: 0,
      cacheMisses: 0,
      dbQueries: 0,
      dbErrors: 0,
    };

    this.startTime = Date.now();
    
    // Reset metrics hourly
    setInterval(() => this.resetHourlyMetrics(), 3600000);
  }

  /**
   * Record API request
   */
  recordRequest(duration, endpoint, statusCode) {
    this.metrics.requests++;
    
    if (this.metrics.apiLatency.length > 1000) {
      this.metrics.apiLatency.shift();
    }
    this.metrics.apiLatency.push(duration);

    if (statusCode >= 500) {
      this.metrics.errors++;
      logger.error('API Error', { endpoint, statusCode, duration });
    }

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow API Request', { endpoint, duration, statusCode });
    }
  }

  /**
   * Record cache operation
   */
  recordCacheOperation(hit) {
    if (hit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
  }

  /**
   * Record database query
   */
  recordDbQuery(duration, error = false) {
    this.metrics.dbQueries++;
    
    if (error) {
      this.metrics.dbErrors++;
    }

    // Log slow queries
    if (duration > 500) {
      logger.warn('Slow Database Query', { duration });
    }
  }

  /**
   * Record socket connection
   */
  recordSocketConnection(connected) {
    if (connected) {
      this.metrics.socketConnections++;
    } else {
      this.metrics.socketConnections--;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime;
    const avgLatency = this.metrics.apiLatency.length > 0
      ? this.metrics.apiLatency.reduce((a, b) => a + b, 0) / this.metrics.apiLatency.length
      : 0;

    const p95Latency = this.calculatePercentile(this.metrics.apiLatency, 95);
    const p99Latency = this.calculatePercentile(this.metrics.apiLatency, 99);

    const cacheTotal = this.metrics.cacheHits + this.metrics.cacheMisses;
    const cacheHitRate = cacheTotal > 0 
      ? ((this.metrics.cacheHits / cacheTotal) * 100).toFixed(2)
      : 0;

    const errorRate = this.metrics.requests > 0
      ? ((this.metrics.errors / this.metrics.requests) * 100).toFixed(2)
      : 0;

    return {
      uptime: this.formatUptime(uptime),
      uptimeMs: uptime,
      requests: {
        total: this.metrics.requests,
        errors: this.metrics.errors,
        errorRate: `${errorRate}%`,
      },
      latency: {
        avg: Math.round(avgLatency),
        p95: Math.round(p95Latency),
        p99: Math.round(p99Latency),
      },
      cache: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate: `${cacheHitRate}%`,
      },
      database: {
        queries: this.metrics.dbQueries,
        errors: this.metrics.dbErrors,
      },
      websocket: {
        connections: this.metrics.socketConnections,
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };
  }

  /**
   * Calculate percentile
   */
  calculatePercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    
    return sorted[index] || 0;
  }

  /**
   * Format uptime
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Reset hourly metrics
   */
  resetHourlyMetrics() {
    logger.info('Resetting hourly metrics', this.getMetrics());
    
    this.metrics.requests = 0;
    this.metrics.errors = 0;
    this.metrics.apiLatency = [];
    this.metrics.cacheHits = 0;
    this.metrics.cacheMisses = 0;
    this.metrics.dbQueries = 0;
    this.metrics.dbErrors = 0;
  }

  /**
   * Check system health
   */
  async checkHealth() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {},
    };

    // Check database
    try {
      const dbResult = await pool.query('SELECT 1');
      health.services.database = {
        status: 'connected',
        connectionPool: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
        },
      };
    } catch (error) {
      health.status = 'unhealthy';
      health.services.database = {
        status: 'disconnected',
        error: error.message,
      };
      logger.error('Database health check failed', { error: error.message });
    }

    // Check Redis
    try {
      await cache.set('health_check', '1', 5);
      const redisCheck = await cache.get('health_check');
      
      health.services.redis = {
        status: redisCheck ? 'connected' : 'error',
      };
      
      if (!redisCheck) {
        health.status = 'degraded';
      }
    } catch (error) {
      health.status = 'degraded';
      health.services.redis = {
        status: 'disconnected',
        error: error.message,
      };
      logger.error('Redis health check failed', { error: error.message });
    }

    // Check Socket.IO
    try {
      const io = getIO();
      health.services.socket = {
        status: 'active',
        connections: this.metrics.socketConnections,
      };
    } catch (error) {
      health.status = 'degraded';
      health.services.socket = {
        status: 'inactive',
        error: error.message,
      };
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const memPercent = ((memUsedMB / memTotalMB) * 100).toFixed(2);

    health.services.memory = {
      used: `${memUsedMB}MB`,
      total: `${memTotalMB}MB`,
      percent: `${memPercent}%`,
    };

    // Warn if memory usage is high
    if (memPercent > 90) {
      health.status = 'warning';
      logger.warn('High memory usage', { memUsedMB, memTotalMB, memPercent });
    }

    return health;
  }

  /**
   * Log error with context
   */
  logError(error, context = {}) {
    logger.error('Application Error', {
      message: error.message,
      stack: error.stack,
      ...context,
    });

    this.metrics.errors++;

    // TODO: Send to error tracking service (e.g., Sentry)
    // if (process.env.SENTRY_DSN) {
    //   Sentry.captureException(error, { extra: context });
    // }
  }

  /**
   * Track custom event
   */
  trackEvent(eventName, data = {}) {
    logger.info('Custom Event', {
      event: eventName,
      ...data,
    });
  }
}

// Export singleton instance
module.exports = new MonitoringService();
