const db = require('./db');
const SIGNIFICANT_STAKE_CHANGE_UZIG = 50000 * 1000000;

// Query A — Top 5 Wallets by Balance INCREASE (24h)
async function getTopBalanceIncreases() {
  const sql = `
WITH recent_changes AS (
    SELECT
        account,
        denom,
        SUM(delta) AS net_change,
        COUNT(*) AS tx_count,
        MAX(height) AS last_height
    FROM bank.balance_deltas
    WHERE height > (SELECT MAX(height) - 28000 FROM core.blocks)
      AND denom = 'uzig'
    GROUP BY account, denom
    HAVING SUM(delta) > 0
)
SELECT
    rc.account AS wallet,
    rc.denom,
    rc.net_change / 1000000.0 AS balance_increase_zig,
    rc.tx_count AS transactions,
    COALESCE((SELECT (bc.balances->>rc.denom)::numeric
              FROM bank.balances_current bc
              WHERE bc.account = rc.account
                AND bc.balances ? rc.denom
              LIMIT 1), 0) / 1000000.0 AS current_balance_zig,
    rc.last_height
FROM recent_changes rc
ORDER BY rc.net_change DESC
LIMIT 5;`;
  const result = await db.query(sql);
  return result.rows;
}

// Query B — Top 5 Wallets by Balance DECREASE (24h)
async function getTopBalanceDecreases() {
  const sql = `
WITH recent_changes AS (
    SELECT
        account,
        denom,
        SUM(delta) AS net_change,
        COUNT(*) AS tx_count,
        MAX(height) AS last_height
    FROM bank.balance_deltas
    WHERE height > (SELECT MAX(height) - 28000 FROM core.blocks)
      AND denom = 'uzig'
    GROUP BY account, denom
    HAVING SUM(delta) < 0
)
SELECT
    rc.account AS wallet,
    rc.denom,
    ABS(rc.net_change / 1000000.0) AS balance_decrease_zig,
    rc.tx_count AS transactions,
    COALESCE((SELECT (bc.balances->>rc.denom)::numeric
              FROM bank.balances_current bc
              WHERE bc.account = rc.account
                AND bc.balances ? rc.denom
              LIMIT 1), 0) / 1000000.0 AS current_balance_zig,
    rc.last_height
FROM recent_changes rc
ORDER BY rc.net_change ASC
LIMIT 5;`;
  const result = await db.query(sql);
  return result.rows;
}

// Query C — Net Staking Change Per Wallet (24h)
async function getNetStakingChanges() {
  const sql = `
WITH staking_changes AS (
    SELECT
        delegator_address AS wallet,
        COALESCE(validator_dst, validator_src) AS validator,
        denom,
        SUM(CASE
            WHEN event_type = 'delegate' THEN amount::numeric
            WHEN event_type = 'undelegate' THEN -amount::numeric
            WHEN event_type = 'redelegate' THEN 0
            ELSE 0
        END) AS net_stake_change,
        COUNT(*) FILTER (WHERE event_type = 'delegate') AS stake_count,
        COUNT(*) FILTER (WHERE event_type = 'undelegate') AS unstake_count,
        MAX(height) AS last_height
    FROM stake.delegation_events
    WHERE height > (SELECT MAX(height) - 28000 FROM core.blocks)
      AND denom = 'uzig'
    GROUP BY delegator_address, COALESCE(validator_dst, validator_src), denom
)
SELECT
    wallet,
    validator,
    net_stake_change / 1000000.0 AS net_change_zig,
    stake_count,
    unstake_count,
    CASE
        WHEN net_stake_change > 0 THEN 'INCREASED'
        WHEN net_stake_change < 0 THEN 'DECREASED'
        ELSE 'NEUTRAL'
    END AS direction,
    COALESCE((SELECT SUM(amount::numeric)
              FROM stake.delegations_current dc
              WHERE dc.delegator_address = sc.wallet
                AND dc.denom = sc.denom), 0) / 1000000.0 AS current_total_staked_zig,
    last_height
FROM staking_changes sc
WHERE ABS(net_stake_change) >= ${SIGNIFICANT_STAKE_CHANGE_UZIG}
ORDER BY ABS(net_stake_change) DESC
LIMIT 20;`;
  const result = await db.query(sql);
  return result.rows;
}

