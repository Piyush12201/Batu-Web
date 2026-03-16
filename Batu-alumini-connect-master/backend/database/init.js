const db = require('../config/database');

const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing database schema...');

    // Create users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        mobile_number VARCHAR(20) NOT NULL,
        branch VARCHAR(100) NOT NULL,
        passport_year INTEGER NOT NULL,
        current_city VARCHAR(100) NOT NULL,
        linkedin_profile VARCHAR(255),
        job_type VARCHAR(100),
        sector VARCHAR(100),
        company_name VARCHAR(255),
        designation VARCHAR(100),
        years_of_experience INTEGER,
        skills TEXT[],
        id_proof_url VARCHAR(500),
        profile_picture_url VARCHAR(500),
        status VARCHAR(20) DEFAULT 'pending_approval',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created');

    // Create authentication table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_auth (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        password_hash VARCHAR(255) NOT NULL,
        login_id VARCHAR(100) UNIQUE,
        generated_password VARCHAR(100),
        is_login_enabled BOOLEAN DEFAULT false,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ User Authentication table created');

    // Create admin table
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Admin Users table created');

    // Create admin verification log table
    await db.query(`
      CREATE TABLE IF NOT EXISTS verification_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        admin_id UUID REFERENCES admin_users(id),
        action VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Verification Logs table created');

    // Create refresh tokens table
    await db.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Refresh Tokens table created');

    // Create admin refresh tokens table
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        token VARCHAR(500) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Admin Refresh Tokens table created');

    // Create feed posts table
    await db.query(`
      CREATE TABLE IF NOT EXISTS feed_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        image_url VARCHAR(500),
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        shares_count INTEGER DEFAULT 0,
        is_pinned BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Feed Posts table created');

    // Create post likes table
    await db.query(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      );
    `);
    console.log('✅ Post Likes table created');

    // Create post comments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS post_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Post Comments table created');

    // Create opportunities table
    await db.query(`
      CREATE TABLE IF NOT EXISTS opportunities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        location VARCHAR(100) NOT NULL,
        salary_range VARCHAR(100),
        experience_required VARCHAR(100) NOT NULL,
        skills_required TEXT[],
        application_deadline DATE,
        is_active BOOLEAN DEFAULT true,
        posted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Opportunities table created');

    // Create opportunity applications table
    await db.query(`
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
    `);
    console.log('✅ Opportunity Applications table created');

    // Create bookmarks table
    await db.query(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, opportunity_id)
      );
    `);
    console.log('✅ Bookmarks table created');

    // Create help desk posts table
    await db.query(`
      CREATE TABLE IF NOT EXISTS help_desk_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'open',
        is_asking BOOLEAN NOT NULL,
        responses_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Help Desk Posts table created');

    // Create help desk responses table
    await db.query(`
      CREATE TABLE IF NOT EXISTS help_desk_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES help_desk_posts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_solution_accepted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Help Desk Responses table created');

    // Create user connections table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'connected',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id)
      );
    `);
    console.log('✅ User Connections table created');

    // Create search history table
    await db.query(`
      CREATE TABLE IF NOT EXISTS search_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        search_query VARCHAR(255) NOT NULL,
        search_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Search History table created');

    // Create broadcasts table (must be before messages table)
    await db.query(`
      CREATE TABLE IF NOT EXISTS broadcasts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Broadcasts table created');

    // Create messages table
    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        image_url VARCHAR(500),
        broadcast_id UUID REFERENCES broadcasts(id) ON DELETE SET NULL,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Messages table created');

    // Create conversations table (for group chats if needed later)
    await db.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255),
        is_group BOOLEAN DEFAULT false,
        created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Conversations table created');

    // Create conversation participants table
    await db.query(`
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(conversation_id, user_id)
      );
    `);
    console.log('✅ Conversation Participants table created');

    // Create notifications table
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        related_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        related_post_id UUID REFERENCES feed_posts(id) ON DELETE SET NULL,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Notifications table created');

    // Create default admin user if not exists
    const adminEmail = 'admin@batu-alumni.com';
    const bcrypt = require('bcryptjs');
    
    const adminExists = await db.query('SELECT id FROM admin_users WHERE email = $1', [adminEmail]);
    
    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      await db.query(
        'INSERT INTO admin_users (email, password_hash, name) VALUES ($1, $2, $3)',
        [adminEmail, hashedPassword, 'System Admin']
      );
      console.log('✅ Default admin user created');
      console.log('   Email: admin@batu-alumni.com');
      console.log('   Password: Admin@123');
    }

    console.log('✨ Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    process.exit(1);
  }
};

module.exports = initializeDatabase;
