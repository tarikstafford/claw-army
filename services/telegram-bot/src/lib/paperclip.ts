const API_URL = process.env['PAPERCLIP_API_URL'];
const COMPANY_ID = process.env['PAPERCLIP_COMPANY_ID'];
const API_KEY = process.env['PAPERCLIP_API_KEY'];

if (!API_URL || !COMPANY_ID || !API_KEY) {
  throw new Error('[paperclip] Missing PAPERCLIP_API_URL, PAPERCLIP_COMPANY_ID, or PAPERCLIP_API_KEY');
}

async function paperclipFetch(path: string): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[paperclip] ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

export interface PaperclipProject {
  id: string;
  name: string;
  status: string;
  targetDate: string | null;
}

export interface PaperclipIssue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: string;
  assigneeAgentId: string | null;
}

export interface PaperclipAgent {
  id: string;
  name: string;
  role: string;
  status?: string;
  urlKey?: string;
}

export async function getProjects(): Promise<PaperclipProject[]> {
  const data = await paperclipFetch(`/api/companies/${COMPANY_ID}/projects`);
  return data as PaperclipProject[];
}

export async function getActiveIssues(): Promise<PaperclipIssue[]> {
  const data = await paperclipFetch(
    `/api/companies/${COMPANY_ID}/issues?status=todo,in_progress,blocked`,
  );
  return data as PaperclipIssue[];
}

export async function getAgents(): Promise<PaperclipAgent[]> {
  const data = await paperclipFetch(`/api/companies/${COMPANY_ID}/agents`);
  return data as PaperclipAgent[];
}
