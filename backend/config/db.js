const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 10 }
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
  // Run both schema files
  const schemas = ['schema.sql', 'schema_v2.sql'];
  for (const file of schemas) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) continue;
    const schema = fs.readFileSync(filePath, 'utf8');
    try {
      await pool.query(schema);
      console.log(`✅ ${file} initialized`);
    } catch (err) {
      if (!err.message.includes('already exists') &&
          !err.message.includes('duplicate') &&
          !err.message.includes('does not exist')) {
        console.error(`❌ ${file} error:`, err.message);
      } else {
        console.log(`✅ ${file} — tables exist`);
      }
    }
  }
};

module.exports = { pool, initDB };
