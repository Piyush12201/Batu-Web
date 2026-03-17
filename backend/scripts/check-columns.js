const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

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
