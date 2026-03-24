export const PLUGIN_ID = 'akasa.tool-nexus';
export const PLUGIN_VERSION = '0.1.0';

export const TOOL_NAMES = {
  // HubSpot
  hubspotCreateContact: 'hubspot:create-contact',
  hubspotSearchContacts: 'hubspot:search-contacts',
  hubspotCreateDeal: 'hubspot:create-deal',
  // Slack
  slackSendMessage: 'slack:send-message',
  slackListChannels: 'slack:list-channels',
  // Google Sheets
  sheetsReadRange: 'sheets:read-range',
  sheetsAppendRow: 'sheets:append-row',
} as const;

export const WEBHOOK_KEYS = {
  hubspot: 'hubspot-webhook',
  slack: 'slack-events',
} as const;
