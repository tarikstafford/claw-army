import Fastify from 'fastify';
import { sendMessage, type TelegramUpdate } from './lib/telegram.js';
import { handleBoardMessage } from './conversation-manager.js';
import { getConversation, upsertConversation } from './lib/conversation-store.js';

const HELP_TEXT = [
  '*Akasa Board Bot*',
  '',
  'This bot connects you directly to the Akasa CEO.',
  '',
  'Just send any message and it will be forwarded to the CEO.',
  'You\'ll receive their reply here when they respond.',
  '',
  '/help — Show this message',
  '/new  — Start a fresh conversation thread',
].join('\n');

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
    const username = message.from?.username ?? message.from?.first_name ?? String(message.from?.id ?? chatId);

    // Strip bot username suffix (e.g. /help@MyBot → /help)
    const command = text.split('@')[0]?.split(' ')[0]?.toLowerCase() ?? '';

    if (command === '/help' || command === '/start') {
      sendMessage(chatId, HELP_TEXT).catch((err: Error) =>
        console.error('[app] sendMessage error:', err.message),
      );
      return reply.code(200).send({ ok: true });
    }

    if (command === '/new') {
      // Reset this chat's conversation so the next message creates a fresh issue
      const existing = getConversation(chatId);
      if (existing) {
        upsertConversation({ ...existing, issueId: '', lastSeenCommentId: null, updatedAt: new Date().toISOString() });
      }
      sendMessage(chatId, '🔄 Starting a new conversation thread. Send your message!').catch(
        (err: Error) => console.error('[app] sendMessage error:', err.message),
      );
      return reply.code(200).send({ ok: true });
    }

    // Any other message — forward to CEO via Paperclip
    handleBoardMessage(chatId, username, text).catch((err: Error) => {
      console.error('[app] handleBoardMessage error:', err.message);
    });

    return reply.code(200).send({ ok: true });
  });

  return app;
}
