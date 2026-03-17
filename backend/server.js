const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');

// Load environment variables
dotenv.config();

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const { initializeSocket } = require('./config/socket');
const io = initializeSocket(server);

// Initialize logger
const logger = require('./config/logger');

// Initialize Redis
const { redis } = require('./config/redis');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, configure for production
  crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// Cookie parser
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ===== IMAGE SERVING ROUTE - MUST BE BEFORE CORS MIDDLEWARE =====
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const absoluteUploadDir = path.resolve(uploadDir);

if (!fs.existsSync(absoluteUploadDir)) {
  fs.mkdirSync(absoluteUploadDir, { recursive: true });
}

// Handle OPTIONS preflight requests for uploads
app.options('/uploads/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'false');
  res.header('Access-Control-Max-Age', '86400');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.status(204).end();
});

// Custom route handler for all image requests - BEFORE CORS middleware
app.get('/uploads/*', (req, res) => {
  logger.info(`[CORS-UPLOADS] GET ${req.path}`);
  
  // ===== CRITICAL CORS & CORP HEADERS =====
  // CORS Headers - Allow cross-origin requests
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Credentials', 'false');
  res.set('Access-Control-Max-Age', '86400');
  res.set('Vary', 'Origin');
  
  // CORP Header - KEY HEADER that fixes net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin error
  // This tells the browser that the resource CAN be loaded cross-origin
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  
  // Caching
  res.set('Cache-Control', 'public, max-age=31536000');
  
  // Extract requested path and support both legacy and nested storage layouts.
  const requestedPath = req.path.replace(/^\/uploads\/?/, '').replace(/^\/+/, '');
  const candidateRelativePaths = [
    requestedPath,
    path.join('alumni-app', requestedPath)
  ];

  let fullPath = null;
  for (const relativePath of candidateRelativePaths) {
    const candidatePath = path.resolve(path.join(absoluteUploadDir, relativePath));

    // Security: ensure path doesn't escape uploads directory
    if (!candidatePath.startsWith(absoluteUploadDir)) {
      continue;
    }

    if (fs.existsSync(candidatePath)) {
      fullPath = candidatePath;
      break;
    }
  }

  if (!fullPath) {
    logger.warn(`[CORS-UPLOADS] File not found for request: ${requestedPath}`);
    return res.status(404).json({ error: 'File not found' });
  }
  
  // Set content type based on extension
  const ext = path.extname(fullPath).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain; charset=utf-8',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  
  const contentType = contentTypes[ext] || 'application/octet-stream';
  res.set('Content-Type', contentType);
  res.set('Content-Disposition', 'inline');
  
  // Get file size
  const stats = fs.statSync(fullPath);
  res.set('Content-Length', stats.size);
  
  logger.info(`[CORS-UPLOADS] Serving: ${path.basename(fullPath)} (${stats.size} bytes) with CORS`);
  
  // Use createReadStream to have better control over headers
  const stream = fs.createReadStream(fullPath);
  
  stream.on('error', (error) => {
    logger.error(`[CORS-UPLOADS] Stream error: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to serve image' });
    }
  });
  
  // Pipe the stream to response
  stream.pipe(res);
});
// ===== END IMAGE SERVING ROUTE =====

// CORS configuration - Apply AFTER uploads route to avoid interference
app.use(cors({
  origin: '*', // Allow all origins explicitly
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
const { sanitizeInput } = require('./middleware/validation');
app.use(sanitizeInput);

// Database connection
const db = require('./config/database');

// Verify database connection
db.query('SELECT NOW()', (err, result) => {
  if (err) {
    logger.error('❌ Database connection failed:', err);
    process.exit(1);
  } else {
    logger.info('✅ Database connected successfully');
  }
});

// Monitoring middleware
const metricsMiddleware = require('./middleware/metrics');
app.use(metricsMiddleware);

// Rate limiting
const { apiLimiter } = require('./middleware/rateLimiter');
app.use('/api/', apiLimiter);

// Routes
app.use('/api/metrics', require('./routes/metrics.routes'));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/feed', require('./routes/feed.routes'));
app.use('/api/opportunities', require('./routes/opportunities.routes'));
app.use('/api/helpdesk', require('./routes/helpdesk.routes'));
app.use('/api/network', require('./routes/network.routes'));
app.use('/api/messages', require('./routes/messages.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/upload', require('./routes/upload.routes'));

// Serve the built frontend from the same backend process in production-like deployments.
const webDistPath = path.resolve(__dirname, '../web/dist');
const shouldServeFrontend = process.env.SERVE_FRONTEND !== 'false';

if (shouldServeFrontend && fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));

  app.get('*', (req, res, next) => {
    if (
      req.path === '/api' ||
      req.path.startsWith('/api/') ||
      req.path === '/uploads' ||
      req.path.startsWith('/uploads/') ||
      req.path.startsWith('/socket.io')
    ) {
      return next();
    }

    return res.sendFile(path.join(webDistPath, 'index.html'));
  });
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database
    await db.query('SELECT 1');
    
    // Check Redis
    await redis.ping();
    
    res.status(200).json({ 
      status: 'healthy',
      message: 'Server is running',
      timestamp: new Date(),
      services: {
        database: 'connected',
        redis: 'connected',
        socket: 'active'
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'unhealthy',
      message: 'Service unavailable',
      timestamp: new Date()
    });
  }
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({ 
    error: isDevelopment ? err.message : 'Internal server error',
    status: err.status || 500,
    ...(isDevelopment && { stack: err.stack })
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit process - log and continue
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Don't exit process - log and continue
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Close database connections
    await db.end();
    logger.info('Database connections closed');
    
    // Close Redis connections
    await redis.quit();
    logger.info('Redis connection closed');
    
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Close database connections
    await db.end();
    logger.info('Database connections closed');
    
    // Close Redis connections
    await redis.quit();
    logger.info('Redis connection closed');
    
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces
server.listen(PORT, HOST, () => {
  logger.info(`🚀 Server is running on http://${HOST}:${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔌 Socket.IO enabled`);
  logger.info(`💾 Redis connected`);
  logger.info(`🗄️  Database connected`);
});

module.exports = { app, server, io }
;
