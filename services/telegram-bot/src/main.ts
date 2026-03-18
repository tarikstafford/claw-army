import 'dotenv/config';

const REQUIRED_ENV = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_URL',
  'PAPERCLIP_API_URL',
  'PAPERCLIP_COMPANY_ID',
  'PAPERCLIP_API_KEY',
  'PAPERCLIP_CEO_AGENT_ID',
] as const;

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[main] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

import { buildApp } from './app.js';
import { setWebhook } from './lib/telegram.js';
import { startPoller } from './conversation-manager.js';

const app = buildApp();
const port = Number(process.env['PORT'] ?? 3005);

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Register webhook with Telegram after server is up
const webhookUrl = process.env['TELEGRAM_WEBHOOK_URL']!;
try {
  await setWebhook(`${webhookUrl}/webhook`);
} catch (err) {
  console.error('[main] Failed to register Telegram webhook:', (err as Error).message);
  console.warn('[main] Bot will start but webhook may not be active. Check TELEGRAM_WEBHOOK_URL.');
}

// Start background poller for CEO → Telegram replies
const stopPoller = startPoller();

function shutdown() {
  stopPoller();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
