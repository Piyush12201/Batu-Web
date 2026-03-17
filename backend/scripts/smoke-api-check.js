require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('../config/database');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const SMOKE_USER_EMAIL = 'smoke.user@batu.local';
const SMOKE_USER_PASSWORD = 'User@123';

async function apiRequest(path, options = {}) {
  const response = await fetch(`${BASE_URL}/api${path}`, options);
  const text = await response.text();

  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }

  return { status: response.status, body };
}

async function ensureSmokeUser() {
  const existing = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [SMOKE_USER_EMAIL]);

  let userId;
  if (existing.rows.length === 0) {
    const created = await db.query(
      `INSERT INTO users (
        full_name,
        email,
        mobile_number,
        branch,
        passport_year,
        current_city,
        status,
        id_proof_url,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id`,
      ['Smoke Test User', SMOKE_USER_EMAIL, '9999999999', 'Computer', 2020, 'Pune', 'approved', '/uploads/smoke-id-proof.txt']
    );
    userId = created.rows[0].id;
  } else {
    userId = existing.rows[0].id;
  }

  const passwordHash = await bcrypt.hash(SMOKE_USER_PASSWORD, 10);
  await db.query(
    `INSERT INTO user_auth (user_id, password_hash, is_login_enabled, updated_at)
     VALUES ($1, $2, true, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id)
     DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       is_login_enabled = true,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, passwordHash]
  );

  await db.query(
    'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    ['approved', userId]
  );

  return userId;
}

function assertStatus(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${name} expected ${expected} but got ${actual}`);
  }
}

async function run() {
  console.log('--- API Smoke Check ---');

  const health = await fetch(`${BASE_URL}/api/health`);
  assertStatus('health', health.status, 200);
  console.log('health: 200');

  await ensureSmokeUser();
  console.log('smoke user: ready');

  const userLogin = await apiRequest('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SMOKE_USER_EMAIL, password: SMOKE_USER_PASSWORD }),
  });
  assertStatus('user login', userLogin.status, 200);
  const userAccessToken = userLogin.body.accessToken;
  const userRefreshToken = userLogin.body.refreshToken;
  console.log('user login: 200');

  const userAuthHeaders = { Authorization: `Bearer ${userAccessToken}` };

  const me = await apiRequest('/auth/me', { headers: userAuthHeaders });
  assertStatus('/auth/me', me.status, 200);
  console.log('/auth/me: 200');

  const feed = await apiRequest('/feed/posts?limit=20', { headers: userAuthHeaders });
  assertStatus('/feed/posts', feed.status, 200);
  console.log('/feed/posts: 200');

  const unreadMessages = await apiRequest('/messages/unread/count', { headers: userAuthHeaders });
  assertStatus('/messages/unread/count', unreadMessages.status, 200);
  console.log('/messages/unread/count: 200');

  const unreadNotifications = await apiRequest('/notifications/unread-count', { headers: userAuthHeaders });
  assertStatus('/notifications/unread-count', unreadNotifications.status, 200);
  console.log('/notifications/unread-count: 200');

  const refresh = await apiRequest('/auth/refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: userRefreshToken }),
  });
  assertStatus('/auth/refresh-token', refresh.status, 200);
  console.log('/auth/refresh-token: 200');

  const logout = await apiRequest('/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAccessToken}` },
    body: JSON.stringify({ refreshToken: userRefreshToken }),
  });
  assertStatus('/auth/logout', logout.status, 200);
  console.log('/auth/logout: 200');

  const adminLogin = await apiRequest('/auth/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@batu-alumni.com', password: 'Admin@123' }),
  });
  assertStatus('admin login', adminLogin.status, 200);
  const adminAccessToken = adminLogin.body.accessToken;
  console.log('admin login: 200');

  const adminAuthHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminAccessToken}`,
  };

  const adminStats = await apiRequest('/admin/stats', { headers: adminAuthHeaders });
  assertStatus('/admin/stats', adminStats.status, 200);
  console.log('/admin/stats: 200');

  const broadcast = await apiRequest('/admin/broadcast', {
    method: 'POST',
    headers: adminAuthHeaders,
    body: JSON.stringify({
      title: 'Pre-deploy smoke test',
      message: 'Broadcast endpoint check before deployment.',
    }),
  });
  assertStatus('/admin/broadcast', broadcast.status, 200);
  console.log('/admin/broadcast: 200');

  const broadcasts = await apiRequest('/admin/broadcasts', {
    headers: { Authorization: `Bearer ${adminAccessToken}` },
  });
  assertStatus('/admin/broadcasts', broadcasts.status, 200);
  console.log('/admin/broadcasts: 200');

  console.log('SMOKE RESULT: PASS');
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('SMOKE RESULT: FAIL');
    console.error(error.message);
    process.exit(1);
  });
