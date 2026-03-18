import { sendMessage } from '../lib/telegram.js';

export async function handleHelp(chatId: number): Promise<void> {
  const text = [
    '*Akasa Board Bot — Commands*',
    '',
    '/status — Show current project and issue status',
    '/inbox  — List active tasks across all agents',
    '/agents — List agents and their current assignments',
    '/help   — Show this command list',
  ].join('\n');
  await sendMessage(chatId, text);
}
