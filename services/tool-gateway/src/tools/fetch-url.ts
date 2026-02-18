import type { FetchUrlRequest } from '@claw/tool-contracts';

const MAX_BODY_BYTES = 1_000_000; // 1 MB

export interface FetchUrlResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  truncated: boolean;
}

/**
 * Execute the fetch_url tool.
 * Enforces a domain allowlist by URL hostname (prevents credential injection).
 * Truncates response bodies larger than 1 MB.
 */
export async function executeFetchUrl(req: FetchUrlRequest): Promise<FetchUrlResult> {
  // Parse and validate the URL — throws on malformed input (caught by route handler)
  const url = new URL(req.args.url);

  // Domain allowlist check using hostname (NOT .host, which includes port)
  const allowlistEnv = process.env['FETCH_URL_DOMAIN_ALLOWLIST'] ?? '';
  const allowlist = allowlistEnv
    .split(',')
    .map((d) => d.trim())
    .filter((d) => d.length > 0);

  if (allowlist.length > 0 && !allowlist.includes(url.hostname)) {
    throw new Error(`Domain ${url.hostname} not in fetch_url allowlist`);
  }

  const response = await fetch(req.args.url, {
    method: req.args.method,
    headers: req.args.headers,
    body: req.args.body,
    signal: AbortSignal.timeout(30_000),
  });

  // Read as ArrayBuffer so we can measure byte length before truncation
  const buffer = await response.arrayBuffer();
  const truncated = buffer.byteLength > MAX_BODY_BYTES;

  const slice = truncated ? buffer.slice(0, MAX_BODY_BYTES) : buffer;
  const body = new TextDecoder('utf-8').decode(slice);

  // Collect response headers into a plain record
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    statusCode: response.status,
    headers,
    body,
    truncated,
  };
}
