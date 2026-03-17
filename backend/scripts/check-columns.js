const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const hasConnectionString = Boolean(process.env.DATABASE_URL);
const shouldUseSsl = process.env.DB_SSL === 'true' || /sslmode=require/i.test(process.env.DATABASE_URL || '');

const poolConfig = hasConnectionString
  ? {
      connectionString: process.env.DATABASE_URL,
    }
  : {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
    };

if (shouldUseSsl) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

const query = `
  select column_name
  from information_schema.columns
  where table_name = 'users'
    and column_name in ('profile_picture_url', 'current_city', 'linkedin_profile')
  order by column_name;
`;

pool.query(query)
  .then((res) => {
    console.log(res.rows);
  })
  .catch((err) => {
    console.error(err);
  })
  .finally(() => pool.end());
