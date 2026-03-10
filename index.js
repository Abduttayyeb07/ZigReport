require('dotenv').config();

const { getBot } = require('./src/bot');
const { startScheduler } = require('./src/scheduler');
const { init, query } = require('./src/db');

async function main() {
  // Validate required env vars
  const required = [
    'SSH_HOST', 'SSH_USER', 'SSH_PRIVATE_KEY_PATH',
    'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASS',
    'TELEGRAM_BOT_TOKEN',
  ];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[Init] Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Initialize DB pool + test connection
  try {
    await init();
    const res = await query('SELECT 1 AS ok');
    console.log('[Init] Database connected via SSH tunnel:', res.rows[0]);
  } catch (err) {
    console.error('[Init] Database connection failed:', err.message);
    process.exit(1);
  }

  // Start bot (enables polling + command handlers)
  getBot();

  // Start scheduled reports
  startScheduler();

  console.log('[Init] ZIG Monitor Bot is running');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Shutdown] Received SIGINT, shutting down...');
  const { close } = require('./src/db');
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Shutdown] Received SIGTERM, shutting down...');
  const { close } = require('./src/db');
  await close();
  process.exit(0);
});

// Prevent crashes from unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('[Error] Unhandled rejection:', err);
});

main();
