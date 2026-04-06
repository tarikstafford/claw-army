/**
 * Direct DB access for Paperclip tables (companies, agents, memberships).
 * Both services share the same Supabase DB, so we write directly instead of
 * going through Paperclip's HTTP API (which requires separate auth).
 */
import { db } from '@claw/db';
import { eq, and } from 'drizzle-orm';
import { pgTable, uuid, text, integer, timestamp, jsonb, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

// Re-declare Paperclip tables locally (execution-service doesn't import from Paperclip's schema)
const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'),
  issuePrefix: text('issue_prefix').notNull().default('AKA'),
  issueCounter: integer('issue_counter').notNull().default(0),
  budgetMonthlyCents: integer('budget_monthly_cents').notNull().default(0),
  spentMonthlyCents: integer('spent_monthly_cents').notNull().default(0),
  requireBoardApprovalForNewAgents: boolean('require_board_approval_for_new_agents').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const companyMemberships = pgTable('company_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull(),
  principalType: text('principal_type').notNull(),
  principalId: text('principal_id').notNull(),
  status: text('status').notNull().default('active'),
  membershipRole: text('membership_role'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('general'),
  title: text('title'),
  status: text('status').notNull().default('idle'),
  adapterType: text('adapter_type').notNull().default('process'),
  adapterConfig: jsonb('adapter_config').$type<Record<string, unknown>>().notNull().default({}),
  runtimeConfig: jsonb('runtime_config').$type<Record<string, unknown>>().notNull().default({}),
  budgetMonthlyCents: integer('budget_monthly_cents').notNull().default(0),
  spentMonthlyCents: integer('spent_monthly_cents').notNull().default(0),
  permissions: jsonb('permissions').$type<Record<string, unknown>>().notNull().default({}),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const instanceUserRoles = pgTable('instance_user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

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
      issuePrefix: 'AKA',
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

  // Ensure user is instance admin (required by Paperclip for company operations)
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
    .insert(agents)
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
