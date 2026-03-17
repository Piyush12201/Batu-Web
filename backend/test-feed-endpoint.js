const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const login = await post('/api/auth/login', {
    email: 'pratham@gmail.com',
    password: 'Test@123',
  });

  console.log('Login status:', login.status);
  if (login.status !== 200) {
    console.log('Login body:', login.body);
    process.exit(1);
  }

  const loginJson = JSON.parse(login.body);
  const token = loginJson.accessToken;

  const feed = await get('/api/feed/posts?limit=20', token);
  console.log('Feed status:', feed.status);
  console.log('Feed body (first 300 chars):', feed.body.slice(0, 300));
})();
