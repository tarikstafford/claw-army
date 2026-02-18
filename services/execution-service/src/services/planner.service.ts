import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export interface PlannedTask {
  description: string;
}

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

/**
 * Decompose a high-level objective into independent, parallelizable subtasks.
 *
 * Uses the LLM directly (not through the Tool Gateway) per locked user decision #3.
 * The execution-service is a trusted internal service, not an untrusted bot caller.
 *
 * Falls back to numbered-subtask decomposition if the LLM output is not valid JSON,
 * to ensure the execution pipeline never stalls due to planner failures.
 *
 * @param objective - High-level objective to decompose
 * @param maxTasks - Maximum number of subtasks to produce (default: 3)
 * @returns Array of planned tasks with descriptions
 */
export async function planObjective(objective: string, maxTasks = 3): Promise<PlannedTask[]> {
  const modelId = process.env.PLANNER_MODEL ?? 'gpt-4o-mini';
  const model = resolveModel(modelId);

  const { text } = await generateText({
    model,
    system: `You are a task decomposition agent. Given a high-level objective, break it into ${maxTasks} independent, parallelizable subtasks. Each subtask should be self-contained and completable by a single AI agent with access to tools (llm_call, fetch_url, write_file). Return ONLY a JSON array of objects with a "description" field for each subtask. No other text.`,
    prompt: objective,
    temperature: 0.3,
  });

  // Parse the LLM response as JSON array
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Not an array');
    return (parsed as { description?: string }[]).slice(0, maxTasks).map((item) => ({
      description: item.description ?? String(item),
    }));
  } catch {
    // Fallback: if LLM output isn't valid JSON, split into numbered subtasks
    console.warn('[planner] LLM output was not valid JSON, falling back to stub decomposition');
    const trimmed = objective.trim();
    return Array.from({ length: maxTasks }, (_, i) => ({
      description: `${trimmed} (subtask ${i + 1} of ${maxTasks})`,
    }));
  }
}
