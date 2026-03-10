const TelegramBot = require('node-telegram-bot-api');
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

let bot;
const lastRun = {
  wallet: null,
  staking: null,
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
  return {
    inline_keyboard: [
      [
        { text: '🟢 Balance Increases (24h)', callback_data: 'report:balance_increases' },
        { text: '🔴 Balance Decreases (24h)', callback_data: 'report:balance_decreases' },
      ],
      [
        { text: '📈 Staking Increases (24h)', callback_data: 'report:net_staking_increases' },
        { text: '📉 Unstakes (24h)', callback_data: 'report:net_unstakes' },
      ],
      [
        { text: '🧮 Staked vs Unstaked (24h)', callback_data: 'report:staking_summary' },
        { text: '⚡ Largest Stake (24h)', callback_data: 'report:largest_stake' },
      ],
      [
        { text: '⚡ Largest Unstake (24h)', callback_data: 'report:largest_unstake' },
        { text: '🏆 Top Wallets Stake (24h)', callback_data: 'report:top_stakers' },
      ],
    ],
  };
}

async function sendMenu(chatId, text = getMenuText()) {
  const b = getBot();
  await b.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: getMenuKeyboard(),
  });
}

function getBot() {
  if (!bot) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    registerCommands(bot);
    registerBotShortcuts(bot);
    console.log('[Bot] Telegram bot started with polling');
  }
  return bot;
}

function registerBotShortcuts(currentBot) {
  currentBot.setMyCommands(BOT_COMMANDS)
    .then(() => {
      console.log('[Bot] Telegram command shortcuts registered');
    })
    .catch((err) => {
      console.error('[Bot] Failed to register Telegram commands:', err.message);
    });
}

function registerCommands(currentBot) {
  currentBot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    addSubscriber(chatId);
    await sendMenu(chatId);
  });

  currentBot.onText(/\/menu|\/reports/, async (msg) => {
    await sendMenu(msg.chat.id);
  });

  currentBot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    const removed = removeSubscriber(chatId);
    const text = removed
      ? '<b>Unsubscribed.</b> Send /start if you want scheduled reports again.'
      : 'You are not subscribed. Send /start to subscribe.';
    await currentBot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  });

  currentBot.onText(/\/wallet_report/, async (msg) => {
    await sendReportByKey(msg.chat.id, 'full_wallet');
    setLastRun('wallet');
  });

  currentBot.onText(/\/staking_report/, async (msg) => {
    await sendReportByKey(msg.chat.id, 'full_staking');
    setLastRun('staking');
  });

  currentBot.onText(/\/increases/, async (msg) => {
    await sendReportByKey(msg.chat.id, 'balance_increases');
  });

  currentBot.onText(/\/decreases/, async (msg) => {
    await sendReportByKey(msg.chat.id, 'balance_decreases');
  });

  currentBot.onText(/\/stake_up/, async (msg) => {
    await sendReportByKey(msg.chat.id, 'net_staking_increases');
  });

  currentBot.onText(/\/unstakes/, async (msg) => {
    await sendReportByKey(msg.chat.id, 'net_unstakes');
  });

  currentBot.onText(/\/net_flow/, async (msg) => {
    await sendReportByKey(msg.chat.id, 'staking_summary');
  });

  currentBot.onText(/\/max_stake/, async (msg) => {
    await sendReportByKey(msg.chat.id, 'largest_stake');
  });

  currentBot.onText(/\/max_unstake/, async (msg) => {
    await sendReportByKey(msg.chat.id, 'largest_unstake');
  });

  currentBot.onText(/\/top_stakers/, async (msg) => {
    await sendReportByKey(msg.chat.id, 'top_stakers');
  });

  currentBot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const walletTime = lastRun.wallet ? lastRun.wallet.toISOString() : 'Never';
    const stakingTime = lastRun.staking ? lastRun.staking.toISOString() : 'Never';

    const statusMsg = [
      '<b>Bot Status</b>',
      `Last Wallet Report: <code>${walletTime}</code>`,
      `Last Staking Report: <code>${stakingTime}</code>`,
      `Subscribers: ${subscribers.size}`,
      `Uptime: ${formatUptime(process.uptime())}`,
    ].join('\n');

    await currentBot.sendMessage(chatId, statusMsg, { parse_mode: 'HTML' });
  });

  currentBot.on('callback_query', async (query) => {
    const chatId = query.message?.chat?.id;
    const data = query.data || '';

    if (!chatId || !data.startsWith('report:')) {
      await currentBot.answerCallbackQuery(query.id);
      return;
    }

    const key = data.replace('report:', '');
    await currentBot.answerCallbackQuery(query.id, { text: 'Loading report...' });
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
  const b = getBot();
  const baseOptions = {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...options,
  };

  try {
    const chunks = splitMessage(text);
    for (let index = 0; index < chunks.length; index += 1) {
      const sendOptions = index === 0 ? baseOptions : { ...baseOptions, reply_markup: undefined };
      await b.sendMessage(chatId, chunks[index], sendOptions);
    }
  } catch (err) {
    console.error(`[Bot] Send to ${chatId} failed, retrying in 30s:`, err.message);
    await new Promise((resolve) => setTimeout(resolve, 30000));
    try {
      const chunks = splitMessage(text);
      for (let index = 0; index < chunks.length; index += 1) {
        const sendOptions = index === 0 ? baseOptions : { ...baseOptions, reply_markup: undefined };
        await b.sendMessage(chatId, chunks[index], sendOptions);
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
    return;
  }

  try {
    const { message, errors } = await handler();
    await sendToChat(chatId, message);
    for (const err of errors) {
      await sendToChat(chatId, err);
    }
  } catch (err) {
    console.error(`[Bot] Report ${key} error:`, err.message);
    await sendToChat(chatId, `⚠️ Report failed: ${err.message}`);
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
