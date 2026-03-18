import { sendMessage } from '../lib/telegram.js';
import { getActiveIssues } from '../lib/paperclip.js';

const PRIORITY_EMOJI: Record<string, string> = {
  critical: '🔥',
  high: '🔴',
  medium: '🟡',
  low: '🔵',
};

const STATUS_EMOJI: Record<string, string> = {
  in_progress: '⚡',
  todo: '📋',
  blocked: '🚫',
};

export async function handleInbox(chatId: number): Promise<void> {
  try {
    const issues = await getActiveIssues();

    if (issues.length === 0) {
      await sendMessage(chatId, '📭 No active tasks.');
      return;
    }

    const lines: string[] = [`*Active Tasks (${issues.length})*`, ''];

    for (const issue of issues) {
      const priority = PRIORITY_EMOJI[issue.priority] ?? '⚪';
      const status = STATUS_EMOJI[issue.status] ?? '❓';
      lines.push(`${status} ${priority} *${issue.identifier}* — ${issue.title}`);
    }

    await sendMessage(chatId, lines.join('\n'));
  } catch (err) {
    console.error('[inbox] Error:', (err as Error).message);
    await sendMessage(chatId, '⚠️ Failed to fetch inbox. Please try again.');
  }
}
