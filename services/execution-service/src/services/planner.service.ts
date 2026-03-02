import { generateText } from 'ai';
import { type TaskGraph } from '@claw/shared-types';
import { resolveModel } from '../lib/resolve-model.js';
import { parseObjectiveToTaskGraph } from './task-graph-parser.js';

export interface PlannedTask {
  description: string;
}

/**
 * Decompose a high-level objective into a structured TaskGraph DAG.
 *
 * Delegates to parseObjectiveToTaskGraph which handles LLM communication,
 * DAG validation, cycle detection, and fallback graph construction.
 *
 * @param objective - High-level objective to decompose
 * @param allowedTools - Tools available to agents for this execution
 * @param maxTasks - Maximum number of tasks to produce (default: 5)
 * @returns A validated TaskGraph
 */
export async function planObjectiveAsTaskGraph(
  objective: string,
  allowedTools: string[],
  maxTasks = 5,
): Promise<TaskGraph> {
  return parseObjectiveToTaskGraph(objective, allowedTools, maxTasks);
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
