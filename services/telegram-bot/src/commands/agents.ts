import { sendMessage } from '../lib/telegram.js';
import { getAgents, getActiveIssues } from '../lib/paperclip.js';

export async function handleAgents(chatId: number): Promise<void> {
  try {
    const [agents, issues] = await Promise.all([getAgents(), getActiveIssues()]);

    // Build map of agentId → in-progress issue count
    const assignedCounts: Record<string, number> = {};
    for (const issue of issues) {
      if (issue.assigneeAgentId) {
        assignedCounts[issue.assigneeAgentId] =
          (assignedCounts[issue.assigneeAgentId] ?? 0) + 1;
      }
    }

    const lines: string[] = [`*Agents (${agents.length})*`, ''];

    for (const agent of agents) {
      const count = assignedCounts[agent.id] ?? 0;
      const taskLabel = count > 0 ? `${count} task${count > 1 ? 's' : ''}` : 'idle';
      lines.push(`🤖 *${agent.name}* (${agent.role}) — ${taskLabel}`);
    }

    await sendMessage(chatId, lines.join('\n'));
  } catch (err) {
    console.error('[agents] Error:', (err as Error).message);
    await sendMessage(chatId, '⚠️ Failed to fetch agents. Please try again.');
  }
}
