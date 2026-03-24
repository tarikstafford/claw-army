import { definePlugin } from '@paperclipai/plugin-sdk';
import { registerHubSpotTools } from './connectors/hubspot.js';
import { registerSlackTools } from './connectors/slack.js';
import { registerGoogleSheetsTools } from './connectors/google-sheets.js';

export default definePlugin({
  async setup(ctx) {
    ctx.logger.info('Akasa Tool Nexus plugin initialized');

    await registerHubSpotTools(ctx);
    await registerSlackTools(ctx);
    await registerGoogleSheetsTools(ctx);

    ctx.logger.info('Akasa Tool Nexus: all connectors registered', {
      connectors: ['hubspot', 'slack', 'google-sheets'],
    });
  },
});
