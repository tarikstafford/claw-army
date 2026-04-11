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

export const SAMPLE_PAYLOADS: Record<string, Record<string, Record<string, unknown>>> = {
  hubspot: {
    'deal.created': {
      eventType: 'deal.created',
      subscriptionType: 'deal.created',
      objectId: 123456789,
      portalId: 12345678,
      dealName: 'Acme Corp - Enterprise License',
      amount: 50000,
      dealStage: 'appointmentscheduled',
      pipeline: 'default',
      createdAt: Date.now(),
      properties: {
        dealname: { value: 'Acme Corp - Enterprise License' },
        amount: { value: '50000' },
        dealstage: { value: 'appointmentscheduled' },
      },
    },
    'contact.created': {
      eventType: 'contact.created',
      subscriptionType: 'contact.created',
      objectId: 987654321,
      portalId: 12345678,
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      createdAt: Date.now(),
      properties: {
        firstname: { value: 'Jane' },
        lastname: { value: 'Doe' },
        email: { value: 'jane.doe@example.com' },
      },
    },
    'company.created': {
      eventType: 'company.created',
      subscriptionType: 'company.created',
      objectId: 456789123,
      portalId: 12345678,
      name: 'Acme Corporation',
      domain: 'acme.com',
      createdAt: Date.now(),
      properties: {
        name: { value: 'Acme Corporation' },
        domain: { value: 'acme.com' },
      },
    },
  },
  slack: {
    message: {
      type: 'message',
      channel: 'C0123456789',
      user: 'U0123456789',
      text: 'Hello from webhook test!',
      ts: String(Date.now()),
      team: 'T0123456789',
      eventType: 'message',
    },
  },
  'google-sheets': {
    'row.added': {
      eventType: 'row.added',
      spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      spreadsheetName: 'Sales Pipeline Q2',
      sheetName: 'Deals',
      rowValues: ['Acme Corp', 'Enterprise License', '50000', 'Won', '2026-04-15'],
      rowIndex: 42,
      range: 'A5:E5',
    },
  },
} as const;
