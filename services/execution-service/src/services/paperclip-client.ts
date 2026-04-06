/**
 * Thin HTTP client for Paperclip API calls.
 * Forwards cookies from the original request so Paperclip resolves the user's session.
 */

const PAPERCLIP_URL = process.env['PAPERCLIP_URL'] ?? 'http://localhost:3100';

interface PaperclipRequestOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
}

async function paperclipFetch<T>(path: string, opts: PaperclipRequestOptions = {}): Promise<T> {
  const url = `${PAPERCLIP_URL}${path}`;
  const headers: Record<string, string> = {
    accept: 'application/json',
  };

  if (opts.cookie) {
    headers['cookie'] = opts.cookie;
  }

  if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Paperclip ${opts.method ?? 'GET'} ${path} failed (${res.status}): ${text}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return undefined as T;
}

export interface PaperclipCompany {
  id: string;
  name: string;
  status: string;
  issuePrefix: string;
  budgetMonthlyCents: number;
}

export interface PaperclipAgent {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title: string;
  status: string;
}

export function listCompanies(cookie: string): Promise<PaperclipCompany[]> {
  return paperclipFetch<PaperclipCompany[]>('/api/companies', { cookie });
}

export function createCompany(
  cookie: string,
  data: { name: string; description?: string; budgetMonthlyCents?: number },
): Promise<PaperclipCompany> {
  return paperclipFetch<PaperclipCompany>('/api/companies', {
    method: 'POST',
    cookie,
    body: data,
  });
}

export function createAgent(
  cookie: string,
  companyId: string,
  data: {
    name: string;
    role: string;
    title: string;
    adapterType?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<PaperclipAgent> {
  return paperclipFetch<PaperclipAgent>(`/api/companies/${companyId}/agents`, {
    method: 'POST',
    cookie,
    body: data,
  });
}
