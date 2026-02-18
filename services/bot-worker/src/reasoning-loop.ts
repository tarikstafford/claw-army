import { generateText, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { callGateway } from './tools/gateway-proxy.js';

/**
 * Resolve the AI SDK model instance from a model string.
 * - gpt-*, o1*, o3* -> openai provider
 * - claude-* -> anthropic provider
 * - gemini-* -> google provider
 * - default: openai (will fail at API level if model is unrecognized)
 */
function resolveModel(modelId: string) {
  if (
    modelId.startsWith('gpt-') ||
    modelId.startsWith('o1') ||
    modelId.startsWith('o3')
  ) {
    return openai(modelId);
  }
  if (modelId.startsWith('claude-')) {
    return anthropic(modelId);
  }
  if (modelId.startsWith('gemini-')) {
    return google(modelId);
  }
  // Default to OpenAI — will fail at API level if model is unrecognized
  return openai(modelId);
}

// ──────────────────────────────────────────────────────────────────────────────
// Tool parameter schemas (mirror @claw/tool-contracts args shapes for the AI SDK)
// Defined separately to avoid Zod v4 FlexibleSchema compatibility issues.
// ──────────────────────────────────────────────────────────────────────────────

const llmCallParams = z.object({
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    }),
  ),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const fetchUrlParams = z.object({
  url: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
});

const writeFileParams = z.object({
  path: z.string(),
  content: z.string(),
  encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
});

type LlmCallArgs = z.infer<typeof llmCallParams>;
type FetchUrlArgs = z.infer<typeof fetchUrlParams>;
type WriteFileArgs = z.infer<typeof writeFileParams>;

/**
 * Run the LLM reasoning loop for a single task.
 *
 * Uses generateText with tool definitions that proxy all tool calls through
 * the Tool Gateway HTTP endpoint. All enforcement (auth, allowlist, rate limiting,
 * schema validation) happens in the gateway — the bot is an untrusted caller.
 *
 * @param taskDescription - Human-readable description of the task to execute
 * @returns The model's final text output after all tool calls complete
 */
export async function runReasoningLoop(taskDescription: string): Promise<string> {
  const modelId = process.env.LLM_MODEL ?? 'gpt-4o-mini';
  const model = resolveModel(modelId);

  const result = await generateText({
    model,
    system:
      'You are a task-execution agent. Complete the given task using the available tools. When the task is done, respond with a summary of what you accomplished.',
    prompt: taskDescription,
    tools: {
      llm_call: {
        description: 'Call an LLM to generate text from messages',
        inputSchema: llmCallParams,
        execute: async (args: LlmCallArgs) => callGateway('llm_call', args),
      },
      fetch_url: {
        description: 'Fetch a URL via HTTP',
        inputSchema: fetchUrlParams,
        execute: async (args: FetchUrlArgs) => callGateway('fetch_url', args),
      },
      write_file: {
        description: 'Write content to a file',
        inputSchema: writeFileParams,
        execute: async (args: WriteFileArgs) => callGateway('write_file', args),
      },
    },
    stopWhen: stepCountIs(20),
    onStepFinish: (step) => {
      console.log('[reasoning-loop] Step finished:', {
        finishReason: step.finishReason,
        toolCallCount: step.toolCalls.length,
      });
    },
  });

  return result.text;
}
