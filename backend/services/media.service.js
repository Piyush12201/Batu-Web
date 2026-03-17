const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const logger = require('../config/logger');
const fs = require('fs').promises;
const path = require('path');

// Check if Cloudinary is configured
const isCloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET;

// Configure Cloudinary only if credentials are provided
if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  logger.info('✅ Cloudinary configured');
} else {
  logger.warn('⚠️ Cloudinary not configured - images will be stored locally');
}

class MediaService {
  /**
   * Upload image to Cloudinary or local storage
   */
  static async uploadImage(filePath, options = {}) {
    try {
      const {
        folder = 'alumni-app',
        transformation = {},
        generateThumbnail = true
      } = options;

      // If Cloudinary is configured, use it
      if (isCloudinaryConfigured) {
        return await this.uploadToCloudinary(filePath, folder, transformation, generateThumbnail);
      } else {
        // Fallback to local storage
        return await this.uploadToLocalStorage(filePath, folder, transformation, generateThumbnail);
      }
    } catch (error) {
      logger.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  }

  /**
   * Upload to Cloudinary
   */
  static async uploadToCloudinary(filePath, folder, transformation, generateThumbnail) {
    try {
      // Compress and optimize image before upload
      const optimizedBuffer = await sharp(filePath)
        .resize(1920, 1080, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(filePath, {
        folder,
        resource_type: 'image',
        transformation: {
          quality: 'auto',
          fetch_format: 'auto',
          ...transformation
        }
      });

      let thumbnailUrl = null;

      // Generate thumbnail if requested
      if (generateThumbnail) {
        thumbnailUrl = cloudinary.url(result.public_id, {
          transformation: [
            { width: 300, height: 300, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' }
          ]
        });
      }

      // Clean up local file
      try {
        await fs.unlink(filePath);
      } catch (error) {
        logger.warn('Failed to delete local file:', filePath);
      }

      logger.info(`Image uploaded to Cloudinary: ${result.public_id}`);

      return {
        url: result.secure_url,
        publicId: result.public_id,
        thumbnailUrl,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes
      };
    } catch (error) {
      logger.error('Error uploading to Cloudinary:', error);
      throw error;
    }
  }

  /**
   * Upload to local storage
   */
  static async uploadToLocalStorage(filePath, folder, transformation, generateThumbnail) {
    try {
      // Create uploads directory structure
      const uploadsDir = path.join(process.cwd(), 'uploads', folder);
      await fs.mkdir(uploadsDir, { recursive: true });

      // Generate unique filename
      const ext = path.extname(filePath);
      const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
      const destPath = path.join(uploadsDir, filename);

      // Get image metadata
      const metadata = await sharp(filePath).metadata();

      // Process and optimize image
      let sharpInstance = sharp(filePath);
      
      if (transformation.width || transformation.height) {
        sharpInstance = sharpInstance.resize(
          transformation.width || null,
          transformation.height || null,
          { 
            fit: transformation.crop === 'fill' ? 'cover' : 'inside',
            withoutEnlargement: true 
          }
        );
      }

      await sharpInstance
        .jpeg({ quality: 85, progressive: true })
        .toFile(destPath);

      let thumbnailUrl = null;
      let thumbnailPath = null;

      // Generate thumbnail if requested
      if (generateThumbnail) {
        const thumbnailFilename = `thumb-${filename}`;
        thumbnailPath = path.join(uploadsDir, thumbnailFilename);
        
        await sharp(filePath)
          .resize(300, 300, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);

        thumbnailUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/uploads/${folder}/${thumbnailFilename}`;
      }

      // Clean up original temp file
      try {
        await fs.unlink(filePath);
      } catch (error) {
        logger.warn('Failed to delete temp file:', filePath);
      }

      const url = `${process.env.BACKEND_URL || 'http://localhost:5000'}/uploads/${folder}/${filename}`;
      logger.info(`Image saved locally: ${url}`);

      return {
        url,
        publicId: filename,
        thumbnailUrl,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: (await fs.stat(destPath)).size
      };
    } catch (error) {
      logger.error('Error uploading to local storage:', error);
      throw error;
    }
  }

  /**
   * Delete image from Cloudinary or local storage
   */
  static async deleteImage(publicId) {
    try {
      if (isCloudinaryConfigured) {
        await cloudinary.uploader.destroy(publicId);
        logger.info(`Image deleted from Cloudinary: ${publicId}`);
      } else {
        // Delete from local storage - publicId is the filename
        const uploadsDir = path.join(process.cwd(), 'uploads');
        // Search for the file in all subdirectories
        const findAndDelete = async (dir) => {
          const files = await fs.readdir(dir, { withFileTypes: true });
          for (const file of files) {
            const filePath = path.join(dir, file.name);
            if (file.isDirectory()) {
              await findAndDelete(filePath);
            } else if (file.name === publicId || file.name === `thumb-${publicId}`) {
              await fs.unlink(filePath);
              logger.info(`Image deleted locally: ${filePath}`);
            }
          }
        };
        await findAndDelete(uploadsDir);
      }
      return true;
    } catch (error) {
      logger.error('Error deleting image:', error);
      return false;
    }
  }

  /**
   * Generate thumbnail from existing image URL (Cloudinary only)
   */
  static generateThumbnail(publicId, width = 300, height = 300) {
    if (!isCloudinaryConfigured) {
      logger.warn('Thumbnail generation called but Cloudinary not configured');
      return null;
    }
    return cloudinary.url(publicId, {
      transformation: [
        { width, height, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });
  }

  /**
   * Upload profile picture with special handling
   */
  static async uploadProfilePicture(filePath, userId) {
    try {
      return await this.uploadImage(filePath, {
        folder: 'alumni-app/profiles',
        transformation: {
          width: 500,
          height: 500,
          crop: 'fill',
          gravity: 'face'
        },
        generateThumbnail: true
      });
    } catch (error) {
      logger.error('Error uploading profile picture:', error);
      throw error;
    }
  }

  /**
   * Upload post image
   */
  static async uploadPostImage(filePath) {
    try {
      return await this.uploadImage(filePath, {
        folder: 'alumni-app/posts',
        transformation: {
          width: 1200,
          height: 1200,
          crop: 'limit'
        },
        generateThumbnail: true
      });
    } catch (error) {
      logger.error('Error uploading post image:', error);
      throw error;
    }
  }

  /**
   * Optimize and resize image buffer
   */
  static async optimizeImage(buffer, maxWidth = 1920, maxHeight = 1080) {
    try {
      return await sharp(buffer)
        .resize(maxWidth, maxHeight, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
    } catch (error) {
      logger.error('Error optimizing image:', error);
      throw error;
    }
  }

  /**
   * Extract public ID from Cloudinary URL
   */
  static extractPublicId(url) {
    try {
      const matches = url.match(/\/([^\/]+)\.(jpg|jpeg|png|gif|webp)$/i);
      return matches ? matches[1] : null;
    } catch (error) {
      logger.error('Error extracting public ID:', error);
      return null;
    }
  }
}

module.exports = MediaService;
