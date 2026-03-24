import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, fetch }) => {
  if (!locals.session) {
    throw redirect(303, '/auth');
  }

  // Fetch companies — single-tenant: take first company
  let companyId: string | null = null;
  try {
    const res = await fetch('/api/companies');
    if (res.ok) {
      const companies = await res.json();
      if (Array.isArray(companies) && companies.length > 0) {
        companyId = companies[0].id;
      }
    }
  } catch {
    // Company fetch failure — pages will show error state
  }

  return {
    session: locals.session,
    companyId,
  };
};
