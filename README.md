# ZIG Monitor Bot

Telegram bot for monitoring ZIG wallet movement and staking activity from a PostgreSQL indexer reached through an SSH tunnel.

## What It Shows

- `Balance Increases (24h)` - top 5 wallets with the biggest ZIG accumulation
- `Balance Decreases (24h)` - top 5 wallets with the biggest ZIG outflow
- `Staking Increases (24h)` - significant net stake growth per wallet
- `Unstakes (24h)` - significant net unstake activity per wallet
- `Staked vs Unstaked (24h)` - total staked, total unstaked, net flow, wallet counts
- `Largest Stake (24h)` - biggest single stake event
- `Largest Unstake (24h)` - biggest single unstake event
- `Top Wallets Stake (24h)` - wallets with the highest total stake added

Notes:

- Per-wallet staking increase / unstake sections currently use a significance threshold of `50,000 ZIG`.
- Scheduled reports are still sent daily through cron jobs.

## Telegram UX

The bot supports:

- inline button menu via `/start` or `/menu`
- Telegram slash-command shortcut bar
- scheduled report delivery to subscribed chats

Available shortcut commands:

- `/start`
- `/menu`
- `/increases`
- `/decreases`
- `/stake_up`
- `/unstakes`
- `/net_flow`
- `/max_stake`
- `/max_unstake`
- `/top_stakers`
- `/status`
- `/stop`

## Environment

Copy the template:

```bash
cp .env.example .env
```

Set these values in `.env`:

| Variable | Description |
|---|---|
| `SSH_HOST` | SSH host used to reach the database server |
| `SSH_PORT` | SSH port, usually `22` |
| `SSH_USER` | SSH username |
| `SSH_PRIVATE_KEY_PATH` | Path to the SSH private key |
| `SSH_PASSPHRASE` | Optional SSH key passphrase |
| `DB_HOST` | PostgreSQL host as seen from the SSH server |
| `DB_PORT` | PostgreSQL port |
| `DB_NAME` | Database name |
| `DB_USER` | Database user |
| `DB_PASS` | Database password |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather |
| `WALLET_REPORT_CRON` | Wallet summary cron, default `0 9 * * *` |
| `STAKING_REPORT_CRON` | Staking summary cron, default `5 9 * * *` |

## Local Run

Install dependencies:

```bash
npm install
```

Test the SSH tunnel and database connection:

```bash
npm run test:db
```

Start the bot:

```bash
npm start
```

After startup, open the bot in Telegram and send:

```text
/start
```

## Docker

Build and run:

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

Important:

- `.env` is loaded through `docker-compose.yml`
- the SSH key file from the host is mounted read-only into the container
- inside Docker, `SSH_PRIVATE_KEY_PATH` is overridden to `/run/secrets/zig_monitor_ssh_key`
- `subscribers.json` is mounted so subscriptions persist across restarts

## Logs

Local run:

```bash
npm start
```

Logs appear directly in the terminal.

Docker:

```bash
docker compose logs -f zig-monitor-bot
```

Recent logs only:

```bash
docker compose logs -f --tail=50 zig-monitor-bot
```

## Project Structure

```text
src/
  bot.js          Telegram bot, command panel, shortcut commands
  db.js           SSH tunnel + PostgreSQL pool
  formatters.js   Telegram message formatting
  queries.js      SQL queries for wallet and staking reports
  reports.js      Report orchestration per section
  scheduler.js    Daily cron jobs
index.js          Application entry point
.env.example      Environment template
Dockerfile        Container image definition
docker-compose.yml Container runtime config
subscribers.json  Subscription persistence
```

## Publish Safely

Before pushing this repo publicly:

- keep `.env` out of Git
- rotate any secrets that were ever shared or committed
- verify `.env.example` contains placeholders only

## Behavior Notes

- query failures are returned as Telegram alerts instead of crashing the process
- Telegram send failures retry once after 30 seconds
- shutdown closes the PostgreSQL pool and SSH tunnel
- unhandled promise rejections are logged at process level
