import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

const BACKEND_URL = process.env.EXECUTION_SERVICE_URL ?? 'http://localhost:3001';

export const handle: Handle = async ({ event, resolve }) => {
  const cookieHeader = event.request.headers.get('cookie') ?? '';

  try {
    const res = await fetch(`${BACKEND_URL}/auth/get-session`, {
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
    event.url.pathname.startsWith('/sanctum') ||
    event.url.pathname.startsWith('/tools') ||
    event.url.pathname.startsWith('/evolution') ||
    event.url.pathname.startsWith('/settings') ||
    event.url.pathname.startsWith('/onboarding');

  if (isProtected && !event.locals.session) {
    throw redirect(303, '/auth');
  }

  return resolve(event);
};
