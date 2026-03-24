import type { PluginContext, ToolResult } from '@paperclipai/plugin-sdk';
import { TOOL_NAMES } from '../constants.js';
import { logInvocation } from '../services/invocation-logger.js';
import { resolveCredential } from '../services/credential-bridge.js';

// ─── Slack API types ──────────────────────────────────────────────────────────

interface SlackPostMessageResponse {
  ok: boolean;
  ts?: string;
  channel?: string;
  error?: string;
}

interface SlackChannel {
  id: string;
  name: string;
  num_members: number;
}

interface SlackConversationsListResponse {
  ok: boolean;
  channels?: SlackChannel[];
  error?: string;
}

// ─── Tool registration ────────────────────────────────────────────────────────

export async function registerSlackTools(ctx: PluginContext): Promise<void> {
  // ── slack:send-message ──────────────────────────────────────────────────────
  ctx.tools.register(
    TOOL_NAMES.slackSendMessage,
    {
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
    async (params, runCtx): Promise<ToolResult> => {
      const start = Date.now();
      const p = params as { channel: string; text: string };
      let connectionId = '';

      try {
        const cred = await resolveCredential('slack', runCtx.companyId);
        connectionId = cred.connectionId;

        const response = await ctx.http.fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cred.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ channel: p.channel, text: p.text }),
        });

        if (!response.ok) {
          throw new Error(`Slack HTTP error ${response.status}`);
        }

        const result = await response.json() as SlackPostMessageResponse;
        if (!result.ok) {
          throw new Error(`Slack API error: ${result.error ?? 'unknown'}`);
        }

        const latencyMs = Date.now() - start;
        await logInvocation({
          toolId: 'slack',
          action: TOOL_NAMES.slackSendMessage,
          agentId: runCtx.agentId ?? null,
          userId: runCtx.companyId,
          connectionId,
          latencyMs,
          success: true,
          requestSummary: JSON.stringify({ channel: p.channel, textLength: p.text.length }).slice(0, 500),
          responseSummary: JSON.stringify({ ok: result.ok, ts: result.ts, channel: result.channel }).slice(0, 500),
        });

        return {
          content: `Message sent to ${p.channel} (ts: ${result.ts ?? 'n/a'})`,
          data: { ok: result.ok, ts: result.ts, channel: result.channel },
        };
      } catch (err) {
        const latencyMs = Date.now() - start;
        await logInvocation({
          toolId: 'slack',
          action: TOOL_NAMES.slackSendMessage,
          agentId: runCtx.agentId ?? null,
          userId: runCtx.companyId,
          connectionId,
          latencyMs,
          success: false,
          errorMessage: (err as Error).message,
          requestSummary: JSON.stringify({ channel: p.channel }).slice(0, 500),
        });
        return { error: (err as Error).message };
      }
    },
  );

  // ── slack:list-channels ─────────────────────────────────────────────────────
  ctx.tools.register(
    TOOL_NAMES.slackListChannels,
    {
      displayName: 'Slack: List Channels',
      description: 'Lists public channels in the Slack workspace. Returns channel name, ID, and member count.',
      parametersSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max channels to return (default 20, max 100)' },
        },
      },
    },
    async (params, runCtx): Promise<ToolResult> => {
      const start = Date.now();
      const p = params as { limit?: number };
      let connectionId = '';

      try {
        const cred = await resolveCredential('slack', runCtx.companyId);
        connectionId = cred.connectionId;

        const limit = Math.min(p.limit ?? 20, 100);
        const url = `https://slack.com/api/conversations.list?types=public_channel&limit=${limit}`;

        const response = await ctx.http.fetch(url, {
          headers: { Authorization: `Bearer ${cred.token}` },
        });

        if (!response.ok) {
          throw new Error(`Slack HTTP error ${response.status}`);
        }

        const result = await response.json() as SlackConversationsListResponse;
        if (!result.ok) {
          throw new Error(`Slack API error: ${result.error ?? 'unknown'}`);
        }

        const channels = (result.channels ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          num_members: c.num_members,
        }));

        const latencyMs = Date.now() - start;
        await logInvocation({
          toolId: 'slack',
          action: TOOL_NAMES.slackListChannels,
          agentId: runCtx.agentId ?? null,
          userId: runCtx.companyId,
          connectionId,
          latencyMs,
          success: true,
          requestSummary: JSON.stringify({ limit }).slice(0, 500),
          responseSummary: JSON.stringify({ count: channels.length }).slice(0, 500),
        });

        return {
          content: `Found ${channels.length} public channels`,
          data: { channels },
        };
      } catch (err) {
        const latencyMs = Date.now() - start;
        await logInvocation({
          toolId: 'slack',
          action: TOOL_NAMES.slackListChannels,
          agentId: runCtx.agentId ?? null,
          userId: runCtx.companyId,
          connectionId,
          latencyMs,
          success: false,
          errorMessage: (err as Error).message,
        });
        return { error: (err as Error).message };
      }
    },
  );
}
