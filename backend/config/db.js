const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'hellocoolie',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
      }
);

const initDB = async () => {
  const fs = require('fs');
  const path = require('path');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(schema);
    console.log('✅ DB schema initialized');
  } catch (err) {
    // Tables may already exist — check for critical errors only
    if (!err.message.includes('already exists')) {
      console.error('❌ DB init error:', err.message);
    } else {
      console.log('✅ DB tables already exist');
    }
  }
};

module.exports = { pool, initDB };
