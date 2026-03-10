const cron = require('node-cron');
const { generateWalletReport, generateStakingReport } = require('./reports');
const { broadcastMessage, setLastRun } = require('./bot');

function startScheduler() {
  const walletCron = process.env.WALLET_REPORT_CRON || '0 9 * * *';
  const stakingCron = process.env.STAKING_REPORT_CRON || '5 9 * * *';

  // Report 1 — Wallet Movement Summary
  cron.schedule(walletCron, async () => {
    const timestamp = new Date().toISOString();
    console.log(`[Scheduler] Wallet report triggered at ${timestamp}`);
    try {
      const { message, errors } = await generateWalletReport();
      await broadcastMessage(message);
      for (const err of errors) {
        await broadcastMessage(err);
      }
      setLastRun('wallet');
      console.log(`[Scheduler] Wallet report sent successfully`);
    } catch (err) {
      console.error(`[Scheduler] Wallet report failed:`, err.message);
      try {
        await broadcastMessage(`\u26A0\uFE0F Scheduled wallet report failed: ${err.message}`);
      } catch (_) {
        // Already logged
      }
    }
  }, { timezone: 'UTC' });

  // Report 2 — Staking Activity Tracker
  cron.schedule(stakingCron, async () => {
    const timestamp = new Date().toISOString();
    console.log(`[Scheduler] Staking report triggered at ${timestamp}`);
    try {
      const { message, errors } = await generateStakingReport();
      await broadcastMessage(message);
      for (const err of errors) {
        await broadcastMessage(err);
      }
      setLastRun('staking');
      console.log(`[Scheduler] Staking report sent successfully`);
    } catch (err) {
      console.error(`[Scheduler] Staking report failed:`, err.message);
      try {
        await broadcastMessage(`\u26A0\uFE0F Scheduled staking report failed: ${err.message}`);
      } catch (_) {
        // Already logged
      }
    }
  }, { timezone: 'UTC' });

  console.log(`[Scheduler] Wallet report cron: ${walletCron}`);
  console.log(`[Scheduler] Staking report cron: ${stakingCron}`);
  console.log(`[Scheduler] Scheduler started`);
}

module.exports = { startScheduler };
