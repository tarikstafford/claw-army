import { fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

type Actions = {
  [key: string]: (event: RequestEvent<{ id: string }>) => Promise<unknown>;
};

async function patchObjective(
  event: RequestEvent<{ id: string }>,
  body: Record<string, unknown>,
) {
  const session = await event.locals.auth();
  if (!session?.user) return fail(401, { error: 'Unauthorized' });

  const sessionToken =
    event.cookies.get('__Secure-authjs.session-token') ??
    event.cookies.get('authjs.session-token');

  const executionServiceUrl = process.env.EXECUTION_SERVICE_URL;
  if (!executionServiceUrl) {
    return fail(500, { error: 'Server configuration error: EXECUTION_SERVICE_URL not set.' });
  }

  const { id } = event.params;

  let res: Response;
  try {
    res = await fetch(`${executionServiceUrl}/objectives/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    return fail(503, { error: 'Could not reach execution service. Please try again.' });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return fail(res.status, { error: text || 'Failed to update objective.' });
  }

  const objective = await res.json();
  return { success: true, objective };
}

export const actions: Actions = {
  update: async (event) => {
    const session = await event.locals.auth();
    if (!session?.user) return fail(401, { error: 'Unauthorized' });

    const formData = await event.request.formData();

    const name = (formData.get('name') as string | null)?.trim();
    const description = (formData.get('description') as string | null)?.trim();
    const defaultMaxBots = formData.get('defaultMaxBots');
    const budgetCapDollarsRaw = (formData.get('budgetCapDollars') as string | null)?.trim();
    const runtimeLimitMinutesRaw = (formData.get('runtimeLimitMinutes') as string | null)?.trim();
    const allowedTools = formData.getAll('allowedTools') as string[];

    const body: Record<string, unknown> = {};
    if (name) body['name'] = name;
    if (description !== undefined && description !== null) body['description'] = description;
    if (defaultMaxBots !== null) body['defaultMaxBots'] = Number(defaultMaxBots);
    if (budgetCapDollarsRaw && budgetCapDollarsRaw !== '') {
      body['defaultBudgetCapCents'] = Math.round(Number(budgetCapDollarsRaw) * 100);
    }
    if (runtimeLimitMinutesRaw && runtimeLimitMinutesRaw !== '') {
      body['defaultRuntimeLimitSeconds'] = Number(runtimeLimitMinutesRaw) * 60;
    }
    body['defaultAllowedTools'] = allowedTools;

    return patchObjective(event, body);
  },

  archive: async (event) => {
    return patchObjective(event, { isArchived: true });
  },

  unarchive: async (event) => {
    return patchObjective(event, { isArchived: false });
  },
};
