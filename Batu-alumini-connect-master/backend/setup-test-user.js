const db = require('./config/database');
const bcrypt = require('bcryptjs');

async function setUserPassword() {
  try {
    const email = 'pratham@gmail.com';
    const newPassword = 'Test@123'; // Default test password

    // Hash the password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password for the user
    const result = await db.query(
      `UPDATE user_auth 
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = (SELECT id FROM users WHERE email = $2)
       RETURNING user_id`,
      [passwordHash, email]
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('✅ Password set successfully!');
    console.log(`\nTest Credentials:`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${newPassword}`);
    console.log(`\nStatus: approved ✓`);
    console.log(`Login Enabled: true ✓`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

setUserPassword();
