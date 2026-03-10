# ZIG Monitor Bot

Telegram bot that monitors ZIG blockchain wallet movements and staking activity, delivering automated daily reports.

## Features

- **Report 1 — Wallet Movement Summary** (daily 09:00 UTC)
  - Top 5 balance increases/decreases (24h)
  - Net staking changes per wallet
  - Token holdings for top wallets

- **Report 2 — Staking Activity Tracker** (daily 09:05 UTC)
  - Total staked/unstaked with net change
  - Largest single stake and unstake events
  - Top wallets increasing stake

- **Manual commands:** `/wallet_report`, `/staking_report`, `/status`

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

| Variable | Description |
|---|---|
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port (default: 5432) |
| `DB_NAME` | Database name |
| `DB_USER` | Database user |
| `DB_PASS` | Database password |
| `DB_SSL` | Set to `false` to disable SSL (default: enabled) |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Target chat/group ID |
| `WALLET_REPORT_CRON` | Cron for Report 1 (default: `0 9 * * *`) |
| `STAKING_REPORT_CRON` | Cron for Report 2 (default: `5 9 * * *`) |

### 3. Test database connection

```bash
npm run test:db
```

### 4. Start the bot

```bash
npm start
```

## Project Structure

```
/src
  db.js          - PostgreSQL pool + query runner
  queries.js     - 8 query functions (A through H)
  formatters.js  - Markdown formatters for both reports
  reports.js     - Query orchestration + error collection
  scheduler.js   - node-cron jobs for automated reports
  bot.js         - Telegram bot init + command handlers
index.js         - Entry point
.env.example     - Environment variable template
```

## Deployment

Works on any Node.js host: Railway, Render, VPS, etc.

```bash
# With PM2
pm2 start index.js --name zig-monitor

# With Docker (create your own Dockerfile)
node index.js
```

## Error Handling

- Query failures send alerts to the chat instead of crashing
- Telegram send failures retry once after 30 seconds
- All cron executions wrapped in try/catch
- Unhandled rejections are caught at process level
