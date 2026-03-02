import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

/**
 * Resolve the AI SDK model instance from a model string.
 * - gpt-*, o1*, o3* -> openai provider
 * - claude-* -> anthropic provider
 * - gemini-* -> google provider
 * - default: openai (will fail at API level if model is unrecognized)
 */
export function resolveModel(modelId: string): LanguageModel {
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
