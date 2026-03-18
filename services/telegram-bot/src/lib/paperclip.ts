const API_URL = process.env['PAPERCLIP_API_URL'];
const COMPANY_ID = process.env['PAPERCLIP_COMPANY_ID'];
const API_KEY = process.env['PAPERCLIP_API_KEY'];
export const CEO_AGENT_ID = process.env['PAPERCLIP_CEO_AGENT_ID'];

if (!API_URL || !COMPANY_ID || !API_KEY) {
  throw new Error('[paperclip] Missing PAPERCLIP_API_URL, PAPERCLIP_COMPANY_ID, or PAPERCLIP_API_KEY');
}

export interface PaperclipComment {
  id: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  body: string;
  createdAt: string;
}

async function paperclipFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[paperclip] ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Creates a Paperclip issue representing a new Telegram conversation thread.
 * Assigned to the CEO agent.
 */
export async function createConversationIssue(
  chatId: number,
  username: string,
  firstMessage: string,
): Promise<string> {
  const projectId = process.env['PAPERCLIP_PROJECT_ID'] ?? null;
  const body: Record<string, unknown> = {
    title: `Telegram: ${username}`,
    description: [
      `Board communication channel via Telegram.`,
      `Chat ID: \`${chatId}\``,
      `Started by: @${username}`,
      ``,
      `---`,
      `**First message:**`,
      firstMessage,
    ].join('\n'),
    status: 'todo',
    priority: 'high',
    assigneeAgentId: CEO_AGENT_ID ?? undefined,
  };
  if (projectId) body['projectId'] = projectId;

  const issue = (await paperclipFetch(`/api/companies/${COMPANY_ID}/issues`, {
    method: 'POST',
    body: JSON.stringify(body),
  })) as { id: string };

  return issue.id;
}

/**
 * Posts a board message as a comment on the conversation issue.
 */
export async function postBoardMessage(
  issueId: string,
  username: string,
  text: string,
): Promise<void> {
  await paperclipFetch(`/api/issues/${issueId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body: `**@${username} (Telegram):** ${text}` }),
  });
}

/**
 * Fetches new comments after a given comment ID.
 * Returns comments in ascending order.
 */
export async function getNewComments(
  issueId: string,
  afterCommentId: string | null,
): Promise<PaperclipComment[]> {
  const url = afterCommentId
    ? `/api/issues/${issueId}/comments?after=${afterCommentId}&order=asc`
    : `/api/issues/${issueId}/comments`;

  const comments = (await paperclipFetch(url)) as PaperclipComment[];
  return comments;
}
