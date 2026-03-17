const db = require('./config/database');

async function listUsers() {
  try {
    // Get all users
    const result = await db.query(
      `SELECT u.id, u.email, u.full_name, u.status, ua.is_login_enabled 
       FROM users u 
       JOIN user_auth ua ON u.id = ua.user_id
       ORDER BY u.created_at DESC
       LIMIT 20`
    );

    console.log(`✅ Total users: ${result.rows.length}\n`);
    console.log('Users:');
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.full_name} (${user.email})`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Login Enabled: ${user.is_login_enabled}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

listUsers();
