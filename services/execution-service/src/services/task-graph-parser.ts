import { generateText } from 'ai';
import {
  type TaskGraph,
  type TaskGraphNode,
  type TaskComplexity,
  MIN_AGENTS_PER_TASK,
} from '@claw/shared-types';
import { resolveModel } from '../lib/resolve-model.js';

/** Raw task shape expected from LLM output */
interface RawTask {
  taskId: string;
  description: string;
  complexity: TaskComplexity;
  requiredTools: string[];
  dependencies: string[];
}

/**
 * Validate a TaskGraph DAG for cycles and dangling references.
 *
 * Uses Kahn's algorithm (topological sort) to detect cycles.
 * Returns { valid: true } if the graph is a valid DAG, or
 * { valid: false, error: string } describing the problem.
 */
export function validateTaskGraphDAG(graph: TaskGraph): { valid: boolean; error?: string } {
  const tasks = graph.tasks;
  const taskIds = new Set(tasks.map((t) => t.taskId));

  // Check for dangling dependency references
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!taskIds.has(dep)) {
        return {
          valid: false,
          error: `Task "${task.taskId}" has dangling dependency reference: "${dep}"`,
        };
      }
    }
  }

  // Kahn's algorithm for cycle detection
  // inDegree[taskId] = number of dependencies not yet processed
  const inDegree = new Map<string, number>();
  for (const task of tasks) {
    if (!inDegree.has(task.taskId)) {
      inDegree.set(task.taskId, 0);
    }
    for (const dep of task.dependencies) {
      // task depends on dep, so dep has an outgoing edge to task
      // This means task's in-degree increases when dep is processed
      inDegree.set(task.taskId, (inDegree.get(task.taskId) ?? 0) + 1);
    }
  }

  // Reset and recalculate properly using the dag adjacency map
  const inDegreeKahn = new Map<string, number>();
  for (const task of tasks) {
    inDegreeKahn.set(task.taskId, 0);
  }
  // For each task, its dependencies are incoming edges
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      // dep -> task edge: task's in-degree goes up
      inDegreeKahn.set(task.taskId, (inDegreeKahn.get(task.taskId) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegreeKahn) {
    if (deg === 0) queue.push(id);
  }

  let processedCount = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    processedCount++;

    // For each task that depends on current, reduce in-degree
    const downstreams = graph.dag[current] ?? [];
    for (const downstream of downstreams) {
      const newDeg = (inDegreeKahn.get(downstream) ?? 1) - 1;
      inDegreeKahn.set(downstream, newDeg);
      if (newDeg === 0) {
        queue.push(downstream);
      }
    }
  }

  if (processedCount !== tasks.length) {
    // Find the cycle members for a helpful error message
    const cycleNodes = tasks
      .map((t) => t.taskId)
      .filter((id) => (inDegreeKahn.get(id) ?? 0) > 0);
    return {
      valid: false,
      error: `Cycle detected in task graph involving tasks: ${cycleNodes.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Build the DAG adjacency map from tasks.
 * dag[A] = [B, C] means A must complete before B and C can start.
 */
function buildDag(tasks: TaskGraphNode[]): Record<string, string[]> {
  const dag: Record<string, string[]> = {};
  // Initialize all nodes
  for (const task of tasks) {
    if (!dag[task.taskId]) {
      dag[task.taskId] = [];
    }
  }
  // For each task, its dependencies point to it (dep -> task)
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!dag[dep]) {
        dag[dep] = [];
      }
      dag[dep]!.push(task.taskId);
    }
  }
  return dag;
}

/**
 * Determine recommended population based on complexity.
 */
function recommendedPopulation(complexity: TaskComplexity): number {
  switch (complexity) {
    case 'low':
      return 3;
    case 'medium':
      return 4;
    case 'high':
      return 5;
  }
}

/**
 * Build a flat fallback TaskGraph — all tasks independent, medium complexity.
 * Used when the LLM output is not valid JSON or fails validation.
 */
function buildFallbackGraph(objective: string, maxTasks: number): TaskGraph {
  const tasks: TaskGraphNode[] = Array.from({ length: maxTasks }, (_, i) => {
    const taskId = `task-${i + 1}`;
    return {
      taskId,
      description: `${objective.trim()} (subtask ${i + 1} of ${maxTasks})`,
      complexity: 'medium',
      requiredTools: [],
      dependencies: [],
      parallelizable: true,
      minPopulation: MIN_AGENTS_PER_TASK,
      recommendedPopulation: 4,
    };
  });

  const dag = buildDag(tasks);
  return { tasks, dag };
}

/**
 * Decompose a user objective into a validated DAG of tasks with complexity
 * labels, tool requirements, dependencies, and population sizes.
 *
 * Uses the LLM directly (not through the Tool Gateway) per locked user
 * decision #3 — execution-service is a trusted internal service.
 *
 * Falls back to a flat graph (all tasks independent, medium complexity) if
 * the LLM output is not valid JSON or fails DAG validation.
 *
 * @param objective - High-level objective to decompose
 * @param allowedTools - Tools available to agents for this execution
 * @param maxTasks - Maximum number of tasks to produce (default: 5)
 * @returns A validated TaskGraph DAG
 */
export async function parseObjectiveToTaskGraph(
  objective: string,
  allowedTools: string[],
  maxTasks = 5,
): Promise<TaskGraph> {
  const modelId = process.env.PLANNER_MODEL ?? 'gpt-4o-mini';
  const model = resolveModel(modelId);

  const toolList =
    allowedTools.length > 0 ? allowedTools.join(', ') : 'none';

  const { text } = await generateText({
    model,
    system: `You are a task decomposition agent. Given a high-level objective, break it into at most ${maxTasks} tasks as a directed acyclic graph (DAG).

Return ONLY a JSON object with a "tasks" array. Each task object must have:
- "taskId": a unique string identifier (e.g. "task-1", "task-2")
- "description": a concise description of the task
- "complexity": one of "low", "medium", or "high"
- "requiredTools": an array of tool names needed (must be a subset of the provided allowed tools). Only use tools from the provided allowedTools list: [${toolList}]. If no specific tools are required or allowed tools is none, use an empty array.
- "dependencies": an array of taskId strings this task depends on (empty array for root tasks that can start immediately)

Tasks form a DAG — if task B depends on task A, task A must complete before task B starts. Do not create cycles. Root tasks (no dependencies) can run in parallel.

Return ONLY valid JSON. No other text, no markdown, no code fences.`,
    prompt: objective,
    temperature: 0.3,
  });

  let rawTasks: RawTask[];

  try {
    const parsed = JSON.parse(text) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as { tasks?: unknown }).tasks)
    ) {
      throw new Error('LLM response missing "tasks" array');
    }

    const rawArray = (parsed as { tasks: unknown[] }).tasks;
    rawTasks = rawArray.slice(0, maxTasks).map((item, index) => {
      const t = item as Record<string, unknown>;
      const taskId =
        typeof t['taskId'] === 'string' ? t['taskId'] : `task-${index + 1}`;
      const description =
        typeof t['description'] === 'string'
          ? t['description']
          : `Task ${index + 1}`;
      const complexity: TaskComplexity =
        t['complexity'] === 'low' ||
        t['complexity'] === 'medium' ||
        t['complexity'] === 'high'
          ? t['complexity']
          : 'medium';
      const requiredTools = Array.isArray(t['requiredTools'])
        ? (t['requiredTools'] as unknown[])
            .filter((tool) => typeof tool === 'string')
            .filter(
              (tool) =>
                allowedTools.length === 0 || allowedTools.includes(tool as string),
            )
        : [];
      const dependencies = Array.isArray(t['dependencies'])
        ? (t['dependencies'] as unknown[]).filter(
            (dep) => typeof dep === 'string',
          )
        : [];
      return { taskId, description, complexity, requiredTools, dependencies } as RawTask;
    });
  } catch (err) {
    console.warn(
      '[task-graph-parser] LLM output was not valid JSON or missing tasks, falling back to flat graph:',
      err instanceof Error ? err.message : String(err),
    );
    return buildFallbackGraph(objective, maxTasks);
  }

  // Build TaskGraphNode array
  const taskNodes: TaskGraphNode[] = rawTasks.map((raw) => ({
    taskId: raw.taskId,
    description: raw.description,
    complexity: raw.complexity,
    requiredTools: raw.requiredTools,
    dependencies: raw.dependencies,
    parallelizable: raw.dependencies.length === 0,
    minPopulation: MIN_AGENTS_PER_TASK,
    recommendedPopulation: recommendedPopulation(raw.complexity),
  }));

  const dag = buildDag(taskNodes);
  const graph: TaskGraph = { tasks: taskNodes, dag };

  // Validate the DAG
  const validation = validateTaskGraphDAG(graph);
  if (!validation.valid) {
    console.warn(
      `[task-graph-parser] DAG validation failed (${validation.error}), falling back to flat graph`,
    );
    return buildFallbackGraph(objective, maxTasks);
  }

  return graph;
}
