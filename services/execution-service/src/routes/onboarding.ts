import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { listCompaniesForUser, createCompanyForUser, createAgentInCompany } from '../services/paperclip-client';
import { auth } from '../auth';

const AGENT_ROSTER = [
  { name: 'Mira', role: 'marketing', title: 'Marketing Strategist', archetype: 'Creative Synthesizer' },
  { name: 'Kael', role: 'sales', title: 'Sales Executor', archetype: 'Aggressive Executor' },
  { name: 'Asha', role: 'ops', title: 'Operations Analyst', archetype: 'Structured Analyst' },
] as const;

const FINANCE_AGENT = {
  name: 'Roan', role: 'finance', title: 'Finance Auditor', archetype: 'Cautious Verifier',
} as const;

function budgetToCents(budget: string): number {
  switch (budget) {
    case '<50': return 5000;
    case '50-200': return 10000;
    case '200+': return 20000;
    default: return 10000;
  }
}

function budgetToTier(budget: string): string {
  return budget === '<50' ? 'haiku' : 'sonnet';
}

async function resolveUserId(request: FastifyRequest): Promise<string | null> {
  const cookie = request.headers.cookie ?? '';
  if (!cookie) return null;

  try {
    const webRequest = new Request(`http://${request.hostname}/auth/get-session`, {
      method: 'GET',
      headers: new Headers({ cookie }),
    });
    const webResponse = await auth.handler(webRequest);
    if (!webResponse.ok) return null;
    const data = await webResponse.json() as { session?: { userId?: string } };
    return data?.session?.userId ?? null;
  } catch {
    return null;
  }
}

export const onboardingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await resolveUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }

    try {
      const companies = await listCompaniesForUser(userId);
      if (companies.length > 0) {
        return { onboarded: true, companyId: companies[0]!.id };
      }
      return { onboarded: false, companyId: null };
    } catch (err) {
      console.error('[onboarding] Failed to check status:', (err as Error).message);
      return { onboarded: false, companyId: null };
    }
  });

  app.post('/summon', {
    schema: {
      body: Type.Object({
        businessType: Type.String(),
        firstGoal: Type.String(),
        budget: Type.String(),
        companyName: Type.String(),
        toolConnections: Type.Optional(Type.Array(Type.Object({
          toolId: Type.String(),
          connectionId: Type.String(),
        }))),
      }),
    },
  }, async (request: FastifyRequest<{
    Body: { businessType: string; firstGoal: string; budget: string; companyName: string; toolConnections?: Array<{ toolId: string; connectionId: string }> };
  }>, reply: FastifyReply) => {
    const userId = await resolveUserId(request);
    if (!userId) {
      return reply.code(401).send({ error: 'Not authenticated' });
    }

    const { businessType, firstGoal, budget, companyName, toolConnections } = request.body;
    const tier = budgetToTier(budget);
    const budgetCents = budgetToCents(budget);

    let company;
    try {
      company = await createCompanyForUser(userId, {
        name: companyName,
        description: `${businessType} — Goal: ${firstGoal}`,
        budgetMonthlyCents: budgetCents,
      });
    } catch (err) {
      console.error('[onboarding] Failed to create company:', (err as Error).message);
      return reply.code(500).send({ error: 'Failed to create company' });
    }

    const agentsToCreate: Array<{ name: string; role: string; title: string; archetype: string; tier: string }> = [
      ...AGENT_ROSTER.map((a) => ({ ...a, tier })),
    ];
    if (budget !== '<50') {
      agentsToCreate.push({ ...FINANCE_AGENT, tier: 'haiku' });
    }

    const createdAgents = [];
    for (const agent of agentsToCreate) {
      try {
        const created = await createAgentInCompany(company.id, {
          name: agent.name,
          role: agent.role,
          title: agent.title,
          metadata: {
            archetype: agent.archetype,
            tier: agent.tier,
            businessType,
            firstGoal,
            toolConnections: toolConnections ?? [],
          },
        });
        createdAgents.push({ id: created.id, name: agent.name, role: agent.role, tier: agent.tier, archetype: agent.archetype });
      } catch (err) {
        console.error(`[onboarding] Failed to create agent ${agent.name}:`, (err as Error).message);
      }
    }

    return {
      companyId: company.id,
      companyName: company.name,
      agents: createdAgents,
    };
  });
};
