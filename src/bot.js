const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const {
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
} = require('./reports');

const SUBSCRIBERS_FILE = path.join(__dirname, '..', 'subscribers.json');

const REPORT_HANDLERS = {
  full_wallet: generateWalletReport,
  full_staking: generateStakingReport,
  balance_increases: generateBalanceIncreasesReport,
  balance_decreases: generateBalanceDecreasesReport,
  net_staking_increases: generateNetStakingIncreasesReport,
  net_unstakes: generateNetUnstakesReport,
  staking_summary: generateStakingSummaryReport,
  largest_stake: generateLargestStakeReport,
  largest_unstake: generateLargestUnstakeReport,
  top_stakers: generateTopStakingIncreasesReport,
  wallet_holdings: generateWalletHoldingsReport,
};

const BOT_COMMANDS = [
  { command: 'start', description: 'Open the command panel' },
  { command: 'menu', description: 'Show report buttons' },
  { command: 'increases', description: 'Top wallet balance increases' },
  { command: 'decreases', description: 'Top wallet balance decreases' },
  { command: 'stake_up', description: 'Significant staking increases' },
  { command: 'unstakes', description: 'Significant unstake activity' },
  { command: 'net_flow', description: 'Staked vs unstaked totals' },
  { command: 'max_stake', description: 'Largest single stake event' },
  { command: 'max_unstake', description: 'Largest single unstake event' },
  { command: 'top_stakers', description: 'Top wallets increasing stake' },
  { command: 'status', description: 'Check bot uptime and report status' },
  { command: 'stop', description: 'Unsubscribe from scheduled reports' },
];

let bot;
let launched = false;
const lastRun = {
  wallet: null,
  staking: null,
};

function loadSubscribers() {
  try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
      return new Set(data);
    }
  } catch (err) {
    console.error('[Bot] Failed to load subscribers:', err.message);
  }
  return new Set();
}

function saveSubscribers(subs) {
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify([...subs]), 'utf8');
}

const subscribers = loadSubscribers();

function addSubscriber(chatId) {
  if (!subscribers.has(chatId)) {
    subscribers.add(chatId);
    saveSubscribers(subscribers);
    console.log(`[Bot] New subscriber: ${chatId} (total: ${subscribers.size})`);
    return true;
  }
  return false;
}

function removeSubscriber(chatId) {
  if (subscribers.has(chatId)) {
    subscribers.delete(chatId);
    saveSubscribers(subscribers);
    console.log(`[Bot] Unsubscribed: ${chatId} (total: ${subscribers.size})`);
    return true;
  }
  return false;
}

function getSubscribers() {
  return [...subscribers];
}

function getMenuText() {
  return [
    'Select an option below to continue.',
    '',
    '<b>📡 ZIG Monitor Command Panel</b>',
    '',
    '• 🟢 Balance Increases (24h): Top 5 wallets with the biggest ZIG accumulation.',
    '• 🔴 Balance Decreases (24h): Top 5 wallets with the biggest ZIG outflow.',
    '• 📈 Staking Increases (24h): Wallets with significant net stake growth.',
    '• 📉 Unstakes (24h): Wallets with significant net unstake activity.',
    '• 🧮 Staked vs Unstaked (24h): Total stake, unstake, net change, and wallet counts.',
    '• ⚡ Largest Stake (24h): Biggest single stake event in the last 24 hours.',
    '• ⚡ Largest Unstake (24h): Biggest single unstake event in the last 24 hours.',
    '• 🏆 Top Wallets Stake (24h): Wallets with the highest total stake added.',
  ].join('\n');
}

function getMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🟢 Balance Increases (24h)', 'report:balance_increases'),
      Markup.button.callback('🔴 Balance Decreases (24h)', 'report:balance_decreases'),
    ],
    [
      Markup.button.callback('📈 Staking Increases (24h)', 'report:net_staking_increases'),
      Markup.button.callback('📉 Unstakes (24h)', 'report:net_unstakes'),
    ],
    [
      Markup.button.callback('🧮 Staked vs Unstaked (24h)', 'report:staking_summary'),
      Markup.button.callback('⚡ Largest Stake (24h)', 'report:largest_stake'),
    ],
    [
      Markup.button.callback('⚡ Largest Unstake (24h)', 'report:largest_unstake'),
      Markup.button.callback('🏆 Top Wallets Stake (24h)', 'report:top_stakers'),
    ],
  ]);
}

async function sendMenu(chatId, text = getMenuText()) {
  const currentBot = getBot();
  await currentBot.telegram.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    ...getMenuKeyboard(),
  });
}

function getBot() {
  if (!bot) {
    bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    registerCommands(bot);
    registerBotShortcuts(bot);
    if (!launched) {
      bot.launch().then(() => {
        console.log('[Bot] Telegram bot started with polling');
      }).catch((err) => {
        console.error('[Bot] Failed to launch bot:', err.message);
      });
      launched = true;
    }
  }
  return bot;
}

function registerBotShortcuts(currentBot) {
  currentBot.telegram.setMyCommands(BOT_COMMANDS)
    .then(() => {
      console.log('[Bot] Telegram command shortcuts registered');
    })
    .catch((err) => {
      console.error('[Bot] Failed to register Telegram commands:', err.message);
    });
}

function getChatId(ctx) {
  return ctx.chat?.id;
}

