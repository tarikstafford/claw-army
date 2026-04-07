import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePreFlight, type PreFlightResult } from '../../services/preflight-validator.js';
import type { TaskGraph, TaskGraphNode } from '@claw/shared-types';

vi.mock('../../services/task-graph-parser.js', () => ({
  validateTaskGraphDAG: vi.fn(),
}));

function makeTaskGraphNode(overrides: Partial<TaskGraphNode> = {}): TaskGraphNode {
  return {
    taskId: 'task-1',
    description: 'Test task',
    complexity: 'medium',
    requiredTools: ['tool-a'],
    dependencies: [],
    parallelizable: true,
    minPopulation: 3,
    recommendedPopulation: 4,
    ...overrides,
  };
}

function makeTaskGraph(tasks: TaskGraphNode[]): TaskGraph {
  const dag: Record<string, string[]> = {};
  for (const task of tasks) {
    dag[task.taskId] = task.dependencies;
  }
  return { tasks, dag };
}

describe('preflight-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validatePreFlight', () => {
    describe('DAG structural validation', () => {
      it('returns INVALID_TASK_GRAPH error when DAG validation fails', async () => {
        const { validateTaskGraphDAG } = await import('../../services/task-graph-parser.js');
        vi.mocked(validateTaskGraphDAG).mockReturnValue({
          valid: false,
          error: 'Cycle detected in task graph',
        });

        const graph = makeTaskGraph([makeTaskGraphNode()]);
        const result = validatePreFlight(graph, ['tool-a'], 1000);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'INVALID_TASK_GRAPH')).toBe(true);
      });

      it('passes DAG validation when graph is valid', async () => {
        const { validateTaskGraphDAG } = await import('../../services/task-graph-parser.js');
        vi.mocked(validateTaskGraphDAG).mockReturnValue({ valid: true });

        const graph = makeTaskGraph([makeTaskGraphNode()]);
        const result = validatePreFlight(graph, ['tool-a'], 1000);

        expect(result.errors.filter(e => e.code === 'INVALID_TASK_GRAPH')).toHaveLength(0);
      });
    });

    describe('tool grant validation', () => {
      it('returns TOOL_GRANT_INSUFFICIENT when task requires tools not in grants', async () => {
        const { validateTaskGraphDAG } = await import('../../services/task-graph-parser.js');
        vi.mocked(validateTaskGraphDAG).mockReturnValue({ valid: true });

        const graph = makeTaskGraph([
          makeTaskGraphNode({
            taskId: 'task-1',
            requiredTools: ['tool-a', 'tool-b'],
          }),
        ]);

        const result = validatePreFlight(graph, ['tool-a'], 1000);

        expect(result.valid).toBe(false);
        const toolError = result.errors.find(e => e.code === 'TOOL_GRANT_INSUFFICIENT');
        expect(toolError).toBeDefined();
        expect(toolError!.details.missingTools).toContain('tool-b');
      });

      it('passes tool grant validation when all required tools are granted', async () => {
        const { validateTaskGraphDAG } = await import('../../services/task-graph-parser.js');
        vi.mocked(validateTaskGraphDAG).mockReturnValue({ valid: true });

        const graph = makeTaskGraph([
          makeTaskGraphNode({
            taskId: 'task-1',
            requiredTools: ['tool-a'],
          }),
        ]);

        const result = validatePreFlight(graph, ['tool-a', 'tool-b'], 1000);

        expect(result.errors.filter(e => e.code === 'TOOL_GRANT_INSUFFICIENT')).toHaveLength(0);
      });

      it('accumulates missing tools across multiple tasks', async () => {
        const { validateTaskGraphDAG } = await import('../../services/task-graph-parser.js');
        vi.mocked(validateTaskGraphDAG).mockReturnValue({ valid: true });

        const graph = makeTaskGraph([
          makeTaskGraphNode({ taskId: 'task-1', requiredTools: ['tool-a'] }),
          makeTaskGraphNode({ taskId: 'task-2', requiredTools: ['tool-b'] }),
        ]);

        const result = validatePreFlight(graph, ['tool-a'], 1000);

        expect(result.valid).toBe(false);
        const toolError = result.errors.find(e => e.code === 'TOOL_GRANT_INSUFFICIENT');
        expect(toolError!.details.affectedTasks).toContain('task-2');
      });
    });

    describe('budget validation', () => {
      it('returns BUDGET_INSUFFICIENT when estimated min cost exceeds budget cap', async () => {
        const { validateTaskGraphDAG } = await import('../../services/task-graph-parser.js');
        vi.mocked(validateTaskGraphDAG).mockReturnValue({ valid: true });

        vi.stubEnv('ESTIMATED_AGENT_COST_CENTS', '50');

        const graph = makeTaskGraph([
          makeTaskGraphNode({ taskId: 'task-1', minPopulation: 10 }),
        ]);

        const result = validatePreFlight(graph, ['tool-a'], 200);

        expect(result.valid).toBe(false);
        const budgetError = result.errors.find(e => e.code === 'BUDGET_INSUFFICIENT');
        expect(budgetError).toBeDefined();
        expect(budgetError!.details.shortfallCents).toBeGreaterThan(0);
      });

      it('skips budget validation when budgetCapCents is 0 (no cap)', async () => {
        const { validateTaskGraphDAG } = await import('../../services/task-graph-parser.js');
        vi.mocked(validateTaskGraphDAG).mockReturnValue({ valid: true });

        vi.stubEnv('ESTIMATED_AGENT_COST_CENTS', '50');

        const graph = makeTaskGraph([
          makeTaskGraphNode({ taskId: 'task-1', minPopulation: 100 }),
        ]);

        const result = validatePreFlight(graph, ['tool-a'], 0);

        expect(result.errors.filter(e => e.code === 'BUDGET_INSUFFICIENT')).toHaveLength(0);
        expect(result.valid).toBe(true);
      });

      it('passes budget validation when estimated cost is within budget', async () => {
        const { validateTaskGraphDAG } = await import('../../services/task-graph-parser.js');
        vi.mocked(validateTaskGraphDAG).mockReturnValue({ valid: true });

        vi.stubEnv('ESTIMATED_AGENT_COST_CENTS', '50');

        const graph = makeTaskGraph([
          makeTaskGraphNode({ taskId: 'task-1', minPopulation: 3 }),
        ]);

        const result = validatePreFlight(graph, ['tool-a'], 1000);

        expect(result.errors.filter(e => e.code === 'BUDGET_INSUFFICIENT')).toHaveLength(0);
      });
    });

    describe('population totals', () => {
      it('calculates totalMinPopulation correctly', async () => {
        const { validateTaskGraphDAG } = await import('../../services/task-graph-parser.js');
        vi.mocked(validateTaskGraphDAG).mockReturnValue({ valid: true });

        const graph = makeTaskGraph([
          makeTaskGraphNode({ taskId: 'task-1', minPopulation: 3 }),
          makeTaskGraphNode({ taskId: 'task-2', minPopulation: 5 }),
        ]);

        const result = validatePreFlight(graph, ['tool-a'], 1000);

        expect(result.totalMinPopulation).toBe(8);
      });

      it('calculates totalRecommendedPopulation correctly', async () => {
        const { validateTaskGraphDAG } = await import('../../services/task-graph-parser.js');
        vi.mocked(validateTaskGraphDAG).mockReturnValue({ valid: true });

        const graph = makeTaskGraph([
          makeTaskGraphNode({ taskId: 'task-1', recommendedPopulation: 4 }),
          makeTaskGraphNode({ taskId: 'task-2', recommendedPopulation: 6 }),
        ]);

        const result = validatePreFlight(graph, ['tool-a'], 1000);

        expect(result.totalRecommendedPopulation).toBe(10);
      });

      it('calculates estimatedMinCostCents using ESTIMATED_AGENT_COST_CENTS env var', async () => {
        const { validateTaskGraphDAG } = await import('../../services/task-graph-parser.js');
        vi.mocked(validateTaskGraphDAG).mockReturnValue({ valid: true });

        vi.stubEnv('ESTIMATED_AGENT_COST_CENTS', '75');

        const graph = makeTaskGraph([
          makeTaskGraphNode({ taskId: 'task-1', minPopulation: 4 }),
        ]);

        const result = validatePreFlight(graph, ['tool-a'], 1000);

        expect(result.estimatedMinCostCents).toBe(300);
      });

      it('defaults to 50 cents per agent when ESTIMATED_AGENT_COST_CENTS is not set', async () => {
        const { validateTaskGraphDAG } = await import('../../services/task-graph-parser.js');
        vi.mocked(validateTaskGraphDAG).mockReturnValue({ valid: true });

        vi.stubEnv('ESTIMATED_AGENT_COST_CENTS', '');

        const graph = makeTaskGraph([
          makeTaskGraphNode({ taskId: 'task-1', minPopulation: 4 }),
        ]);

        const result = validatePreFlight(graph, ['tool-a'], 1000);

        expect(result.estimatedMinCostCents).toBe(200);
      });
    });

    describe('valid result', () => {
      it('returns valid=true with no errors when all checks pass', async () => {
        const { validateTaskGraphDAG } = await import('../../services/task-graph-parser.js');
        vi.mocked(validateTaskGraphDAG).mockReturnValue({ valid: true });

        const graph = makeTaskGraph([
          makeTaskGraphNode({
            taskId: 'task-1',
            requiredTools: ['tool-a'],
            minPopulation: 3,
            recommendedPopulation: 4,
          }),
        ]);

        const result = validatePreFlight(graph, ['tool-a'], 1000);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });
});