// Query D — Total $ZIG Staked Change (24h)
async function getTotalStakingStats() {
  const sql = `
WITH staking_stats AS (
    SELECT
        SUM(CASE WHEN event_type = 'delegate' THEN amount::numeric ELSE 0 END) AS total_staked,
        SUM(CASE WHEN event_type = 'undelegate' THEN amount::numeric ELSE 0 END) AS total_unstaked,
        COUNT(*) FILTER (WHERE event_type = 'delegate') AS stake_events,
        COUNT(*) FILTER (WHERE event_type = 'undelegate') AS unstake_events,
        COUNT(DISTINCT delegator_address) AS unique_stakers,
        COUNT(DISTINCT COALESCE(validator_dst, validator_src)) AS validators_affected
    FROM stake.delegation_events
    WHERE height > (SELECT MAX(height) - 28000 FROM core.blocks)
      AND denom = 'uzig'
)
SELECT
    total_staked / 1000000.0 AS total_staked_zig,
    total_unstaked / 1000000.0 AS total_unstaked_zig,
    (total_staked - total_unstaked) / 1000000.0 AS net_stake_change_zig,
    stake_events,
    unstake_events,
    unique_stakers,
    validators_affected,
    ROUND(((total_staked - total_unstaked) / NULLIF(total_staked, 0) * 100), 2) AS net_change_pct
FROM staking_stats;`;
  const result = await db.query(sql);
  return result.rows[0] || null;
}

// Query E — Largest Single STAKE Event (24h)
async function getLargestStakeEvent() {
  const sql = `
SELECT
    'STAKE' AS event_type,
    delegator_address AS wallet,
    validator_dst AS validator,
    amount::numeric / 1000000.0 AS amount_zig,
    height,
    tx_hash,
    (SELECT time FROM core.blocks WHERE height = se.height) AS timestamp
FROM stake.delegation_events se
WHERE event_type = 'delegate'
  AND height > (SELECT MAX(height) - 28000 FROM core.blocks)
  AND denom = 'uzig'
ORDER BY amount::numeric DESC
LIMIT 1;`;
  const result = await db.query(sql);
  return result.rows[0] || null;
}

// Query F — Largest Single UNSTAKE Event (24h)
async function getLargestUnstakeEvent() {
  const sql = `
SELECT
    'UNSTAKE' AS event_type,
    delegator_address AS wallet,
    validator_src AS validator,
    amount::numeric / 1000000.0 AS amount_zig,
    height,
    tx_hash,
    (SELECT time FROM core.blocks WHERE height = se.height) AS timestamp
FROM stake.delegation_events se
WHERE event_type = 'undelegate'
  AND height > (SELECT MAX(height) - 28000 FROM core.blocks)
  AND denom = 'uzig'
ORDER BY amount::numeric DESC
LIMIT 1;`;
  const result = await db.query(sql);
  return result.rows[0] || null;
}

// Query G — Top Wallets Increasing Stake (24h)
async function getTopStakingIncreases() {
  const sql = `
WITH staking_increases AS (
    SELECT
        delegator_address AS wallet,
        SUM(amount::numeric) AS total_staked,
        COUNT(*) AS stake_transactions,
        COUNT(DISTINCT validator_dst) AS validators_count,
        array_agg(DISTINCT validator_dst) AS validators
    FROM stake.delegation_events
    WHERE event_type = 'delegate'
      AND height > (SELECT MAX(height) - 28000 FROM core.blocks)
      AND denom = 'uzig'
    GROUP BY delegator_address
    HAVING SUM(amount::numeric) > 0
)
SELECT
    wallet,
    total_staked / 1000000.0 AS total_staked_zig,
    stake_transactions,
    validators_count,
    validators,
    COALESCE((SELECT SUM(amount::numeric)
              FROM stake.delegations_current dc
              WHERE dc.delegator_address = si.wallet
                AND dc.denom = 'uzig'), 0) / 1000000.0 AS current_total_staked_zig
FROM staking_increases si
ORDER BY total_staked DESC
LIMIT 10;`;
  const result = await db.query(sql);
  return result.rows;
}

// Query H — Top 5 Wallets by Balance Increase WITH All Token Holdings
async function getTopWalletsWithHoldings() {
  const sql = `
WITH recent_changes AS (
    SELECT
        account,
        denom,
        SUM(delta) AS net_change,
        COUNT(*) AS tx_count
    FROM bank.balance_deltas
    WHERE height > (SELECT MAX(height) - 28000 FROM core.blocks)
      AND denom = 'uzig'
    GROUP BY account, denom
    HAVING SUM(delta) > 0
),
top_wallets AS (
    SELECT account, net_change, tx_count
    FROM recent_changes
    ORDER BY net_change DESC
    LIMIT 5
)
SELECT
    tw.account AS wallet,
    kv.key AS token_denom,
    kv.value::numeric / 1000000.0 AS token_balance,
    tw.net_change / 1000000.0 AS uzig_increase_24h,
    tw.tx_count
FROM top_wallets tw
CROSS JOIN LATERAL (
    SELECT key, value
    FROM bank.balances_current bc,
         jsonb_each_text(bc.balances)
    WHERE bc.account = tw.account
) AS kv
ORDER BY tw.net_change DESC, kv.key;`;
  const result = await db.query(sql);
  return result.rows;
}

module.exports = {
  getTopBalanceIncreases,
  getTopBalanceDecreases,
  getNetStakingChanges,
  getTotalStakingStats,
  getLargestStakeEvent,
  getLargestUnstakeEvent,
  getTopStakingIncreases,
  getTopWalletsWithHoldings,
};
