import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
  const connected = url.searchParams.get('connected');
  const error = url.searchParams.get('error');
  const tool = url.searchParams.get('tool');

  // If OAuth success, redirect to belt page per UI-SPEC step 5
  if (connected) {
    throw redirect(303, `/tools/belt?connected=${encodeURIComponent(connected)}`);
  }
  if (error) {
    const params = new URLSearchParams({ error });
    if (tool) params.set('tool', tool);
    throw redirect(303, `/tools/belt?${params.toString()}`);
  }

  // Default: redirect to catalog tab
  throw redirect(303, '/tools/catalog');
};
