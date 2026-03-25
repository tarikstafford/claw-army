export const TOOL_CATALOG = [
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', description: 'CRM contacts, deals, companies', authType: 'oauth' as const },
  { id: 'slack', name: 'Slack', category: 'Communication', description: 'Send messages to channels', authType: 'oauth' as const },
  { id: 'google-sheets', name: 'Google Sheets', category: 'Data', description: 'Read and write spreadsheet data', authType: 'oauth' as const },
] as const;

export type ToolCatalogEntry = (typeof TOOL_CATALOG)[number];

export const TOOL_CATEGORIES = ['CRM', 'Communication', 'Data'] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const TOOL_EVENT_TYPES: Record<string, readonly string[]> = {
  hubspot: ['deal.created', 'contact.created', 'company.created'],
  slack: ['message'],
  'google-sheets': ['row.added'],
} as const;
