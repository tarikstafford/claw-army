import { fail } from '@sveltejs/kit';
import type { Actions } from '@sveltejs/kit';

export const actions: Actions = {
  requestAccess: async (event) => {
    const formData = await event.request.formData();
    const email = (formData.get('email') as string | null)?.trim() ?? '';

    if (!email || !email.includes('@')) {
      return fail(400, { error: 'A valid email address is required.' });
    }

    const executionServiceUrl = process.env.EXECUTION_SERVICE_URL;
    if (!executionServiceUrl) {
      return fail(500, { error: 'Server configuration error.' });
    }

    let res: Response;
    try {
      res = await fetch(`${executionServiceUrl}/admin/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      return fail(503, { error: 'Could not reach server. Please try again.' });
    }

    if (!res.ok) {
      return fail(res.status, { error: 'Failed to submit. Please try again.' });
    }

    return { success: true };
  },
};
