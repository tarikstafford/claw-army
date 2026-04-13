/**
 * Direct DB access for Paperclip tables (companies, agents, memberships).
 * Both services share the same database, so we query directly.
 */
import { db, companies, companyMemberships, paperclipAgents, instanceUserRoles, projects } from '@claw/db';
import { eq, and } from 'drizzle-orm';

export interface CompanyRecord {
  id: string;
  name: string;
  status: string;
  budgetMonthlyCents: number;
}

export interface AgentRecord {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
}

export async function listCompaniesForUser(userId: string): Promise<CompanyRecord[]> {
  const memberships = await db
    .select({ companyId: companyMemberships.companyId })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.principalType, 'user'),
        eq(companyMemberships.principalId, userId),
        eq(companyMemberships.status, 'active'),
      ),
    );

  if (memberships.length === 0) return [];

  const companyIds = memberships.map((m) => m.companyId);
  const rows = await db
    .select()
    .from(companies)
    .where(eq(companies.status, 'active'));

  return rows.filter((c) => companyIds.includes(c.id)).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    budgetMonthlyCents: c.budgetMonthlyCents,
  }));
}

function deriveIssuePrefix(name: string): string {
  const base = name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'AKA';
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${base}${suffix}`;
}

export async function createCompanyForUser(
  userId: string,
  data: { name: string; description?: string; budgetMonthlyCents?: number },
): Promise<CompanyRecord> {
  const [company] = await db
    .insert(companies)
    .values({
      name: data.name,
      description: data.description ?? null,
      budgetMonthlyCents: data.budgetMonthlyCents ?? 0,
      issuePrefix: deriveIssuePrefix(data.name),
    })
    .returning();

  if (!company) throw new Error('Failed to insert company');

  // Create membership
  await db.insert(companyMemberships).values({
    companyId: company.id,
    principalType: 'user',
    principalId: userId,
    status: 'active',
    membershipRole: 'owner',
  });

  // Ensure user is instance admin
  const existing = await db
    .select()
    .from(instanceUserRoles)
    .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, 'instance_admin')));

  if (existing.length === 0) {
    await db.insert(instanceUserRoles).values({
      userId,
      role: 'instance_admin',
    });
  }

  return { id: company.id, name: company.name, status: company.status, budgetMonthlyCents: company.budgetMonthlyCents };
}

export async function createAgentInCompany(
  companyId: string,
  data: { name: string; role: string; title: string; metadata?: Record<string, unknown> },
): Promise<AgentRecord> {
  const [agent] = await db
    .insert(paperclipAgents)
    .values({
      companyId,
      name: data.name,
      role: data.role,
      title: data.title,
      metadata: data.metadata ?? null,
    })
    .returning();

  if (!agent) throw new Error('Failed to insert agent');

  // Also create agent as company member
  await db.insert(companyMemberships).values({
    companyId,
    principalType: 'agent',
    principalId: agent.id,
    status: 'active',
    membershipRole: 'member',
  });

  return { id: agent.id, companyId: agent.companyId, name: agent.name, role: agent.role, title: agent.title, status: agent.status };
}

export interface ProjectRecord {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  status: string;
}

export async function getProject(projectId: string): Promise<ProjectRecord | null> {
  const [project] = await db
    .select({
      id: projects.id,
      companyId: projects.companyId,
      name: projects.name,
      description: projects.description,
      status: projects.status,
    })
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project) return null;

  return {
    id: project.id,
    companyId: project.companyId,
    name: project.name,
    description: project.description,
    status: project.status,
  };
}
