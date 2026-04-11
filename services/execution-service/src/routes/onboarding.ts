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

const TOOL_BASED_AGENTS: Record<string, { name: string; role: string; title: string; archetype: string }> = {
  hubspot: { name: 'Mira', role: 'marketing', title: 'Marketing Strategist', archetype: 'Creative Synthesizer' },
  slack: { name: 'Asha', role: 'ops', title: 'Operations Analyst', archetype: 'Structured Analyst' },
  'google-sheets': { name: 'Roan', role: 'finance', title: 'Finance Auditor', archetype: 'Cautious Verifier' },
};

interface QuickWin {
  agent: string;
  message: string;
  toolId: string;
}

function getQuickWins(toolIds: string[]): QuickWin[] {
  const wins: QuickWin[] = [];
  const toolSet = new Set(toolIds);

  if (toolSet.has('hubspot')) {
    wins.push({ agent: 'Kael', message: 'Found 50 cold leads in HubSpot that need follow-up', toolId: 'hubspot' });
  }
  if (toolSet.has('slack')) {
    wins.push({ agent: 'Asha', message: 'Detected 12 unresponded messages in Slack channels', toolId: 'slack' });
  }
  if (toolSet.has('google-sheets')) {
    wins.push({ agent: 'Roan', message: 'Spotted 3 revenue entries missing categorization in Sheets', toolId: 'google-sheets' });
  }

  return wins;
}

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

    const connectedToolIds = toolConnections?.map(t => t.toolId) ?? [];

    let company;
    try {
      company = await createCompanyForUser(userId, {
        name: companyName,
        description: `${businessType} — Goal: ${firstGoal}${connectedToolIds.length > 0 ? ` — Tools: ${connectedToolIds.join(', ')}` : ''}`,
        budgetMonthlyCents: budgetCents,
      });
    } catch (err) {
      console.error('[onboarding] Failed to create company:', (err as Error).message);
      return reply.code(500).send({ error: 'Failed to create company' });
    }

    let agentsToCreate: Array<{ name: string; role: string; title: string; archetype: string; tier: string }>;

    if (connectedToolIds.length > 0) {
      const seen = new Set<string>();
      agentsToCreate = [];

      for (const toolId of connectedToolIds) {
        const agentInfo = TOOL_BASED_AGENTS[toolId];
        if (agentInfo && !seen.has(agentInfo.name)) {
          seen.add(agentInfo.name);
          agentsToCreate.push({ ...agentInfo, tier });
        }
      }

      if (budget !== '<50' && !seen.has('Roan')) {
        agentsToCreate.push({ ...FINANCE_AGENT, tier: 'haiku' });
      }

      if (agentsToCreate.length < 3) {
        for (const a of AGENT_ROSTER) {
          if (!seen.has(a.name)) {
            seen.add(a.name);
            agentsToCreate.push({ ...a, tier });
            if (agentsToCreate.length >= 3) break;
          }
        }
      }
    } else {
      agentsToCreate = [
        ...AGENT_ROSTER.map((a) => ({ ...a, tier })),
      ];
      if (budget !== '<50') {
        agentsToCreate.push({ ...FINANCE_AGENT, tier: 'haiku' });
      }
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

    const quickWins = connectedToolIds.length > 0 ? getQuickWins(connectedToolIds) : [];

    return {
      companyId: company.id,
      companyName: company.name,
      agents: createdAgents,
      quickWins,
    };
  });
};
