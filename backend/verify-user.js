const db = require('./config/database');
const bcrypt = require('bcryptjs');

async function verifyUserPassword() {
  try {
    const email = 'pratham@gmail.com';
    const passwordToTest = 'Test@123';

    // Get user details
    const result = await db.query(
      `SELECT u.id, u.email, u.status, ua.password_hash, ua.is_login_enabled 
       FROM users u 
       JOIN user_auth ua ON u.id = ua.user_id 
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found');
      process.exit(1);
    }

    const user = result.rows[0];
    console.log('User Details:');
    console.log(`  Email: ${user.email}`);
    console.log(`  Status: ${user.status}`);
    console.log(`  Login Enabled: ${user.is_login_enabled}`);
    console.log(`  Has Password Hash: ${!!user.password_hash}`);

    // Test password
    const isPasswordValid = await bcrypt.compare(passwordToTest, user.password_hash);
    console.log(`  Password Valid: ${isPasswordValid}`);

    if (isPasswordValid && user.status === 'approved' && user.is_login_enabled) {
      console.log('\n✅ User is ready to login!');
    } else {
      console.log('\n❌ User cannot login. Issues:');
      if (!isPasswordValid) console.log('  - Password is incorrect');
      if (user.status !== 'approved') console.log(`  - Status is ${user.status}, not approved`);
      if (!user.is_login_enabled) console.log('  - Login not enabled');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

verifyUserPassword();
