# telegram-bot

Telegram bot that bridges board communication to the Akasa CEO agent. Board members send messages via Telegram; the bot forwards them to the CEO as Paperclip issues/comments. CEO replies in Paperclip are polled and sent back to Telegram.

## How it works

```
Board (Telegram) ──→ POST /webhook ──→ Paperclip issue (assigned to CEO)
                                                  ↑
Board (Telegram) ←── background poller ←── CEO comment on issue
```

1. **First message** from a Telegram chat creates a new Paperclip conversation issue assigned to CEO.
2. **Subsequent messages** are added as comments to the same issue thread.
3. **Background poller** checks every 30s for new CEO-authored comments and forwards them back to Telegram.

## Setup

### Environment variables

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_WEBHOOK_URL` | Public HTTPS base URL of this service (e.g. `https://yourserver.example.com`) |
| `PAPERCLIP_API_URL` | Paperclip API base URL |
| `PAPERCLIP_COMPANY_ID` | Paperclip company UUID |
| `PAPERCLIP_API_KEY` | Paperclip API key (must be a persistent key, not a run JWT) |
| `PAPERCLIP_CEO_AGENT_ID` | UUID of the CEO agent in Paperclip |
| `PAPERCLIP_PROJECT_ID` | (Optional) Project to file conversation issues under |
| `CONVERSATION_STORE_PATH` | Path to JSON file for storing chat→issue mappings (default: `/tmp/telegram-conversations.json`) |
| `POLL_INTERVAL_MS` | How often to poll for CEO replies in ms (default: `30000`) |
| `PORT` | Port to listen on (default: `3005`) |

Copy `.env.example`:

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

On startup, the service:
1. Starts the Fastify server
2. Registers the Telegram webhook automatically
3. Starts the background CEO reply poller

## Webhook requirements

Must be publicly accessible over HTTPS.

- **Production**: deploy behind Nginx/Caddy with a valid TLS cert
- **Dev tunnel**: `ngrok http 3005` → set `TELEGRAM_WEBHOOK_URL` to the ngrok HTTPS URL

## Commands

| Command | Description |
|---|---|
| `/help` | Show help and usage info |
| `/start` | Same as `/help` |
| `/new` | Start a fresh conversation thread with the CEO |
| (any text) | Forwarded to CEO as a Paperclip comment |

## Conversation persistence

Telegram chat → Paperclip issue mappings are persisted in a JSON file (`CONVERSATION_STORE_PATH`). In production, mount this path to a persistent volume so conversations survive restarts.
