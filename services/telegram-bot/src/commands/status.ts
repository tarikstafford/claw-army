import { sendMessage } from '../lib/telegram.js';
import { getProjects, getActiveIssues } from '../lib/paperclip.js';

const STATUS_EMOJI: Record<string, string> = {
  in_progress: '🟢',
  todo: '🔵',
  blocked: '🔴',
  done: '✅',
  backlog: '⚪',
  cancelled: '❌',
};

export async function handleStatus(chatId: number): Promise<void> {
  try {
    const [projects, issues] = await Promise.all([getProjects(), getActiveIssues()]);

    const lines: string[] = ['*Project Status*', ''];

    for (const project of projects) {
      const emoji = STATUS_EMOJI[project.status] ?? '❓';
      const deadline = project.targetDate ? ` (due ${project.targetDate})` : '';
      lines.push(`${emoji} *${project.name}*${deadline}`);
    }

    lines.push('', '*Issue Summary*', '');

    const statusCounts: Record<string, number> = {};
    for (const issue of issues) {
      statusCounts[issue.status] = (statusCounts[issue.status] ?? 0) + 1;
    }

    if (Object.keys(statusCounts).length === 0) {
      lines.push('No active issues.');
    } else {
      for (const [status, count] of Object.entries(statusCounts)) {
        const emoji = STATUS_EMOJI[status] ?? '❓';
        lines.push(`${emoji} ${status}: ${count}`);
      }
    }

    await sendMessage(chatId, lines.join('\n'));
  } catch (err) {
    console.error('[status] Error:', (err as Error).message);
    await sendMessage(chatId, '⚠️ Failed to fetch status. Please try again.');
  }
}
