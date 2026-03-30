import { fail } from '@sveltejs/kit';
import type { Actions } from '@sveltejs/kit';

export const actions: Actions = {
  requestAccess: async (event) => {
    const formData = await event.request.formData();
    const email = (formData.get('email') as string | null)?.trim() ?? '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(400, { error: 'A valid email address is required.' });
    }

    // Waitlist endpoint not yet available on akasa-server — accept silently
    console.log('[marketing] Waitlist request:', { email });
    return { success: true };
  },
};
