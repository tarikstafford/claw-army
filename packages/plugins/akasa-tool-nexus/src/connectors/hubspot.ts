import type { PluginContext, ToolResult } from '@paperclipai/plugin-sdk';
import { TOOL_NAMES } from '../constants.js';
import { logInvocation } from '../services/invocation-logger.js';
import { resolveCredential } from '../services/credential-bridge.js';

// ─── HubSpot API types ────────────────────────────────────────────────────────

interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    [key: string]: unknown;
  };
}

interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    amount?: string;
    dealstage?: string;
    [key: string]: unknown;
  };
}

interface HubSpotSearchResponse {
  results: HubSpotContact[];
}

// ─── Tool registration ────────────────────────────────────────────────────────

export async function registerHubSpotTools(ctx: PluginContext): Promise<void> {
  // ── hubspot:create-contact ──────────────────────────────────────────────────
  ctx.tools.register(
    TOOL_NAMES.hubspotCreateContact,
    {
      displayName: 'HubSpot: Create Contact',
      description: 'Creates a new contact in HubSpot CRM with email, first name, last name, and optional properties.',
      parametersSchema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Contact email address' },
          firstName: { type: 'string', description: 'First name' },
          lastName: { type: 'string', description: 'Last name' },
          phone: { type: 'string', description: 'Phone number (optional)' },
          company: { type: 'string', description: 'Company name (optional)' },
        },
        required: ['email'],
      },
    },
    async (params, runCtx): Promise<ToolResult> => {
      const start = Date.now();
      const p = params as { email: string; firstName?: string; lastName?: string; phone?: string; company?: string };
      let connectionId = '';

      try {
        const cred = await resolveCredential('hubspot', runCtx.companyId);
        connectionId = cred.connectionId;

        const response = await ctx.http.fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cred.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            properties: {
              email: p.email,
              firstname: p.firstName,
              lastname: p.lastName,
              phone: p.phone,
              company: p.company,
            },
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HubSpot API error ${response.status}: ${text}`);
        }

        const contact = await response.json() as HubSpotContact;
        const latencyMs = Date.now() - start;

        await logInvocation({
          toolId: 'hubspot',
          action: TOOL_NAMES.hubspotCreateContact,
          agentId: runCtx.agentId ?? null,
          userId: runCtx.companyId,
          connectionId,
          latencyMs,
          success: true,
          requestSummary: JSON.stringify(p).slice(0, 500),
          responseSummary: JSON.stringify({ id: contact.id, email: contact.properties.email }).slice(0, 500),
        });

        return {
          content: `Contact created: ${contact.id} (${contact.properties.email ?? p.email})`,
          data: { id: contact.id, email: contact.properties.email ?? p.email },
        };
      } catch (err) {
        const latencyMs = Date.now() - start;
        await logInvocation({
          toolId: 'hubspot',
          action: TOOL_NAMES.hubspotCreateContact,
          agentId: runCtx.agentId ?? null,
          userId: runCtx.companyId,
          connectionId,
          latencyMs,
          success: false,
          errorMessage: (err as Error).message,
          requestSummary: JSON.stringify(p).slice(0, 500),
        });
        return { error: (err as Error).message };
      }
    },
  );

  // ── hubspot:search-contacts ─────────────────────────────────────────────────
  ctx.tools.register(
    TOOL_NAMES.hubspotSearchContacts,
    {
      displayName: 'HubSpot: Search Contacts',
      description: 'Searches HubSpot contacts by email, name, or company. Returns up to 10 matching contacts.',
      parametersSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (email, name, or company)' },
          limit: { type: 'number', description: 'Max results (default 10, max 100)' },
        },
        required: ['query'],
      },
    },
    async (params, runCtx): Promise<ToolResult> => {
      const start = Date.now();
      const p = params as { query: string; limit?: number };
      let connectionId = '';

      try {
        const cred = await resolveCredential('hubspot', runCtx.companyId);
        connectionId = cred.connectionId;

        const response = await ctx.http.fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cred.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'email',
                    operator: 'CONTAINS_TOKEN',
                    value: p.query,
                  },
                ],
              },
            ],
            limit: p.limit ?? 10,
            properties: ['email', 'firstname', 'lastname'],
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HubSpot API error ${response.status}: ${text}`);
        }

        const result = await response.json() as HubSpotSearchResponse;
        const contacts = result.results.map((c) => ({
          id: c.id,
          email: c.properties.email,
          firstName: c.properties.firstname,
          lastName: c.properties.lastname,
        }));

        const latencyMs = Date.now() - start;
        await logInvocation({
          toolId: 'hubspot',
          action: TOOL_NAMES.hubspotSearchContacts,
          agentId: runCtx.agentId ?? null,
          userId: runCtx.companyId,
          connectionId,
          latencyMs,
          success: true,
          requestSummary: JSON.stringify(p).slice(0, 500),
          responseSummary: JSON.stringify({ count: contacts.length }).slice(0, 500),
        });

        return {
          content: `Found ${contacts.length} contacts matching "${p.query}"`,
          data: { contacts },
        };
      } catch (err) {
        const latencyMs = Date.now() - start;
        await logInvocation({
          toolId: 'hubspot',
          action: TOOL_NAMES.hubspotSearchContacts,
          agentId: runCtx.agentId ?? null,
          userId: runCtx.companyId,
          connectionId,
          latencyMs,
          success: false,
          errorMessage: (err as Error).message,
          requestSummary: JSON.stringify(p).slice(0, 500),
        });
        return { error: (err as Error).message };
      }
    },
  );

  // ── hubspot:create-deal ─────────────────────────────────────────────────────
  ctx.tools.register(
    TOOL_NAMES.hubspotCreateDeal,
    {
      displayName: 'HubSpot: Create Deal',
      description: 'Creates a new deal in HubSpot CRM pipeline with name, amount, and stage.',
      parametersSchema: {
        type: 'object',
        properties: {
          dealName: { type: 'string', description: 'Deal name/title' },
          amount: { type: 'number', description: 'Deal value in dollars' },
          stage: { type: 'string', description: 'Pipeline stage (e.g. appointmentscheduled, qualifiedtobuy, closedwon)' },
          contactEmail: { type: 'string', description: 'Associated contact email (optional)' },
        },
        required: ['dealName'],
      },
    },
    async (params, runCtx): Promise<ToolResult> => {
      const start = Date.now();
      const p = params as { dealName: string; amount?: number; stage?: string; contactEmail?: string };
      let connectionId = '';

      try {
        const cred = await resolveCredential('hubspot', runCtx.companyId);
        connectionId = cred.connectionId;

        const response = await ctx.http.fetch('https://api.hubapi.com/crm/v3/objects/deals', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cred.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            properties: {
              dealname: p.dealName,
              amount: p.amount?.toString(),
              dealstage: p.stage,
            },
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HubSpot API error ${response.status}: ${text}`);
        }

        const deal = await response.json() as HubSpotDeal;
        const latencyMs = Date.now() - start;

        await logInvocation({
          toolId: 'hubspot',
          action: TOOL_NAMES.hubspotCreateDeal,
          agentId: runCtx.agentId ?? null,
          userId: runCtx.companyId,
          connectionId,
          latencyMs,
          success: true,
          requestSummary: JSON.stringify(p).slice(0, 500),
          responseSummary: JSON.stringify({ id: deal.id, dealname: deal.properties.dealname }).slice(0, 500),
        });

        return {
          content: `Deal created: ${deal.id} ("${deal.properties.dealname ?? p.dealName}")`,
          data: { id: deal.id, dealName: deal.properties.dealname ?? p.dealName },
        };
      } catch (err) {
        const latencyMs = Date.now() - start;
        await logInvocation({
          toolId: 'hubspot',
          action: TOOL_NAMES.hubspotCreateDeal,
          agentId: runCtx.agentId ?? null,
          userId: runCtx.companyId,
          connectionId,
          latencyMs,
          success: false,
          errorMessage: (err as Error).message,
          requestSummary: JSON.stringify(p).slice(0, 500),
        });
        return { error: (err as Error).message };
      }
    },
  );
}
