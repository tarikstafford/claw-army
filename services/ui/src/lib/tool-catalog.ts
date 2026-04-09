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

export const SAMPLE_PAYLOADS: Record<string, Record<string, Record<string, unknown>>> = {
  hubspot: {
    'deal.created': {
      eventId: 'sample-event-001',
      eventType: 'deal.created',
      subscriptionType: 'deal.created',
      portalId: 12345678,
      dealId: 9876543210,
      dealName: 'Acme Corp - Enterprise Deal',
      stage: 'appointmentscheduled',
      amount: 50000,
      closedAt: null,
      ownerId: 99999999,
      properties: {
        dealname: { value: 'Acme Corp - Enterprise Deal' },
        amount: { value: '50000' },
        dealstage: { value: 'appointmentscheduled' },
      },
    },
    'contact.created': {
      eventId: 'sample-event-002',
      eventType: 'contact.created',
      subscriptionType: 'contact.created',
      portalId: 12345678,
      contactId: 111222333,
      properties: {
        firstname: { value: 'Jane' },
        lastname: { value: 'Doe' },
        email: { value: 'jane.doe@example.com' },
      },
    },
    'company.created': {
      eventId: 'sample-event-003',
      eventType: 'company.created',
      subscriptionType: 'company.created',
      portalId: 12345678,
      companyId: 444555666,
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
      text: 'Hello from webhook simulation',
      ts: '1234567890.123456',
      team: 'T0123456789',
      channelType: 'channel',
      event: { type: 'message', subtype: undefined },
    },
  },
  'google-sheets': {
    'row.added': {
      spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqJlbs74noAdGg',
      spreadsheetName: 'Sales Tracker',
      sheetId: 0,
      sheetName: 'Sheet1',
      rowIndex: 5,
      values: {
        A: '2024-01-15',
        B: 'Acme Corp',
        C: '$50,000',
        D: 'Closed Won',
      },
      range: 'Sheet1!A5:D5',
    },
  },
} as const;
