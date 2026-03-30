import { definePlugin } from '@paperclipai/plugin-sdk';
import { registerHubSpotTools } from './connectors/hubspot.js';
import { registerSlackTools } from './connectors/slack.js';
import { registerGoogleSheetsTools } from './connectors/google-sheets.js';
import { setAkasaPort } from './services/credential-bridge.js';

export default definePlugin({
  async setup(ctx) {
    // Read akasaPort from plugin config (set by ensureToolNexusPlugin after install)
    try {
      const config = await ctx.config.get() as { akasaPort?: string };
      if (config.akasaPort) {
        setAkasaPort(config.akasaPort);
        ctx.logger.info('Akasa Tool Nexus: using configured port', { port: config.akasaPort });
      }
    } catch {
      ctx.logger.warn('Akasa Tool Nexus: could not read config, using default port 3100');
    }

    ctx.logger.info('Akasa Tool Nexus plugin initialized');

    await registerHubSpotTools(ctx);
    await registerSlackTools(ctx);
    await registerGoogleSheetsTools(ctx);

    ctx.logger.info('Akasa Tool Nexus: all connectors registered', {
      connectors: ['hubspot', 'slack', 'google-sheets'],
    });
  },

  async onConfigChanged(ctx, config) {
    const typed = config as { akasaPort?: string };
    if (typed.akasaPort) {
      setAkasaPort(typed.akasaPort);
      ctx.logger.info('Akasa Tool Nexus: port updated from config', { port: typed.akasaPort });
    }
  },
});
