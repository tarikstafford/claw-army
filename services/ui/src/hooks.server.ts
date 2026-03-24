import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

const PAPERCLIP_URL = process.env.PAPERCLIP_URL ?? 'http://localhost:3100';

export const handle: Handle = async ({ event, resolve }) => {
  const cookieHeader = event.request.headers.get('cookie') ?? '';

  try {
    const res = await fetch(`${PAPERCLIP_URL}/api/auth/get-session`, {
      headers: { cookie: cookieHeader, accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.session?.userId && data?.user?.id) {
        event.locals.session = { user: data.user, session: data.session };
      }
    }
  } catch {
    // session resolution failure is non-fatal — treat as unauthenticated
  }

  const isProtected = event.url.pathname.startsWith('/indra') ||
    event.url.pathname.startsWith('/office') ||
    event.url.pathname.startsWith('/chat') ||
    event.url.pathname.startsWith('/sanctum');

  if (isProtected && !event.locals.session) {
    throw redirect(303, '/auth');
  }

  return resolve(event);
};
