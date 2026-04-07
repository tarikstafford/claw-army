import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateTaskGraphDAG,
  parseObjectiveToTaskGraph,
} from '../../services/task-graph-parser';
import type { TaskGraph, TaskGraphNode } from '@claw/shared-types';

function makeNode(overrides: Partial<TaskGraphNode> = {}): TaskGraphNode {
  return {
    taskId: 'task-1',
    description: 'Test task',
    complexity: 'medium',
    requiredTools: [],
    dependencies: [],
    parallelizable: true,
    minPopulation: 3,
    recommendedPopulation: 4,
    ...overrides,
  };
}

function makeGraph(nodes: TaskGraphNode[]): TaskGraph {
  const dag: Record<string, string[]> = {};
  for (const node of nodes) {
    dag[node.taskId] = [];
  }
  for (const node of nodes) {
    for (const dep of node.dependencies) {
      if (!dag[dep]) dag[dep] = [];
      dag[dep]!.push(node.taskId);
    }
  }
  return { tasks: nodes, dag };
}

const mockedGenerateText = vi.hoisted(() => vi.fn());
const mockedResolveModel = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({
  generateText: mockedGenerateText,
}));

vi.mock('../../lib/resolve-model.js', () => ({
  resolveModel: mockedResolveModel,
}));

describe('validateTaskGraphDAG', () => {
  it('returns valid for a linear DAG (A -> B -> C)', () => {
    const graph = makeGraph([
      makeNode({ taskId: 'A', dependencies: [] }),
      makeNode({ taskId: 'B', dependencies: ['A'] }),
      makeNode({ taskId: 'C', dependencies: ['B'] }),
    ]);
    const result = validateTaskGraphDAG(graph);
    expect(result.valid).toBe(true);
  });

  it('returns valid for a parallel DAG (A, B -> C)', () => {
    const graph = makeGraph([
      makeNode({ taskId: 'A', dependencies: [] }),
      makeNode({ taskId: 'B', dependencies: [] }),
      makeNode({ taskId: 'C', dependencies: ['A', 'B'] }),
    ]);
    const result = validateTaskGraphDAG(graph);
    expect(result.valid).toBe(true);
  });

  it('returns valid for a diamond DAG (A -> B, C -> D)', () => {
    const graph = makeGraph([
      makeNode({ taskId: 'A', dependencies: [] }),
      makeNode({ taskId: 'B', dependencies: ['A'] }),
      makeNode({ taskId: 'C', dependencies: ['A'] }),
      makeNode({ taskId: 'D', dependencies: ['B', 'C'] }),
    ]);
    const result = validateTaskGraphDAG(graph);
    expect(result.valid).toBe(true);
  });

  it('returns valid for an empty graph', () => {
    const graph = makeGraph([]);
    const result = validateTaskGraphDAG(graph);
    expect(result.valid).toBe(true);
  });

  it('returns invalid for a simple cycle (A -> B -> A)', () => {
    const graph = makeGraph([
      makeNode({ taskId: 'A', dependencies: ['B'] }),
      makeNode({ taskId: 'B', dependencies: ['A'] }),
    ]);
    const result = validateTaskGraphDAG(graph);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cycle detected');
  });

  it('returns invalid for a self-referential cycle (A -> A)', () => {
    const graph = makeGraph([
      makeNode({ taskId: 'A', dependencies: ['A'] }),
    ]);
    const result = validateTaskGraphDAG(graph);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cycle detected');
  });

  it('returns invalid for a longer cycle (A -> B -> C -> A)', () => {
    const graph = makeGraph([
      makeNode({ taskId: 'A', dependencies: ['C'] }),
      makeNode({ taskId: 'B', dependencies: ['A'] }),
      makeNode({ taskId: 'C', dependencies: ['B'] }),
    ]);
    const result = validateTaskGraphDAG(graph);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cycle detected');
  });

  it('returns invalid for a dangling dependency reference', () => {
    const graph = makeGraph([
      makeNode({ taskId: 'A', dependencies: [] }),
      makeNode({ taskId: 'B', dependencies: ['NONEXISTENT'] }),
    ]);
    const result = validateTaskGraphDAG(graph);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('dangling dependency reference');
    expect(result.error).toContain('NONEXISTENT');
  });

  it('returns invalid when a task depends on a non-existent task', () => {
    const graph = makeGraph([
      makeNode({ taskId: 'root', dependencies: [] }),
      makeNode({ taskId: 'child', dependencies: ['missing-task'] }),
    ]);
    const result = validateTaskGraphDAG(graph);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('missing-task');
  });

  it('returns valid for disconnected nodes (no cycles)', () => {
    const graph = makeGraph([
      makeNode({ taskId: 'A', dependencies: [] }),
      makeNode({ taskId: 'B', dependencies: [] }),
      makeNode({ taskId: 'C', dependencies: [] }),
    ]);
    const result = validateTaskGraphDAG(graph);
    expect(result.valid).toBe(true);
  });

  it('includes cycle nodes in error message when cycle detected', () => {
    const graph = makeGraph([
      makeNode({ taskId: 'X', dependencies: ['Y'] }),
      makeNode({ taskId: 'Y', dependencies: ['X'] }),
    ]);
    const result = validateTaskGraphDAG(graph);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('X');
    expect(result.error).toContain('Y');
  });
});

