export interface PlannedTask {
  description: string;
}

/**
 * Stub planner: decomposes objective into N parallel tasks.
 * Phase 3 replaces this with real LLM decomposition.
 *
 * Strategy: Split objective into maxTasks independent subtasks.
 * Each task gets a numbered description derived from the objective.
 */
export function planObjective(objective: string, maxTasks = 3): PlannedTask[] {
  const trimmed = objective.trim();
  return Array.from({ length: maxTasks }, (_, i) => ({
    description: `${trimmed} (subtask ${i + 1} of ${maxTasks})`,
  }));
}
