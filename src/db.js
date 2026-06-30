const { Pool } = require('pg');

let pool = null;

async function init() {
  pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: false,
  });

  pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
  });

  return pool;
}

async function query(text, params) {
  if (!pool) throw new Error('Database not initialized. Call init() first.');
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`[DB] Query executed in ${duration}ms — ${result.rowCount} rows`);
  return result;
}

async function close() {
  if (pool) {
    await pool.end();
    console.log('[DB] Pool closed');
  }
}

module.exports = { init, query, close };
