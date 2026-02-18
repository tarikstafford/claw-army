import { randomUUID } from 'node:crypto';

const TOOL_GATEWAY_URL = process.env.TOOL_GATEWAY_URL ?? 'http://tool-gateway:3002';

/**
 * Thin HTTP proxy that routes all tool calls through the Tool Gateway.
 *
 * The bot-worker is an untrusted caller. All enforcement (auth, allowlist,
 * rate limiting, schema validation) happens in the Tool Gateway.
 * This function is intentionally minimal — just a POST relay.
 *
 * @param toolName - Tool identifier (e.g. 'llm_call', 'fetch_url', 'write_file')
 * @param args - Tool-specific arguments (validated by gateway Zod schemas)
 * @returns The tool result from the gateway response
 */
export async function callGateway(toolName: string, args: unknown): Promise<unknown> {
  const botJwt = process.env.BOT_JWT;
  const botId = process.env.BOT_ID ?? '';
  const executionId = process.env.EXECUTION_ID ?? '';

  const body = {
    toolName,
    botId,
    executionId,
    invocationId: randomUUID(),
    timestamp: new Date().toISOString(),
    args,
  };

  const response = await fetch(`${TOOL_GATEWAY_URL}/tool.invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${botJwt}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as { success: boolean; result?: unknown; error?: string };

  if (!data.success) {
    throw new Error(data.error ?? 'Tool invocation failed');
  }

  return data.result;
}
