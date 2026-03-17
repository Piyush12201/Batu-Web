const monitoring = require('../services/monitoring.service');

/**
 * Middleware to track request metrics
 */
const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Override res.json to capture response
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    // Record metrics
    monitoring.recordRequest(duration, req.path, res.statusCode);

    return originalJson.call(this, data);
  };

  // Also handle res.send
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Record metrics
    monitoring.recordRequest(duration, req.path, res.statusCode);

    return originalSend.call(this, data);
  };

  next();
};

module.exports = metricsMiddleware;
