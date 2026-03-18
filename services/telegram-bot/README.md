# telegram-bot

Telegram bot for board communication with the Akasa platform. Lets the board query project status, active tasks, and agent assignments via Telegram.

## Setup

### Environment variables

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_WEBHOOK_URL` | Public HTTPS base URL of this service (e.g. `https://yourserver.example.com`) |
| `PAPERCLIP_API_URL` | Paperclip API base URL (e.g. `http://localhost:3100`) |
| `PAPERCLIP_COMPANY_ID` | Paperclip company UUID |
| `PAPERCLIP_API_KEY` | Paperclip API key (service/board-level key with read access) |
| `PORT` | Port to listen on (default: `3005`) |

Copy `.env.example` and fill in the values:

```bash
cp .env.example .env
```

### Running

```bash
# Development (watch mode)
pnpm --filter @claw/telegram-bot dev

# Production
pnpm --filter @claw/telegram-bot start
```

On startup, the service registers its webhook URL with Telegram automatically. Telegram will then push all incoming messages to `POST /webhook`.

## Webhook requirements

The service **must** be accessible from the public internet over HTTPS for the Telegram webhook to work.

Options:
- Deploy behind a reverse proxy (Nginx/Caddy) with a valid TLS certificate.
- Use a tunnel during development: `ngrok http 3005` — set `TELEGRAM_WEBHOOK_URL` to the ngrok HTTPS URL.

## Commands

| Command | Description |
|---|---|
| `/status` | Show project status and issue summary |
| `/inbox` | List all active tasks across agents |
| `/agents` | List agents and their current assignments |
| `/help` | Show available commands |

## Architecture

- **Fastify v5** HTTP server listening for Telegram webhook `POST /webhook`
- Responds to Telegram immediately with `200 OK` and processes commands asynchronously
- Calls the **Paperclip API** to fetch live data (projects, issues, agents)
- Formats responses as Markdown for clean Telegram rendering
