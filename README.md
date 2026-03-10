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
| `SSH_HOST` | SSH host used to reach the database server |
| `SSH_PORT` | SSH port, usually `22` |
| `SSH_USER` | SSH username |
| `SSH_PRIVATE_KEY_PATH` | Local path to the SSH private key |
| `SSH_PASSPHRASE` | Optional SSH key passphrase |
| `DB_HOST` | PostgreSQL host as seen from the SSH server |
| `DB_PORT` | PostgreSQL port (default: 5432) |
| `DB_NAME` | Database name |
| `DB_USER` | Database user |
| `DB_PASS` | Database password |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
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

## Docker

Build and run with Docker Compose:

```bash
docker compose up --build -d
```

Notes:

- `.env` is loaded into the container through `env_file`.
- `SSH_PRIVATE_KEY_PATH` in `.env` must point to a real key file on the host.
- That key is mounted read-only inside the container at `/run/secrets/zig_monitor_ssh_key`.
- Update `.env` so `SSH_PRIVATE_KEY_PATH=/run/secrets/zig_monitor_ssh_key` when running in Docker.

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

Works on any Node.js host or Docker-capable VPS.

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
