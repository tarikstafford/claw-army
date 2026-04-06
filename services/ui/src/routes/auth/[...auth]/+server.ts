import type { RequestHandler } from '@sveltejs/kit';

const BACKEND_URL = process.env.EXECUTION_SERVICE_URL ?? 'http://localhost:3001';

/**
 * Proxies /auth/* sub-routes (callback, sign-in, etc.) to the execution-service.
 * Google OAuth redirects to /auth/callback/google — this route catches it and
 * forwards to the backend's BetterAuth handler at the same path.
 */
const handler: RequestHandler = async (event) => {
  const subPath = event.params.auth ?? '';
  const target = new URL(`/auth/${subPath}`, BACKEND_URL);
  target.search = event.url.search;

  const headers = new Headers();
  const contentType = event.request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const cookieHeader = event.request.headers.get('cookie');
  if (cookieHeader) headers.set('cookie', cookieHeader);

  const hasBody = !['GET', 'HEAD'].includes(event.request.method);

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      method: event.request.method,
      headers,
      body: hasBody ? event.request.body : undefined,
      // @ts-expect-error -- Node 18+ supports duplex on RequestInit
      duplex: hasBody ? 'half' : undefined,
      redirect: 'manual',
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Could not reach backend.' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  const responseHeaders = new Headers();
  const upstreamCT = upstream.headers.get('content-type');
  if (upstreamCT) responseHeaders.set('content-type', upstreamCT);
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie);
  }
  const location = upstream.headers.get('location');
  if (location) responseHeaders.set('location', location);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
};

export const GET = handler;
export const POST = handler;
