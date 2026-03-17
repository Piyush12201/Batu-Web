const db = require('./config/database');

async function testLogin() {
  try {
    // Check if user exists
    const result = await db.query(
      `SELECT u.id, u.email, u.status, ua.is_login_enabled, ua.password_hash 
       FROM users u 
       JOIN user_auth ua ON u.id = ua.user_id 
       WHERE u.email = $1`,
      ['batu@neemx.com']
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found');
      process.exit(1);
    }

    const user = result.rows[0];
    console.log('✅ User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Login Enabled: ${user.is_login_enabled}`);
    console.log(`   Has Password: ${!!user.password_hash}`);

    // Test password verification
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare('User@123', user.password_hash);
    console.log(`   Password Valid: ${isPasswordValid}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testLogin();
