const db = require('./config/database');
const bcrypt = require('bcryptjs');

async function testLogin() {
  try {
    // Get a test user
    const result = await db.query(
      `SELECT u.id, u.email, u.status, ua.is_login_enabled, ua.password_hash 
       FROM users u 
       JOIN user_auth ua ON u.id = ua.user_id 
       WHERE u.status = 'approved'
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      console.log('❌ No approved users found');
      process.exit(1);
    }

    const user = result.rows[0];
    console.log('Testing with approved user:');
    console.log(`Email: ${user.email}`);
    console.log(`Status: ${user.status}`);
    console.log(`Login Enabled: ${user.is_login_enabled}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testLogin();
