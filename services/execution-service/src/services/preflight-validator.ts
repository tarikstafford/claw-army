import { type TaskGraph } from '@claw/shared-types';
import { validateTaskGraphDAG } from './task-graph-parser.js';

export interface PreFlightError {
  code: 'TOOL_GRANT_INSUFFICIENT' | 'BUDGET_INSUFFICIENT' | 'INVALID_TASK_GRAPH';
  message: string;
  details: Record<string, unknown>;
}

export interface PreFlightResult {
  valid: boolean;
  errors: PreFlightError[];
  totalMinPopulation: number;       // sum of minPopulation across all tasks
  totalRecommendedPopulation: number; // sum of recommendedPopulation
  estimatedMinCostCents: number;    // rough floor estimate for budget check
}

/**
 * Validate a task graph submission before spawning the Ring Leader.
 *
 * Checks (all run, errors accumulate):
 * 1. Structural DAG validity (cycles, dangling refs)
 * 2. Tool grants cover every requiredTools entry across all tasks
 * 3. Budget cap (if > 0) can fund the minimum population
 *
 * budgetCapCents === 0 means "no cap" — budget check is skipped.
 */
export function validatePreFlight(
  taskGraph: TaskGraph,
  toolGrants: string[],
  budgetCapCents: number,
): PreFlightResult {
  const errors: PreFlightError[] = [];

  // ── 1. Structural validation ─────────────────────────────────────────────
  const dagResult = validateTaskGraphDAG(taskGraph);
  if (!dagResult.valid) {
    errors.push({
      code: 'INVALID_TASK_GRAPH',
      message: dagResult.error ?? 'Task graph failed structural validation',
      details: {},
    });
  }

  // ── 2. Tool grant validation ──────────────────────────────────────────────
  // Collect missing tools per task, then aggregate into one error.
  const grantSet = new Set(toolGrants);
  const missingByTask: Map<string, string[]> = new Map();

  for (const task of taskGraph.tasks) {
    const missing = task.requiredTools.filter((tool) => !grantSet.has(tool));
    if (missing.length > 0) {
      missingByTask.set(task.taskId, missing);
    }
  }

  if (missingByTask.size > 0) {
    const affectedTasks = [...missingByTask.keys()];
    const allMissing = [...new Set([...missingByTask.values()].flat())];
    errors.push({
      code: 'TOOL_GRANT_INSUFFICIENT',
      message: `Tasks [${affectedTasks.join(', ')}] require tools [${allMissing.join(', ')}] which are not in the granted tool set`,
      details: {
        affectedTasks,
        missingTools: allMissing,
        missingByTask: Object.fromEntries(missingByTask),
      },
    });
  }

  // ── 3. Population & budget computation ───────────────────────────────────
  const totalMinPopulation = taskGraph.tasks.reduce(
    (sum, task) => sum + task.minPopulation,
    0,
  );
  const totalRecommendedPopulation = taskGraph.tasks.reduce(
    (sum, task) => sum + task.recommendedPopulation,
    0,
  );

  const costPerAgent = process.env['ESTIMATED_AGENT_COST_CENTS']
    ? parseInt(process.env['ESTIMATED_AGENT_COST_CENTS'], 10)
    : 50;

  const estimatedMinCostCents = totalMinPopulation * costPerAgent;

  // Budget cap of 0 means "no cap" — skip budget validation.
  if (budgetCapCents > 0 && estimatedMinCostCents > budgetCapCents) {
    const shortfallCents = estimatedMinCostCents - budgetCapCents;
    errors.push({
      code: 'BUDGET_INSUFFICIENT',
      message:
        `Budget cap of ${budgetCapCents}c cannot fund the minimum population of ${totalMinPopulation} agents ` +
        `(estimated minimum cost: ${estimatedMinCostCents}c). ` +
        `Increase budget to at least ${estimatedMinCostCents}c or reduce objective scope.`,
      details: {
        totalMinPopulation,
        estimatedMinCostCents,
        budgetCapCents,
        shortfallCents,
      },
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    totalMinPopulation,
    totalRecommendedPopulation,
    estimatedMinCostCents,
  };
}