describe('parseObjectiveToTaskGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to flat graph when LLM returns invalid JSON', async () => {
    mockedGenerateText.mockResolvedValue({ text: 'not valid json {{{{' });

    const result = await parseObjectiveToTaskGraph('Build a website', [], 3);

    expect(result.tasks).toHaveLength(3);
    expect(result.tasks.every((t) => t.dependencies.length === 0)).toBe(true);
  });

  it('falls back to flat graph when LLM returns non-object JSON', async () => {
    mockedGenerateText.mockResolvedValue({ text: '["array", "not", "object"]' });

    const result = await parseObjectiveToTaskGraph('Build a website', [], 3);

    expect(result.tasks).toHaveLength(3);
  });

  it('falls back to flat graph when LLM returns object without tasks array', async () => {
    mockedGenerateText.mockResolvedValue({ text: '{"foo": "bar"}' });

    const result = await parseObjectiveToTaskGraph('Build a website', [], 3);

    expect(result.tasks).toHaveLength(3);
  });

  it('parses valid LLM output into a TaskGraph', async () => {
    const validJson = JSON.stringify({
      tasks: [
        { taskId: 'task-1', description: 'Design', complexity: 'low', requiredTools: [], dependencies: [] },
        { taskId: 'task-2', description: 'Build', complexity: 'medium', requiredTools: [], dependencies: ['task-1'] },
      ],
    });
    mockedGenerateText.mockResolvedValue({ text: validJson });

    const result = await parseObjectiveToTaskGraph('Build a website', [], 5);

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0]!.taskId).toBe('task-1');
    expect(result.tasks[1]!.dependencies).toContain('task-1');
  });

  it('respects maxTasks limit when parsing', async () => {
    const validJson = JSON.stringify({
      tasks: [
        { taskId: 't1', description: 'D1', complexity: 'low', requiredTools: [], dependencies: [] },
        { taskId: 't2', description: 'D2', complexity: 'low', requiredTools: [], dependencies: [] },
        { taskId: 't3', description: 'D3', complexity: 'low', requiredTools: [], dependencies: [] },
        { taskId: 't4', description: 'D4', complexity: 'low', requiredTools: [], dependencies: [] },
        { taskId: 't5', description: 'D5', complexity: 'low', requiredTools: [], dependencies: [] },
      ],
    });
    mockedGenerateText.mockResolvedValue({ text: validJson });

    const result = await parseObjectiveToTaskGraph('Build a website', [], 3);

    expect(result.tasks).toHaveLength(3);
  });

  it('filters requiredTools to only allowed tools', async () => {
    const validJson = JSON.stringify({
      tasks: [
        { taskId: 't1', description: 'D1', complexity: 'low', requiredTools: ['fetch_url', 'llm_call'], dependencies: [] },
      ],
    });
    mockedGenerateText.mockResolvedValue({ text: validJson });

    const result = await parseObjectiveToTaskGraph('Build a website', ['fetch_url'], 5);

    expect(result.tasks[0]!.requiredTools).toEqual(['fetch_url']);
  });

  it('sets parallelizable true for tasks with no dependencies', async () => {
    const validJson = JSON.stringify({
      tasks: [
        { taskId: 't1', description: 'D1', complexity: 'low', requiredTools: [], dependencies: [] },
        { taskId: 't2', description: 'D2', complexity: 'medium', requiredTools: [], dependencies: ['t1'] },
      ],
    });
    mockedGenerateText.mockResolvedValue({ text: validJson });

    const result = await parseObjectiveToTaskGraph('Build a website', [], 5);

    expect(result.tasks[0]!.parallelizable).toBe(true);
    expect(result.tasks[1]!.parallelizable).toBe(false);
  });

  it('falls back to flat graph when LLM produces a DAG with a cycle', async () => {
    const cyclicJson = JSON.stringify({
      tasks: [
        { taskId: 't1', description: 'D1', complexity: 'low', requiredTools: [], dependencies: ['t2'] },
        { taskId: 't2', description: 'D2', complexity: 'medium', requiredTools: [], dependencies: ['t1'] },
      ],
    });
    mockedGenerateText.mockResolvedValue({ text: cyclicJson });

    const result = await parseObjectiveToTaskGraph('Build a website', [], 5);

    expect(result.tasks).toHaveLength(5);
    expect(result.tasks.every((t) => t.dependencies.length === 0)).toBe(true);
  });

  it('defaults complexity to medium when not specified', async () => {
    const validJson = JSON.stringify({
      tasks: [
        { taskId: 't1', description: 'D1', requiredTools: [], dependencies: [] },
      ],
    });
    mockedGenerateText.mockResolvedValue({ text: validJson });

    const result = await parseObjectiveToTaskGraph('Build a website', [], 5);

    expect(result.tasks[0]!.complexity).toBe('medium');
  });

  it('sets correct recommendedPopulation based on complexity', async () => {
    const validJson = JSON.stringify({
      tasks: [
        { taskId: 't1', description: 'D1', complexity: 'low', requiredTools: [], dependencies: [] },
        { taskId: 't2', description: 'D2', complexity: 'medium', requiredTools: [], dependencies: [] },
        { taskId: 't3', description: 'D3', complexity: 'high', requiredTools: [], dependencies: [] },
      ],
    });
    mockedGenerateText.mockResolvedValue({ text: validJson });

    const result = await parseObjectiveToTaskGraph('Build a website', [], 5);

    expect(result.tasks.find((t) => t.taskId === 't1')!.recommendedPopulation).toBe(3);
    expect(result.tasks.find((t) => t.taskId === 't2')!.recommendedPopulation).toBe(4);
    expect(result.tasks.find((t) => t.taskId === 't3')!.recommendedPopulation).toBe(5);
  });
});
