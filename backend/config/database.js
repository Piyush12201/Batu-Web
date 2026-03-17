const { Pool } = require('pg');
require('dotenv').config();

const hasConnectionString = Boolean(process.env.DATABASE_URL);
const shouldUseSsl = process.env.DB_SSL === 'true' || /sslmode=require/i.test(process.env.DATABASE_URL || '');

const poolConfig = hasConnectionString
  ? {
      connectionString: process.env.DATABASE_URL
    }
  : {
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'batu_alumni'
    };

if (shouldUseSsl) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
