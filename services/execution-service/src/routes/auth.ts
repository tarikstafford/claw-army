import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../auth';

/**
 * Bridges BetterAuth (Web API Request/Response) to Fastify.
 * Registers individual method handlers to avoid wildcard routing issues.
 */
const PUBLIC_URL = process.env['PUBLIC_URL'] ?? '';

async function handleAuth(request: FastifyRequest, reply: FastifyReply) {
  // BetterAuth route matching uses baseURL path (/api) + basePath (/auth) as prefix.
  // The proxy strips /api, so we must re-add the PUBLIC_URL path prefix.
  const rawPath = request.raw.url ?? request.url;
  const publicUrlObj = PUBLIC_URL ? new URL(PUBLIC_URL) : null;
  const proxyPrefix = publicUrlObj ? publicUrlObj.pathname.replace(/\/$/, '') : '';
  const origin = publicUrlObj?.origin ?? `http://${request.hostname}`;
  const url = new URL(`${proxyPrefix}${rawPath}`, origin);

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const webRequest = new Request(url.toString(), {
    method: request.method,
    headers,
    body: hasBody ? JSON.stringify(request.body) : undefined,
  });

  const webResponse = await auth.handler(webRequest);

  reply.status(webResponse.status);

  for (const [key, value] of webResponse.headers.entries()) {
    if (key.toLowerCase() === 'set-cookie') {
      for (const cookie of webResponse.headers.getSetCookie()) {
        reply.header('set-cookie', cookie);
      }
    } else {
      reply.header(key, value);
    }
  }

  const body = await webResponse.text();
  return reply.send(body);
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.route({ method: ['GET', 'POST'], url: '/auth/*', handler: handleAuth });
}
