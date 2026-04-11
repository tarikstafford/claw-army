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
      eventId: 'evt_1234567890',
      eventType: 'deal.created',
      timestamp: '2026-04-08T10:30:00Z',
      objectId: 12345,
      objectType: 'deal',
      properties: {
        amount: '50000',
        dealname: 'Acme Corp Deal',
        dealstage: 'appointmentscheduled',
        closedate: '2026-06-30',
        pipeline: 'default',
      },
      subscriptionType: 'deal.created',
      portalId: 999999,
    },
    'contact.created': {
      eventId: 'evt_0987654321',
      eventType: 'contact.created',
      timestamp: '2026-04-08T10:30:00Z',
      objectId: 11111,
      objectType: 'contact',
      properties: {
        firstname: 'Jane',
        lastname: 'Doe',
        email: 'jane.doe@example.com',
        phone: '+1-555-0100',
        company: 'Acme Corp',
      },
      subscriptionType: 'contact.created',
      portalId: 999999,
    },
    'company.created': {
      eventId: 'evt_5555555555',
      eventType: 'company.created',
      timestamp: '2026-04-08T10:30:00Z',
      objectId: 22222,
      objectType: 'company',
      properties: {
        name: 'Acme Corporation',
        domain: 'acme.com',
        industry: 'Technology',
        phone: '+1-555-0101',
      },
      subscriptionType: 'company.created',
      portalId: 999999,
    },
  },
  slack: {
    message: {
      type: 'event_callback',
      event: {
        type: 'message',
        channel: 'C0123456789',
        user: 'U0123456789',
        text: 'Hello from webhook test',
        ts: '1709915400.000000',
        team: 'T0123456789',
        channel_type: 'channel',
      },
      team_id: 'T0123456789',
      api_app_id: 'A0123456789',
    },
  },
  'google-sheets': {
    'row.added': {
      spreadsheetId: '1BxiMVs0XQA5',
      spreadsheetName: 'Sales Data',
      sheetTitle: 'Sheet1',
      rowIndex: 5,
      rowData: {
        values: [
          { formattedValue: 'Q2 Widget Sales', userEnteredValue: { stringValue: 'Q2 Widget Sales' } },
          { formattedValue: '1500', userEnteredValue: { numberValue: 1500 } },
          { formattedValue: '2026-04-08', userEnteredValue: { stringValue: '2026-04-08' } },
        ],
      },
      insertedCellValues: ['Q2 Widget Sales', 1500, '2026-04-08'],
    },
  },
} as const;
