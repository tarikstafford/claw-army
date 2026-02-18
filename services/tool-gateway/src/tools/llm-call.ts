import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import type { LlmCallRequest } from '@claw/tool-contracts';

/**
 * Resolve the AI SDK model instance from a model string.
 * - gpt-*, o1*, o3* -> openai provider
 * - claude-* -> anthropic provider
 * - gemini-* -> google provider
 * - default: openai (will error at API level if unrecognized)
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

export interface LlmCallResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Execute the llm_call tool.
 * Routes to the correct LLM provider based on model prefix.
 * Returns content + token counts mapped from AI SDK 6 field names.
 */
export async function executeLlmCall(req: LlmCallRequest): Promise<LlmCallResult> {
  const model = resolveModel(req.args.model);

  const result = await generateText({
    model,
    messages: req.args.messages,
    maxOutputTokens: req.args.maxTokens,
    temperature: req.args.temperature,
  });

  // AI SDK 6 uses inputTokens/outputTokens on usage — map to contract field names
  return {
    content: result.text,
    model: result.response.modelId,
    promptTokens: result.usage.inputTokens ?? 0,
    completionTokens: result.usage.outputTokens ?? 0,
    totalTokens: result.usage.totalTokens ?? 0,
  };
}
