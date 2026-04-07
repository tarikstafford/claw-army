import { describe, it, expect, vi, beforeEach } from 'vitest';
import { planObjective, planObjectiveAsTaskGraph } from '../../services/planner.service';

const mockedGenerateText = vi.hoisted(() => vi.fn());
const mockedResolveModel = vi.hoisted(() => vi.fn());
const mockedParseObjectiveToTaskGraph = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({
  generateText: mockedGenerateText,
}));

vi.mock('../../lib/resolve-model.js', () => ({
  resolveModel: mockedResolveModel,
}));

vi.mock('../../services/task-graph-parser.js', () => ({
  parseObjectiveToTaskGraph: mockedParseObjectiveToTaskGraph,
}));

describe('planObjective', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses valid JSON array into PlannedTask array', async () => {
    mockedGenerateText.mockResolvedValue({
      text: JSON.stringify([
        { description: 'Design the system' },
        { description: 'Implement feature X' },
        { description: 'Write tests' },
      ]),
    });

    const result = await planObjective('Build a web app', 3);

    expect(result).toHaveLength(3);
    expect(result[0]!.description).toBe('Design the system');
    expect(result[1]!.description).toBe('Implement feature X');
    expect(result[2]!.description).toBe('Write tests');
  });

  it('limits results to maxTasks', async () => {
    mockedGenerateText.mockResolvedValue({
      text: JSON.stringify([
        { description: 'Task 1' },
        { description: 'Task 2' },
        { description: 'Task 3' },
        { description: 'Task 4' },
        { description: 'Task 5' },
      ]),
    });

    const result = await planObjective('Build a web app', 2);

    expect(result).toHaveLength(2);
  });

  it('falls back to stub decomposition when LLM output is not valid JSON', async () => {
    mockedGenerateText.mockResolvedValue({
      text: 'This is not JSON output',
    });

    const result = await planObjective('Build a web app', 3);

    expect(result).toHaveLength(3);
    expect(result[0]!.description).toContain('Build a web app');
    expect(result[0]!.description).toContain('subtask 1');
  });

  it('falls back to stub decomposition when LLM output is not an array', async () => {
    mockedGenerateText.mockResolvedValue({
      text: JSON.stringify({ tasks: [] }),
    });

    const result = await planObjective('Build a web app', 3);

    expect(result).toHaveLength(3);
    expect(result[0]!.description).toContain('Build a web app');
  });

  it('respects maxTasks default of 3', async () => {
    mockedGenerateText.mockResolvedValue({
      text: JSON.stringify([
        { description: 'T1' },
        { description: 'T2' },
        { description: 'T3' },
        { description: 'T4' },
        { description: 'T5' },
      ]),
    });

    const result = await planObjective('Build a web app');

    expect(result).toHaveLength(3);
  });
});

describe('planObjectiveAsTaskGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to parseObjectiveToTaskGraph with correct params', async () => {
    const mockGraph = {
      tasks: [
        {
          taskId: 'task-1',
          description: 'Design',
          complexity: 'low' as const,
          requiredTools: [],
          dependencies: [],
          parallelizable: true,
          minPopulation: 3,
          recommendedPopulation: 3,
        },
      ],
      dag: {},
    };
    mockedParseObjectiveToTaskGraph.mockResolvedValue(mockGraph);

    const result = await planObjectiveAsTaskGraph('Build a website', ['fetch_url'], 5);

    expect(mockedParseObjectiveToTaskGraph).toHaveBeenCalledWith('Build a website', ['fetch_url'], 5);
    expect(result).toBe(mockGraph);
  });

  it('passes default maxTasks=5 when not specified', async () => {
    mockedParseObjectiveToTaskGraph.mockResolvedValue({ tasks: [], dag: {} });

    await planObjectiveAsTaskGraph('Build a website', []);

    expect(mockedParseObjectiveToTaskGraph).toHaveBeenCalledWith('Build a website', [], 5);
  });
});
