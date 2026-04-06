import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

const PAPERCLIP_URL = process.env['PAPERCLIP_URL'] ?? 'http://localhost:3100';

/**
 * Proxies Paperclip-domain requests (companies, agents, issues, goals, projects,
 * chat, costs, approvals, activity, dashboard, sidebar-badges) to the Paperclip
 * server. Forwards the user's session cookie so Paperclip can resolve the actor.
 *
 * Registered at prefix `/` so paths like /companies/:id map directly to
 * Paperclip's /api/companies/:id.
 */
export const paperclipProxyRoutes: FastifyPluginAsync = async (app) => {
  // Paperclip API paths that should be proxied
  const PAPERCLIP_PREFIXES = [
    '/companies',
    '/agents',
    '/issues',
    '/goals',
    '/projects',
    '/chat',
    '/costs',
    '/approvals',
    '/activity',
    '/dashboard',
    '/sidebar-badges',
    '/secrets',
  ];

  for (const prefix of PAPERCLIP_PREFIXES) {
    // Match the prefix itself and anything under it
    app.route({
      method: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      url: `${prefix}`,
      handler: proxyHandler,
    });
    app.route({
      method: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      url: `${prefix}/*`,
      handler: proxyHandler,
    });
  }
};

async function proxyHandler(request: FastifyRequest, reply: FastifyReply) {
  const targetPath = `/api${request.raw.url}`;
  const targetUrl = `${PAPERCLIP_URL}${targetPath}`;

  const headers: Record<string, string> = {
    accept: 'application/json',
  };

  // Forward cookie for BetterAuth session resolution
  const cookie = request.headers.cookie;
  if (cookie) {
    headers['cookie'] = cookie;
  }

  // Forward content-type for POST/PATCH/PUT bodies
  const contentType = request.headers['content-type'];
  if (contentType) {
    headers['content-type'] = typeof contentType === 'string' ? contentType : contentType[0] ?? '';
  }

  // Forward origin for CSRF checks
  const origin = request.headers.origin;
  if (origin) {
    headers['origin'] = typeof origin === 'string' ? origin : origin[0] ?? '';
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: hasBody && request.body ? JSON.stringify(request.body) : undefined,
      redirect: 'manual',
    });
  } catch (err) {
    console.error(`[paperclip-proxy] Failed to reach Paperclip at ${targetUrl}:`, (err as Error).message);
    return reply.code(503).send({ error: 'Could not reach Paperclip service' });
  }

  // Forward status
  reply.status(upstream.status);

  // Forward response headers
  const upstreamCT = upstream.headers.get('content-type');
  if (upstreamCT) {
    reply.header('content-type', upstreamCT);
  }

  // Forward set-cookie headers
  for (const setCookie of upstream.headers.getSetCookie()) {
    reply.header('set-cookie', setCookie);
  }

  // Forward location header (redirects)
  const location = upstream.headers.get('location');
  if (location) {
    reply.header('location', location);
  }

  const body = await upstream.text();
  return reply.send(body);
}