function registerCommands(currentBot) {
  currentBot.command('start', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    addSubscriber(chatId);
    await sendMenu(chatId);
  });

  currentBot.command('menu', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    await sendMenu(chatId);
  });

  currentBot.command('reports', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    await sendMenu(chatId);
  });

  currentBot.command('stop', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    const removed = removeSubscriber(chatId);
    const text = removed
      ? '<b>Unsubscribed.</b> Send /start if you want scheduled reports again.'
      : 'You are not subscribed. Send /start to subscribe.';
    await currentBot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
  });

  currentBot.command('wallet_report', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    await sendReportByKey(chatId, 'full_wallet');
    setLastRun('wallet');
  });

  currentBot.command('staking_report', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    await sendReportByKey(chatId, 'full_staking');
    setLastRun('staking');
  });

  currentBot.command('increases', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    await sendReportByKey(chatId, 'balance_increases');
  });

  currentBot.command('decreases', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    await sendReportByKey(chatId, 'balance_decreases');
  });

  currentBot.command('stake_up', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    await sendReportByKey(chatId, 'net_staking_increases');
  });

  currentBot.command('unstakes', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    await sendReportByKey(chatId, 'net_unstakes');
  });

  currentBot.command('net_flow', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    await sendReportByKey(chatId, 'staking_summary');
  });

  currentBot.command('max_stake', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    await sendReportByKey(chatId, 'largest_stake');
  });

  currentBot.command('max_unstake', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    await sendReportByKey(chatId, 'largest_unstake');
  });

  currentBot.command('top_stakers', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    await sendReportByKey(chatId, 'top_stakers');
  });

  currentBot.command('status', async (ctx) => {
    const chatId = getChatId(ctx);
    if (!chatId) return;
    const walletTime = lastRun.wallet ? lastRun.wallet.toISOString() : 'Never';
    const stakingTime = lastRun.staking ? lastRun.staking.toISOString() : 'Never';
    const statusMsg = [
      '<b>Bot Status</b>',
      `Last Wallet Report: <code>${walletTime}</code>`,
      `Last Staking Report: <code>${stakingTime}</code>`,
      `Subscribers: ${subscribers.size}`,
      `Uptime: ${formatUptime(process.uptime())}`,
    ].join('\n');
    await currentBot.telegram.sendMessage(chatId, statusMsg, { parse_mode: 'HTML' });
  });

  currentBot.action(/report:(.+)/, async (ctx) => {
    const chatId = getChatId(ctx);
    const key = ctx.match[1];
    await ctx.answerCbQuery('Loading report...');
    if (!chatId) return;
    await sendReportByKey(chatId, key);
  });
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

async function sendToChat(chatId, text, options = {}) {
  const currentBot = getBot();
  const baseOptions = {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...options,
  };

  try {
    const chunks = splitMessage(text);
    for (let index = 0; index < chunks.length; index += 1) {
      const sendOptions = index === 0 ? baseOptions : { ...baseOptions, reply_markup: undefined };
      await currentBot.telegram.sendMessage(chatId, chunks[index], sendOptions);
    }
  } catch (err) {
    console.error(`[Bot] Send to ${chatId} failed, retrying in 30s:`, err.message);
    await new Promise((resolve) => setTimeout(resolve, 30000));
    try {
      const chunks = splitMessage(text);
      for (let index = 0; index < chunks.length; index += 1) {
        const sendOptions = index === 0 ? baseOptions : { ...baseOptions, reply_markup: undefined };
        await currentBot.telegram.sendMessage(chatId, chunks[index], sendOptions);
      }
    } catch (retryErr) {
      console.error(`[Bot] Retry to ${chatId} also failed:`, retryErr.message);
    }
  }
}

function splitMessage(text, maxLength = 3500) {
  if (!text || text.length <= maxLength) {
    return [text];
  }

  const lines = text.split('\n');
  const chunks = [];
  let current = '';

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (line.length <= maxLength) {
      current = line;
      continue;
    }

    let start = 0;
    while (start < line.length) {
      chunks.push(line.slice(start, start + maxLength));
      start += maxLength;
    }
    current = '';
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

async function sendReportByKey(chatId, key) {
  const handler = REPORT_HANDLERS[key];
  if (!handler) {
    await sendToChat(chatId, 'Unknown report requested.');
    await sendMenu(chatId);
    return;
  }

  try {
    const { message, errors } = await handler();
    await sendToChat(chatId, message);
    for (const err of errors) {
      await sendToChat(chatId, err);
    }
    await sendMenu(chatId);
  } catch (err) {
    console.error(`[Bot] Report ${key} error:`, err.message);
    await sendToChat(chatId, `⚠️ Report failed: ${err.message}`);
    await sendMenu(chatId);
  }
}

async function broadcastMessage(text) {
  const chatIds = getSubscribers();
  if (chatIds.length === 0) {
    console.log('[Bot] No subscribers to broadcast to');
    return;
  }

  console.log(`[Bot] Broadcasting to ${chatIds.length} subscribers`);
  for (const chatId of chatIds) {
    await sendToChat(chatId, text);
  }
}

function setLastRun(report) {
  lastRun[report] = new Date();
}

module.exports = { getBot, sendToChat, sendMenu, broadcastMessage, setLastRun, getSubscribers };
