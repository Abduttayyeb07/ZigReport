const queries = require('./queries');
const {
  formatWalletReport,
  formatStakingReport,
  formatBalanceIncreases,
  formatBalanceDecreases,
  formatNetStakingIncreases,
  formatNetUnstakes,
  formatStakingSummary,
  formatLargestStake,
  formatLargestUnstake,
  formatTopStakingIncreases,
  formatWalletHoldings,
} = require('./formatters');

async function safeQuery(name, queryFn) {
  try {
    return { data: await queryFn(), error: null };
  } catch (err) {
    console.error(`[Report] Query ${name} failed:`, err.message);
    return { data: null, error: `Query ${name} failed: ${err.message}` };
  }
}

function collectErrors(results) {
  return results.filter((result) => result.error).map((result) => `⚠️ ${result.error}`);
}

async function generateWalletReport() {
  const [a, b, c, h] = await Promise.all([
    safeQuery('A (Balance Increases)', queries.getTopBalanceIncreases),
    safeQuery('B (Balance Decreases)', queries.getTopBalanceDecreases),
    safeQuery('C (Staking Changes)', queries.getNetStakingChanges),
    safeQuery('H (Wallet Holdings)', queries.getTopWalletsWithHoldings),
  ]);

  return {
    message: formatWalletReport(a.data, b.data, c.data, h.data),
    errors: collectErrors([a, b, c, h]),
  };
}

async function generateStakingReport() {
  const [d, e, f, g] = await Promise.all([
    safeQuery('D (Staking Stats)', queries.getTotalStakingStats),
    safeQuery('E (Largest Stake)', queries.getLargestStakeEvent),
    safeQuery('F (Largest Unstake)', queries.getLargestUnstakeEvent),
    safeQuery('G (Top Stakers)', queries.getTopStakingIncreases),
  ]);

  return {
    message: formatStakingReport(d.data, e.data, f.data, g.data),
    errors: collectErrors([d, e, f, g]),
  };
}

async function generateBalanceIncreasesReport() {
  const result = await safeQuery('A (Balance Increases)', queries.getTopBalanceIncreases);
  return { message: formatBalanceIncreases(result.data), errors: collectErrors([result]) };
}

async function generateBalanceDecreasesReport() {
  const result = await safeQuery('B (Balance Decreases)', queries.getTopBalanceDecreases);
  return { message: formatBalanceDecreases(result.data), errors: collectErrors([result]) };
}

async function generateNetStakingIncreasesReport() {
  const result = await safeQuery('C (Staking Changes)', queries.getNetStakingChanges);
  return { message: formatNetStakingIncreases(result.data), errors: collectErrors([result]) };
}

async function generateNetUnstakesReport() {
  const result = await safeQuery('C (Staking Changes)', queries.getNetStakingChanges);
  return { message: formatNetUnstakes(result.data), errors: collectErrors([result]) };
}

async function generateStakingSummaryReport() {
  const result = await safeQuery('D (Staking Stats)', queries.getTotalStakingStats);
  return { message: formatStakingSummary(result.data), errors: collectErrors([result]) };
}

async function generateLargestStakeReport() {
  const result = await safeQuery('E (Largest Stake)', queries.getLargestStakeEvent);
  return { message: formatLargestStake(result.data), errors: collectErrors([result]) };
}

async function generateLargestUnstakeReport() {
  const result = await safeQuery('F (Largest Unstake)', queries.getLargestUnstakeEvent);
  return { message: formatLargestUnstake(result.data), errors: collectErrors([result]) };
}

async function generateTopStakingIncreasesReport() {
  const result = await safeQuery('G (Top Stakers)', queries.getTopStakingIncreases);
  return { message: formatTopStakingIncreases(result.data), errors: collectErrors([result]) };
}

async function generateWalletHoldingsReport() {
  const result = await safeQuery('H (Wallet Holdings)', queries.getTopWalletsWithHoldings);
  return { message: formatWalletHoldings(result.data), errors: collectErrors([result]) };
}

module.exports = {
  generateWalletReport,
  generateStakingReport,
  generateBalanceIncreasesReport,
  generateBalanceDecreasesReport,
  generateNetStakingIncreasesReport,
  generateNetUnstakesReport,
  generateStakingSummaryReport,
  generateLargestStakeReport,
  generateLargestUnstakeReport,
  generateTopStakingIncreasesReport,
  generateWalletHoldingsReport,
};
