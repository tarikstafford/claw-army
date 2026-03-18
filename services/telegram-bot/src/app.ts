import Fastify from 'fastify';
import { sendMessage, type TelegramUpdate } from './lib/telegram.js';
import { handleHelp } from './commands/help.js';
import { handleStatus } from './commands/status.js';
import { handleInbox } from './commands/inbox.js';
import { handleAgents } from './commands/agents.js';

const COMMAND_HANDLERS: Record<string, (chatId: number) => Promise<void>> = {
  '/help': handleHelp,
  '/start': handleHelp,
  '/status': handleStatus,
  '/inbox': handleInbox,
  '/agents': handleAgents,
};

export function buildApp() {
  const app = Fastify({
    logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  // Health check
  app.get('/health', async () => ({ ok: true }));

  // Telegram webhook receiver
  app.post('/webhook', async (request, reply) => {
    const update = request.body as TelegramUpdate;

    const message = update.message;
    if (!message?.text) {
      return reply.code(200).send({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // Strip bot username suffix (e.g. /help@MyBot → /help)
    const command = text.split('@')[0]?.split(' ')[0]?.toLowerCase() ?? '';

    const handler = COMMAND_HANDLERS[command];
    if (handler) {
      // Respond asynchronously — Telegram expects a fast 200
      handler(chatId).catch((err: Error) => {
        console.error(`[app] Command handler error for ${command}:`, err.message);
      });
    } else if (command.startsWith('/')) {
      sendMessage(chatId, `Unknown command: ${command}. Use /help for available commands.`).catch(
        (err: Error) => console.error('[app] sendMessage error:', err.message),
      );
    }

    return reply.code(200).send({ ok: true });
  });

  return app;
}
