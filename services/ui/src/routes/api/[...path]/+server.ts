import type { RequestHandler } from '@sveltejs/kit';

const handler: RequestHandler = async (event) => {
  const paperclipUrl = process.env.PAPERCLIP_URL;
  if (!paperclipUrl) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error: PAPERCLIP_URL not set.' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }

  // Build the target URL preserving the sub-path and query string
  const path = event.params.path ?? '';
  const target = new URL(`/${path}`, paperclipUrl);
  target.search = event.url.search;

  // Forward headers that matter
  const headers = new Headers();
  const contentType = event.request.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }
  // Forward cookies for BetterAuth session (not Bearer token)
  const cookieHeader = event.request.headers.get('cookie');
  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }

  // Stream the request body through without buffering
  const hasBody = !['GET', 'HEAD'].includes(event.request.method);
  const body = hasBody ? event.request.body : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      method: event.request.method,
      headers,
      body,
      // @ts-expect-error -- Node 18+ supports duplex on RequestInit for streaming bodies
      duplex: hasBody ? 'half' : undefined,
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Could not reach Paperclip server.' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  // Stream the response back without buffering
  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get('content-type');
  if (upstreamContentType) {
    responseHeaders.set('content-type', upstreamContentType);
  }
  const contentDisposition = upstream.headers.get('content-disposition');
  if (contentDisposition) {
    responseHeaders.set('content-disposition', contentDisposition);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
