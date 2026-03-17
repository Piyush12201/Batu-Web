/**
 * Database Migration Script
 * Run this to add indexes, new fields, and optimize database for production
 */

const db = require('../config/database');
const logger = require('../config/logger');

const migrations = [
  {
    name: 'Add indexes for performance',
    query: `
      -- Users table indexes
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
      
      -- Feed posts indexes
      CREATE INDEX IF NOT EXISTS idx_feed_posts_user_id ON feed_posts(user_id);
      CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_feed_posts_engagement ON feed_posts(engagement_score DESC);
      CREATE INDEX IF NOT EXISTS idx_feed_posts_composite ON feed_posts(user_id, created_at DESC);
      
      -- Post likes indexes
      CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
      CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
      CREATE INDEX IF NOT EXISTS idx_post_likes_composite ON post_likes(post_id, user_id);
      
      -- Post comments indexes
      CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON post_comments(user_id);
      CREATE INDEX IF NOT EXISTS idx_post_comments_created_at ON post_comments(created_at DESC);
      
      -- Messages indexes
      CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, is_read) WHERE is_read = false;
      
      -- Notifications indexes
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
      
      -- User connections indexes
      CREATE INDEX IF NOT EXISTS idx_user_connections_follower_id ON user_connections(follower_id);
      CREATE INDEX IF NOT EXISTS idx_user_connections_following_id ON user_connections(following_id);
      CREATE INDEX IF NOT EXISTS idx_user_connections_composite ON user_connections(follower_id, following_id);
      
      -- Opportunities indexes
      CREATE INDEX IF NOT EXISTS idx_opportunities_posted_by_user_id ON opportunities(posted_by_user_id);
      CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON opportunities(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_opportunities_type ON opportunities(type);
    `
  },
  {
    name: 'Add soft delete and timestamps',
    query: `
      -- Add deleted_at column for soft deletes
      ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
      ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
      ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
      
      -- Add updated_at column where missing
      ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `
  },
  {
    name: 'Add engagement and feed ranking fields',
    query: `
      -- Add engagement score for feed ranking
      ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;
      ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT false;
      ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
      
      -- Add saved posts feature
      CREATE TABLE IF NOT EXISTS saved_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, post_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_saved_posts_user_id ON saved_posts(user_id);
      CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON saved_posts(post_id);
    `
  },
  {
    name: 'Add hashtags and mentions support',
    query: `
      -- Add hashtags array to posts
      ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS hashtags TEXT[];
      
      -- Create mentions table
      CREATE TABLE IF NOT EXISTS post_mentions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
        mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, mentioned_user_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_post_mentions_post_id ON post_mentions(post_id);
      CREATE INDEX IF NOT EXISTS idx_post_mentions_user_id ON post_mentions(mentioned_user_id);
    `
  },
  {
    name: 'Add message status tracking',
    query: `
      -- Add message status fields
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent';
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
      
      -- Add image support to messages
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT;
      
      -- Update existing messages
      UPDATE messages SET status = 'read' WHERE is_read = true;
      UPDATE messages SET status = 'delivered' WHERE is_read = false AND read_at IS NULL;
    `
  },
  {
    name: 'Ensure notifications table exists',
    query: `
      -- Create notifications table if not exists
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        actor_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        related_id UUID,
        related_type VARCHAR(50),
        action_url TEXT,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
    `
  },
  {
    name: 'Add location-based search for network',
    query: `
      -- Ensure current_city column exists in users table
      ALTER TABLE users ADD COLUMN IF NOT EXISTS current_city VARCHAR(100);
      
      -- Create indexes for location-based search
      CREATE INDEX IF NOT EXISTS idx_users_current_city ON users(current_city) WHERE current_city IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_users_approved_location ON users(current_city) WHERE status = 'approved';
    `
  },
  {
    name: 'Add broadcasts feature for admin messages',
    query: `
      -- Create broadcasts table
      CREATE TABLE IF NOT EXISTS broadcasts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Add broadcast support to messages table
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS broadcast_id UUID REFERENCES broadcasts(id) ON DELETE SET NULL;
      
      -- Add soft delete support to messages
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
      
      -- Create indexes for broadcasts
      CREATE INDEX IF NOT EXISTS idx_broadcasts_admin_id ON broadcasts(admin_id);
      CREATE INDEX IF NOT EXISTS idx_broadcasts_sent_at ON broadcasts(sent_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_broadcast_id ON messages(broadcast_id);
    `
  },
  {
    name: 'Add user bio and location fields',
    query: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
    `
  },
  {
    name: 'Add refresh token support',
    query: `
      -- Create refresh tokens table
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP
      );

      -- Ensure existing deployments have required refresh token fields
      ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;
      ALTER TABLE refresh_tokens ALTER COLUMN token TYPE TEXT;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'refresh_tokens_token_key'
            AND conrelid = 'refresh_tokens'::regclass
        ) THEN
          ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_token_key UNIQUE (token);
        END IF;
      END $$;
      
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

      ALTER TABLE admin_refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;
    `
  },
  {
    name: 'Align schema with API fields',
    query: `
      -- Users table missing fields
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(500);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_profile VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS current_city VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS job_type VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS skills TEXT[];

      -- Messages table missing fields
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent';
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT;

      -- Feed posts missing fields
      ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;
      ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT false;
      ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
      ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS hashtags TEXT[];
      ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

      -- Notifications table missing fields
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(255);
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_id UUID;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_type VARCHAR(50);
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;

      -- Opportunities support tables
      CREATE TABLE IF NOT EXISTS opportunity_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'applied',
        cover_letter TEXT,
        resume_url VARCHAR(500),
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, opportunity_id)
      );
    `
  },
  {
    name: 'Expand profile picture URL length',
    query: `
      ALTER TABLE users
      ALTER COLUMN profile_picture_url TYPE TEXT;
    `
  },
  {
    name: 'Add post shares tracking',
    query: `
      CREATE TABLE IF NOT EXISTS post_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_post_shares_post_id ON post_shares(post_id);
      CREATE INDEX IF NOT EXISTS idx_post_shares_user_id ON post_shares(user_id);
    `
  },
  {
    name: 'Create triggers for automatic timestamp updates',
    query: `
      -- Function to update updated_at timestamp
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      -- Add triggers for tables
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      
      DROP TRIGGER IF EXISTS update_feed_posts_updated_at ON feed_posts;
      CREATE TRIGGER update_feed_posts_updated_at
        BEFORE UPDATE ON feed_posts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      
      DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
      CREATE TRIGGER update_messages_updated_at
        BEFORE UPDATE ON messages
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `
  }
];

async function runMigrations() {
  console.log('🔄 Starting database migrations...\n');
  
  for (const migration of migrations) {
    try {
      console.log(`⏳ Running: ${migration.name}`);
      await db.query(migration.query);
      console.log(`✅ Completed: ${migration.name}\n`);
    } catch (error) {
      console.error(`❌ Failed: ${migration.name}`);
      console.error(error.message);
      console.error('\n');
      // Continue with other migrations even if one fails
    }
  }
  
  console.log('✨ Database migrations completed!\n');
  
  // Print database statistics
  try {
    const stats = await db.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10;
    `);
    
    console.log('📊 Top 10 tables by size:');
    console.table(stats.rows);
  } catch (error) {
    console.error('Could not fetch statistics:', error.message);
  }
  
  process.exit(0);
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigrations };
