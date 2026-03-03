import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async (event) => {
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

    const objective = (formData.get('objective') as string | null)?.trim();
    if (!objective) {
      return fail(400, { error: 'Objective is required.' });
    }

    const maxBots = Number(formData.get('maxBots') ?? 3);
    const budgetCapDollars = Number(formData.get('budgetCapDollars') ?? 10);
    const budgetCapCents = Math.round(budgetCapDollars * 100);
    const llmProvider = (formData.get('llmProvider') as string | null) ?? 'anthropic';
    const allowedDomainsRaw = (formData.get('allowedDomains') as string | null) ?? '';
    const allowedDomains = allowedDomainsRaw.split(',').map(d => d.trim()).filter(Boolean);
    const objectiveId = (formData.get('objectiveId') as string | null)?.trim() || null;
    const allowedTools = formData.getAll('allowedTools') as string[];
    const runtimeLimitMinutes = Number(formData.get('runtimeLimitMinutes') ?? 60);
    const runtimeLimitSeconds = runtimeLimitMinutes * 60;
    const campaignType = (formData.get('campaignType') as string | null) ?? 'ad_hoc';

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
      res = await fetch(`${executionServiceUrl}/executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          objective,
          maxBots,
          budgetCapCents,
          llmProvider,
          allowedDomains,
          allowedTools,
          runtimeLimitSeconds,
          campaignType,
          ...(objectiveId ? { objectiveId } : {}),
        }),
      });
    } catch (err) {
      return fail(503, { error: 'Could not reach execution service. Please try again.' });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return fail(res.status, { error: text || 'Failed to create execution. Please try again.' });
    }

    const { executionId } = await res.json() as { executionId: string };
    redirect(303, `/executions/${executionId}/pre-flight`);
  },
};
