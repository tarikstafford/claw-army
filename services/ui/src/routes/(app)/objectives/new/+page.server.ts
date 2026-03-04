import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from '@sveltejs/kit';

export const load = async (event: { locals: App.Locals }) => {
  const session = await event.locals.auth();
  if (!session?.user) {
    redirect(303, '/login');
  }
  return {};
};

export const actions: Actions = {
  default: async (event) => {
    // Re-check auth in action (defense in depth)
    const session = await event.locals.auth();
    if (!session?.user) {
      redirect(303, '/login');
    }

    const formData = await event.request.formData();

    const name = (formData.get('name') as string | null)?.trim();
    if (!name) {
      return fail(400, { error: 'Name is required.', field: 'name' });
    }

    const descriptionRaw = (formData.get('description') as string | null)?.trim();
    const description = descriptionRaw || undefined;

    const defaultMaxBots = Number(formData.get('defaultMaxBots') ?? 5);

    // Budget: empty string → omit (do NOT send 0 or null)
    const budgetRaw = formData.get('budgetCapDollars') as string | null;
    const defaultBudgetCapCents =
      budgetRaw && budgetRaw.trim() !== ''
        ? Math.round(Number(budgetRaw) * 100)
        : undefined;

    // Runtime: empty string → omit (do NOT send 0 or null)
    const runtimeRaw = formData.get('runtimeLimitMinutes') as string | null;
    const defaultRuntimeLimitSeconds =
      runtimeRaw && runtimeRaw.trim() !== ''
        ? Number(runtimeRaw) * 60
        : undefined;

    const defaultAllowedTools = formData.getAll('allowedTools') as string[];

    // Extract Auth.js session token from cookies
    // Auth.js uses 'authjs.session-token' on HTTP (dev) and '__Secure-authjs.session-token' on HTTPS (prod)
    const sessionToken =
      event.cookies.get('__Secure-authjs.session-token') ??
      event.cookies.get('authjs.session-token');

    const executionServiceUrl = process.env.EXECUTION_SERVICE_URL;
    if (!executionServiceUrl) {
      return fail(500, { error: 'Server configuration error: EXECUTION_SERVICE_URL not set.' });
    }

    let res: Response;
    try {
      res = await fetch(`${executionServiceUrl}/objectives`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          name,
          ...(description ? { description } : {}),
          defaultMaxBots,
          ...(defaultBudgetCapCents !== undefined ? { defaultBudgetCapCents } : {}),
          ...(defaultRuntimeLimitSeconds !== undefined ? { defaultRuntimeLimitSeconds } : {}),
          ...(defaultAllowedTools.length > 0 ? { defaultAllowedTools } : {}),
        }),
      });
    } catch (err) {
      return fail(503, { error: 'Could not reach execution service.' });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return fail(res.status, { error: text || 'Failed to create objective.' });
    }

    const created = await res.json() as { id: string };
    redirect(303, `/objectives/${created.id}`);
  },
};
