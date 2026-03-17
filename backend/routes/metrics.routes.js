const express = require('express');
const router = express.Router();
const monitoring = require('../services/monitoring.service');
const { authenticateAdmin } = require('../middleware/auth');

/**
 * GET /api/metrics
 * Get application metrics (admin only)
 */
router.get('/', authenticateAdmin, (req, res) => {
  try {
    const metrics = monitoring.getMetrics();
    
    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * GET /api/metrics/health
 * Health check endpoint (public)
 */
router.get('/health', async (req, res) => {
  try {
    const health = await monitoring.checkHealth();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

module.exports = router;
