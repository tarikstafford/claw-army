import { redirect } from '@sveltejs/kit';

export const load = async (event: { params: { id: string }; locals: App.Locals }) => {
  const session = await event.locals.auth();
  if (!session?.user) {
    redirect(303, '/login');
  }
  return {
    executionId: event.params.id,
  };
};
