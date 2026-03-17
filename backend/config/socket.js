const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { cache } = require('./redis');
const logger = require('./logger');

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.user = decoded;
      
      logger.info(`Socket authenticated: ${socket.userId}`);
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', async (socket) => {
    const userId = socket.userId;
    logger.info(`User connected: ${userId} (Socket: ${socket.id})`);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Set user online status
    await cache.set(`user:online:${userId}`, {
      socketId: socket.id,
      connectedAt: new Date().toISOString()
    }, 3600);

    // Broadcast online status to user's connections
    socket.broadcast.emit('user:online', { userId });

    // Handle joining rooms
    socket.on('join:room', (roomId) => {
      socket.join(roomId);
      logger.info(`User ${userId} joined room: ${roomId}`);
    });

    socket.on('leave:room', (roomId) => {
      socket.leave(roomId);
      logger.info(`User ${userId} left room: ${roomId}`);
    });

    // Handle typing indicators
    socket.on('typing:start', ({ conversationId, receiverId }) => {
      io.to(`user:${receiverId}`).emit('typing:start', {
        conversationId,
        userId
      });
    });

    socket.on('typing:stop', ({ conversationId, receiverId }) => {
      io.to(`user:${receiverId}`).emit('typing:stop', {
        conversationId,
        userId
      });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      logger.info(`User disconnected: ${userId} (Socket: ${socket.id})`);
      
      // Remove online status
      await cache.del(`user:online:${userId}`);
      
      // Set last seen
      await cache.set(`user:lastseen:${userId}`, new Date().toISOString(), 86400);
      
      // Broadcast offline status
      socket.broadcast.emit('user:offline', { 
        userId,
        lastSeen: new Date().toISOString()
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${userId}:`, error);
    });
  });

  logger.info('✅ Socket.IO initialized');
  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

// Emit to specific user
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

// Emit to room
const emitToRoom = (roomId, event, data) => {
  if (io) {
    io.to(roomId).emit(event, data);
  }
};

// Check if user is online
const isUserOnline = async (userId) => {
  const status = await cache.get(`user:online:${userId}`);
  return !!status;
};

module.exports = {
  initializeSocket,
  getIO,
  emitToUser,
  emitToRoom,
  isUserOnline
};
