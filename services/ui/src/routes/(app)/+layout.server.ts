import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, fetch }) => {
  if (!locals.session) {
    throw redirect(303, '/auth');
  }

  // Check if user has completed onboarding (has a company)
  let companyId: string | null = null;
  try {
    const res = await fetch('/onboarding/api/status');
    if (res.ok) {
      const data = await res.json();
      if (data.onboarded && data.companyId) {
        companyId = data.companyId;
      }
    }
  } catch {
    // Status check failure — treat as not onboarded
  }

  if (!companyId) {
    throw redirect(303, '/onboarding');
  }

  return {
    session: locals.session,
    companyId,
  };
};
