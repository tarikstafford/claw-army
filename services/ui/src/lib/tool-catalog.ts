export const TOOL_CATALOG = [
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', description: 'CRM contacts, deals, companies', authType: 'oauth' as const },
  { id: 'slack', name: 'Slack', category: 'Communication', description: 'Send messages to channels', authType: 'oauth' as const },
  { id: 'google-sheets', name: 'Google Sheets', category: 'Data', description: 'Read and write spreadsheet data', authType: 'oauth' as const },
  { id: 'stripe', name: 'Stripe', category: 'Payments', description: 'Payment processing and invoices', authType: 'oauth' as const },
  { id: 'github', name: 'GitHub', category: 'Development', description: 'Code repositories and pull requests', authType: 'oauth' as const },
  { id: 'linear', name: 'Linear', category: 'Project Management', description: 'Issue tracking and project cycles', authType: 'oauth' as const },
  { id: 'notion', name: 'Notion', category: 'Knowledge', description: 'Wiki pages and databases', authType: 'oauth' as const },
  { id: 'gmail', name: 'Gmail', category: 'Communication', description: 'Email sending and reading', authType: 'oauth' as const },
  { id: 'google-calendar', name: 'Google Calendar', category: 'Scheduling', description: 'Calendar events and scheduling', authType: 'oauth' as const },
] as const;

export type ToolCatalogEntry = (typeof TOOL_CATALOG)[number];

export const TOOL_CATEGORIES = ['CRM', 'Communication', 'Data', 'Payments', 'Development', 'Project Management', 'Knowledge', 'Scheduling'] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const TOOL_EVENT_TYPES: Record<string, readonly string[]> = {
  hubspot: ['deal.created', 'contact.created', 'company.created'],
  slack: ['message'],
  'google-sheets': ['row.added'],
  stripe: ['payment.created', 'invoice.paid', 'subscription.updated'],
  github: ['push', 'pull_request.opened', 'issue.opened'],
  linear: ['issue.created', 'issue.updated', 'cycle.completed'],
  notion: ['page.created', 'page.updated', 'database.updated'],
  gmail: ['message.received'],
  'google-calendar': ['event.created', 'event.updated'],
} as const;