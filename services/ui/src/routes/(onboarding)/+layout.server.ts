import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, fetch }) => {
  if (!locals.session) {
    throw redirect(303, '/auth');
  }

  // If user already has a company, skip onboarding
  try {
    const res = await fetch('/api/onboarding/status');
    if (res.ok) {
      const data = await res.json();
      if (data.onboarded) {
        throw redirect(303, '/indra');
      }
    }
  } catch (err) {
    // redirect throws are re-thrown by SvelteKit
    if (err && typeof err === 'object' && 'status' in err) throw err;
  }

  return {
    session: locals.session,
  };
};
