const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticateUser } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const MediaService = require('../services/media.service');
const logger = require('../config/logger');

// Configure multer for temporary file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/temp/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// Ensure temp upload directory exists
const fs = require('fs');
const tempDir = './uploads/temp';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Upload profile picture
router.post('/profile-picture', 
  authenticateUser, 
  uploadLimiter,
  upload.single('image'), 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      logger.info(`Uploading profile picture for user ${req.userId}`);

      // Upload to Cloudinary
      const result = await MediaService.uploadProfilePicture(
        req.file.path,
        req.userId
      );

      res.json({
        message: 'Profile picture uploaded successfully',
        url: result.url,
        thumbnailUrl: result.thumbnailUrl
      });
    } catch (error) {
      logger.error('Error uploading profile picture:', error);
      res.status(500).json({ error: 'Failed to upload profile picture' });
    }
  }
);

// Upload post image
router.post('/post-image', 
  authenticateUser, 
  uploadLimiter,
  upload.single('image'), 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      logger.info(`Uploading post image for user ${req.userId}`);

      // Upload to Cloudinary
      const result = await MediaService.uploadPostImage(req.file.path);

      res.json({
        message: 'Post image uploaded successfully',
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
        width: result.width,
        height: result.height
      });
    } catch (error) {
      logger.error('Error uploading post image:', error);
      res.status(500).json({ error: 'Failed to upload post image' });
    }
  }
);

// Upload message image
router.post('/message-image', 
  authenticateUser, 
  uploadLimiter,
  upload.single('image'), 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      logger.info(`Uploading message image for user ${req.userId}`);

      // Upload to Cloudinary
      const result = await MediaService.uploadImage(req.file.path, {
        folder: 'alumni-app/messages',
        transformation: {
          width: 800,
          height: 800,
          crop: 'limit'
        }
      });

      res.json({
        message: 'Message image uploaded successfully',
        url: result.url,
        thumbnailUrl: result.thumbnailUrl
      });
    } catch (error) {
      logger.error('Error uploading message image:', error);
      res.status(500).json({ error: 'Failed to upload message image' });
    }
  }
);

// Delete image (requires public_id)
router.delete('/image', authenticateUser, async (req, res) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({ error: 'Public ID is required' });
    }

    const deleted = await MediaService.deleteImage(publicId);

    if (deleted) {
      res.json({ message: 'Image deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete image' });
    }
  } catch (error) {
    logger.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

module.exports = router;
