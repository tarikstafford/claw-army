import type { PaperclipPluginManifestV1 } from '@paperclipai/plugin-sdk';
import { PLUGIN_ID, PLUGIN_VERSION, TOOL_NAMES, WEBHOOK_KEYS } from './constants.js';

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: 'Akasa Tool Nexus',
  description: 'Unified tool gateway for external SaaS integrations — HubSpot, Slack, Google Sheets. Agents invoke these tools to interact with third-party services.',
  author: 'Akasa',
  categories: ['connector', 'automation'],
  capabilities: [
    'agent.tools.register',
    'webhooks.receive',
    'http.outbound',
    'secrets.read-ref',
    'plugin.state.read',
    'plugin.state.write',
    'activity.log.write',
  ],
  entrypoints: {
    worker: './dist/worker.js',
  },
  instanceConfigSchema: {
    akasaPort: {
      type: 'string',
      description: 'Port number of the akasa-server process for internal API calls',
      default: '3100',
    },
  },
  tools: [
    {
      name: TOOL_NAMES.hubspotCreateContact,
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
    {
      name: TOOL_NAMES.hubspotSearchContacts,
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
    {
      name: TOOL_NAMES.hubspotCreateDeal,
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
    {
      name: TOOL_NAMES.slackSendMessage,
      displayName: 'Slack: Send Message',
      description: 'Sends a message to a Slack channel or DM. Supports plain text and basic Markdown formatting.',
      parametersSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Channel name (e.g. #general) or channel ID' },
          text: { type: 'string', description: 'Message text (supports Slack mrkdwn)' },
        },
        required: ['channel', 'text'],
      },
    },
    {
      name: TOOL_NAMES.slackListChannels,
      displayName: 'Slack: List Channels',
      description: 'Lists public channels in the Slack workspace. Returns channel name, ID, and member count.',
      parametersSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max channels to return (default 20, max 100)' },
        },
      },
    },
    {
      name: TOOL_NAMES.sheetsReadRange,
      displayName: 'Google Sheets: Read Range',
      description: 'Reads data from a range in a Google Sheets spreadsheet. Returns a 2D array of cell values.',
      parametersSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Google Sheets spreadsheet ID (from URL)' },
          range: { type: 'string', description: 'A1 notation range (e.g. Sheet1!A1:D10)' },
        },
        required: ['spreadsheetId', 'range'],
      },
    },
    {
      name: TOOL_NAMES.sheetsAppendRow,
      displayName: 'Google Sheets: Append Row',
      description: 'Appends a new row of data to the end of a Google Sheets spreadsheet.',
      parametersSchema: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Google Sheets spreadsheet ID' },
          range: { type: 'string', description: 'Target sheet and optional range (e.g. Sheet1!A:D)' },
          values: { type: 'array', items: { type: 'string' }, description: 'Array of cell values for the new row' },
        },
        required: ['spreadsheetId', 'range', 'values'],
      },
    },
  ],
  webhooks: [
    {
      endpointKey: WEBHOOK_KEYS.hubspot,
      displayName: 'HubSpot Webhook',
      description: 'Receives webhook events from HubSpot (contact created, deal updated, etc.)',
    },
    {
      endpointKey: WEBHOOK_KEYS.slack,
      displayName: 'Slack Events',
      description: 'Receives Slack event API callbacks (messages, reactions, etc.)',
    },
  ],
};

export { manifest };
