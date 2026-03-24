import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const [issueRes, commentsRes] = await Promise.allSettled([
    fetch(`/api/issues/${params.id}`),
    fetch(`/api/issues/${params.id}/comments`),
  ]);

  if (issueRes.status === 'rejected' || !issueRes.value.ok) {
    const status = issueRes.status === 'rejected' ? 500 : issueRes.value.status;
    throw error(status, 'Failed to load issue');
  }

  const issue = await issueRes.value.json();
  const comments =
    commentsRes.status === 'fulfilled' && commentsRes.value.ok
      ? await commentsRes.value.json()
      : [];

  return { issue, comments };
};

export const actions: Actions = {
  addComment: async ({ request, fetch, params }) => {
    const form = await request.formData();
    const body = form.get('body') as string;
    if (!body?.trim()) return fail(400, { error: 'Comment cannot be empty' });
    const res = await fetch(`/api/issues/${params.id}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) return fail(res.status, { error: 'Failed to post comment' });
    return { success: true };
  },
};
