function fmt(num, digits = 2) {
  if (num == null) return '0.00';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtCompact(num) {
  if (num == null) return '0';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(num));
}

function safe(value) {
  return String(value ?? 'unknown')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTokenDenom(denom) {
  const value = String(denom ?? 'unknown');

  if (value.startsWith('coin.zig') && value.includes('.')) {
    return value.split('.').pop();
  }

  if (value.startsWith('ibc/')) {
    const hash = value.slice(4);
    if (hash.length <= 7) return value;
    return `ibc/${hash.slice(0, 3)}...${hash.slice(-4)}`;
  }

  return value;
}

function formatTimestamp(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? safe(value) : safe(date.toLocaleString('en-US', { hour12: true }));
}

function rankBadge(index) {
  const badges = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  return badges[index] || `#${index + 1}`;
}

function renderList(title, rows, emptyText, renderRow) {
  if (!rows || rows.length === 0) {
    return [`${title}`, `<i>${safe(emptyText)}</i>`].join('\n\n');
  }

  const blocks = rows.map((row, index) => renderRow(row, index)).join('\n\n');
  return [`${title}`, blocks].join('\n\n');
}

function formatBalanceIncreases(increases) {
  return renderList(
    '📈 <b>Top 5 Wallet Balance Increases</b>',
    increases,
    'No balance increases in the last 24h.',
    (row, index) => [
      `${rankBadge(index)} <b>+${fmt(row.balance_increase_zig)} ZIG</b>`,
      `<code>${safe(row.wallet)}</code>`,
      `• Transactions: <b>${safe(row.transactions)}</b>`,
      `• Balance: <b>${fmt(row.current_balance_zig)} ZIG</b>`,
    ].join('\n'),
  );
}

function formatBalanceDecreases(decreases) {
  return renderList(
    '📉 <b>Top 5 Wallet Balance Decreases</b>',
    decreases,
    'No balance decreases in the last 24h.',
    (row, index) => [
      `${rankBadge(index)} <b>-${fmt(row.balance_decrease_zig)} ZIG</b>`,
      `<code>${safe(row.wallet)}</code>`,
      `• Transactions: <b>${safe(row.transactions)}</b>`,
      `• Balance: <b>${fmt(row.current_balance_zig)} ZIG</b>`,
    ].join('\n'),
  );
}

function formatNetStakingIncreases(stakingChanges) {
  const rows = (stakingChanges || []).filter((row) => row.direction === 'INCREASED').slice(0, 5);
  return renderList(
    '🚀 <b>Top Staking Increases (Per Wallet)</b>',
    rows,
    'No staking increases in the last 24h.',
    (row, index) => [
      `${rankBadge(index)} <b>+${fmt(row.net_change_zig)} ZIG</b>`,
      `<code>${safe(row.wallet)}</code>`,
      `• Validator: <code>${safe(row.validator)}</code>`,
      `• Total Staked: <b>${fmt(row.current_total_staked_zig)} ZIG</b>`,
      `• Activity: <b>${safe(row.stake_count || 0)}</b> stake | <b>${safe(row.unstake_count || 0)}</b> unstake`,
    ].join('\n'),
  );
}

function formatNetUnstakes(stakingChanges) {
  const rows = (stakingChanges || []).filter((row) => row.direction === 'DECREASED').slice(0, 10);
  return renderList(
    '📤 <b>Top Unstakes (Per Wallet)</b>',
    rows,
    'No unstaking activity in the last 24h.',
    (row, index) => [
      `${rankBadge(index)} <b>-${fmt(Math.abs(row.net_change_zig))} ZIG</b>`,
      `<code>${safe(row.wallet)}</code>`,
      `• Validator: <code>${safe(row.validator)}</code>`,
      `• Remaining Staked: <b>${fmt(row.current_total_staked_zig)} ZIG</b>`,
      `• Activity: <b>${safe(row.stake_count || 0)}</b> stake | <b>${safe(row.unstake_count || 0)}</b> unstake`,
    ].join('\n'),
  );
}

function formatStakingSummary(stats) {
  if (!stats) {
    return '🧮 <b>Total ZIG Staked vs Unstaked</b>\n\n<i>No staking data available.</i>';
  }

  const netValue = Number(stats.net_stake_change_zig || 0);
  const netPrefix = netValue >= 0 ? '+' : '';
  return [
    '🧮 <b>Total ZIG Staked vs Unstaked</b>',
    '',
    `📥 Staked: <b>+${fmt(stats.total_staked_zig)} ZIG</b>`,
    `📤 Unstaked: <b>-${fmt(stats.total_unstaked_zig)} ZIG</b>`,
    `⚖️ Net Change: <b>${netPrefix}${fmt(stats.net_stake_change_zig)} ZIG</b>`,
    `📊 Net Ratio: <b>${safe(stats.net_change_pct || '0.00')}%</b>`,
    `👛 Total Wallet Stakes: <b>${safe(stats.stake_events || 0)}</b>`,
    `👛 Total Wallet Unstakes: <b>${safe(stats.unstake_events || 0)}</b>`,
    `👥 Unique Stakers: <b>${safe(stats.unique_stakers || 0)}</b>`,
    `🏛️ Validators Affected: <b>${safe(stats.validators_affected || 0)}</b>`,
  ].join('\n');
}

function formatLargestStake(largestStake) {
  if (!largestStake) {
    return '⚡ <b>Largest Single Stake Event</b>\n\n<i>No stake events in the last 24h.</i>';
  }

  return [
    '⚡ <b>Largest Single Stake Event</b>',
    '',
    `💥 <b>${fmt(largestStake.amount_zig)} ZIG</b>`,
    `<code>${safe(largestStake.wallet)}</code>`,
    `• Validator: <code>${safe(largestStake.validator)}</code>`,
    `• Time: <b>${formatTimestamp(largestStake.timestamp)}</b>`,
    `• TX: <code>${safe(largestStake.tx_hash || 'N/A')}</code>`,
  ].join('\n');
}

function formatLargestUnstake(largestUnstake) {
  if (!largestUnstake) {
    return '⚡ <b>Largest Single Unstake Event</b>\n\n<i>No unstake events in the last 24h.</i>';
  }

  return [
    '⚡ <b>Largest Single Unstake Event</b>',
    '',
    `💥 <b>${fmt(largestUnstake.amount_zig)} ZIG</b>`,
    `<code>${safe(largestUnstake.wallet)}</code>`,
    `• Validator: <code>${safe(largestUnstake.validator)}</code>`,
    `• Time: <b>${formatTimestamp(largestUnstake.timestamp)}</b>`,
    `• TX: <code>${safe(largestUnstake.tx_hash || 'N/A')}</code>`,
  ].join('\n');
}

function formatTopStakingIncreases(topStakers) {
  return renderList(
    '🏆 <b>Top Wallets Increasing Stake</b>',
    (topStakers || []).slice(0, 5),
    'No staking increases in the last 24h.',
    (row, index) => [
      `${rankBadge(index)} <code>${safe(row.wallet)}</code>`,
      `➕ <b>${fmt(row.total_staked_zig)} ZIG</b> | <b>${safe(row.stake_transactions)}</b> txns`,
      `🏛️ Validators: <b>${safe(row.validators_count)}</b>`,
      `💰 Total Staked: <b>${fmt(row.current_total_staked_zig)} ZIG</b>`,
      `📦 Wallet Size: <b>${fmtCompact(row.current_total_staked_zig)} ZIG</b>`,
    ].join('\n'),
  );
}

function formatWalletHoldings(holdings) {
  if (!holdings || holdings.length === 0) {
    return '🪙 <b>Top Wallet Holdings</b>\n\n<i>No wallet holdings available.</i>';
  }

  const grouped = new Map();
  for (const row of holdings) {
    if (!grouped.has(row.wallet)) {
      grouped.set(row.wallet, {
        increase: row.uzig_increase_24h,
        txCount: row.tx_count,
        tokens: [],
      });
    }
    grouped.get(row.wallet).tokens.push(`${safe(formatTokenDenom(row.token_denom))}: <b>${fmt(row.token_balance)}</b>`);
  }

  const rows = Array.from(grouped.entries()).map(([wallet, data]) => ({
    wallet,
    increase: data.increase,
    txCount: data.txCount,
    holdings: data.tokens.join(' | '),
  }));

  return renderList(
    '🪙 <b>Top Wallet Holdings</b>',
    rows,
    'No wallet holdings available.',
    (row, index) => [
      `${rankBadge(index)} <code>${safe(row.wallet)}</code>`,
      `➕ 24h Increase: <b>${fmt(row.increase)} ZIG</b> | <b>${safe(row.txCount)}</b> txns`,
      `📦 Holdings: ${row.holdings}`,
    ].join('\n'),
  );
}

function joinSections(title, sections) {
  return [`${title}`, ...sections.filter(Boolean)].join('\n\n');
}

function formatWalletReport(increases, decreases, stakingChanges, holdings) {
  return joinSections('📊 <b>Top Wallet Movement | 24h Summary</b>', [
    formatBalanceIncreases(increases),
    formatBalanceDecreases(decreases),
    formatNetStakingIncreases(stakingChanges),
    formatNetUnstakes(stakingChanges),
    formatWalletHoldings(holdings),
  ]);
}

function formatStakingReport(stats, largestStake, largestUnstake, topStakers) {
  return joinSections('🥩 <b>Staking Activity | 24h Summary</b>', [
    formatStakingSummary(stats),
    formatLargestStake(largestStake),
    formatLargestUnstake(largestUnstake),
    formatTopStakingIncreases(topStakers),
  ]);
}

module.exports = {
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
};
