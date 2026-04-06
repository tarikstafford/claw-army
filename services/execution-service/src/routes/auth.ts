import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { auth } from '../auth';

/**
 * Bridges BetterAuth (Web API Request/Response) to Fastify.
 * Registers a wildcard route that forwards all /auth/* requests to BetterAuth.
 */
export const authRoutes: FastifyPluginAsync = async (app) => {
  console.log('[auth-routes] Registering BetterAuth wildcard route under /auth');

  app.all('/*', async (request: FastifyRequest, reply: FastifyReply) => {
    console.log(`[auth-routes] Handling ${request.method} ${request.url}`);
    const url = new URL(request.url, `http://${request.hostname}`);

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

    // Forward status
    reply.status(webResponse.status);

    // Forward all response headers
    for (const [key, value] of webResponse.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        // getSetCookie returns individual cookies
        for (const cookie of webResponse.headers.getSetCookie()) {
          reply.header('set-cookie', cookie);
        }
      } else {
        reply.header(key, value);
      }
    }

    // Forward body
    const body = await webResponse.text();
    return reply.send(body);
  });
};
