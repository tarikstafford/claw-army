const TELEGRAM_API = 'https://api.telegram.org';

export const TOKEN = process.env['TELEGRAM_BOT_TOKEN'];

if (!TOKEN) {
  throw new Error('[telegram] TELEGRAM_BOT_TOKEN is not set');
}

export async function sendMessage(chatId: number | string, text: string): Promise<void> {
  const res = await fetch(`${TELEGRAM_API}/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('[telegram] sendMessage failed:', res.status, body);
  }
}

export async function setWebhook(url: string): Promise<void> {
  const res = await fetch(`${TELEGRAM_API}/bot${TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, allowed_updates: ['message'] }),
  });
  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    throw new Error(`[telegram] setWebhook failed: ${data.description}`);
  }
  console.log('[telegram] Webhook registered:', url);
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
  };
}
