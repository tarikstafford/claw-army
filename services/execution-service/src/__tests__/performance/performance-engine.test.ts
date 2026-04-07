import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockComputeScoresForExecution = vi.fn();
const mockIdentifyAndCaptureDna = vi.fn();
const mockRunAttributionCompiler = vi.fn();

vi.mock('../../performance/score-engine', () => ({
  computeScoresForExecution: (...args: unknown[]) => mockComputeScoresForExecution(...args),
}));

vi.mock('../../performance/dna-capture', () => ({
  identifyAndCaptureDna: (...args: unknown[]) => mockIdentifyAndCaptureDna(...args),
}));

vi.mock('../../performance/attribution-compiler', () => ({
  runAttributionCompiler: (...args: unknown[]) => mockRunAttributionCompiler(...args),
}));

describe('runPerformancePipeline orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls all three phases in sequence', async () => {
    const { runPerformancePipeline } = await import('../../performance/performance-engine');
    const executionId = 'test-execution-123';

    await runPerformancePipeline(executionId);

    expect(mockComputeScoresForExecution).toHaveBeenCalledWith(executionId);
    expect(mockIdentifyAndCaptureDna).toHaveBeenCalledWith(executionId);
    expect(mockRunAttributionCompiler).toHaveBeenCalledWith(executionId);
  });

  it('calls phases in correct order', async () => {
    const { runPerformancePipeline } = await import('../../performance/performance-engine');
    const executionId = 'test-execution-456';
    const callOrder: string[] = [];

    mockComputeScoresForExecution.mockImplementation(async () => {
      callOrder.push('computeScores');
    });
    mockIdentifyAndCaptureDna.mockImplementation(async () => {
      callOrder.push('identifyAndCaptureDna');
    });
    mockRunAttributionCompiler.mockImplementation(async () => {
      callOrder.push('runAttributionCompiler');
    });

    await runPerformancePipeline(executionId);

    expect(callOrder).toEqual([
      'computeScores',
      'identifyAndCaptureDna',
      'runAttributionCompiler',
    ]);
  });

  it('waits for each phase to complete before next', async () => {
    const { runPerformancePipeline } = await import('../../performance/performance-engine');
    const executionId = 'test-execution-789';
    const resolveOrder: string[] = [];

    mockComputeScoresForExecution.mockImplementation(
      async () => new Promise((resolve) => setTimeout(() => { resolveOrder.push('score'); resolve(); }, 10)),
    );
    mockIdentifyAndCaptureDna.mockImplementation(
      async () => new Promise((resolve) => setTimeout(() => { resolveOrder.push('dna'); resolve(); }, 10)),
    );
    mockRunAttributionCompiler.mockImplementation(
      async () => new Promise((resolve) => setTimeout(() => { resolveOrder.push('attribution'); resolve(); }, 10)),
    );

    await runPerformancePipeline(executionId);

    expect(resolveOrder).toEqual(['score', 'dna', 'attribution']);
  });

  it('passes executionId to each phase', async () => {
    const { runPerformancePipeline } = await import('../../performance/performance-engine');
    const executionId = 'exec-abc-123';

    await runPerformancePipeline(executionId);

    expect(mockComputeScoresForExecution).toHaveBeenCalledWith('exec-abc-123');
    expect(mockIdentifyAndCaptureDna).toHaveBeenCalledWith('exec-abc-123');
    expect(mockRunAttributionCompiler).toHaveBeenCalledWith('exec-abc-123');
  });
});

describe('pipeline phases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computeScoresForExecution is called once per execution', async () => {
    const { runPerformancePipeline } = await import('../../performance/performance-engine');

    await runPerformancePipeline('exec-1');
    await runPerformancePipeline('exec-2');

    expect(mockComputeScoresForExecution).toHaveBeenCalledTimes(2);
  });

  it('identifyAndCaptureDna is called once per execution', async () => {
    const { runPerformancePipeline } = await import('../../performance/performance-engine');

    await runPerformancePipeline('exec-1');
    await runPerformancePipeline('exec-2');

    expect(mockIdentifyAndCaptureDna).toHaveBeenCalledTimes(2);
  });

  it('runAttributionCompiler is called once per execution', async () => {
    const { runPerformancePipeline } = await import('../../performance/performance-engine');

    await runPerformancePipeline('exec-1');
    await runPerformancePipeline('exec-2');

    expect(mockRunAttributionCompiler).toHaveBeenCalledTimes(2);
  });
});

describe('pipeline dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DNA capture depends on score computation completing first', async () => {
    const { runPerformancePipeline } = await import('../../performance/performance-engine');
    let scoreCompleted = false;

    mockComputeScoresForExecution.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      scoreCompleted = true;
    });
    mockIdentifyAndCaptureDna.mockImplementation(async () => {
      expect(scoreCompleted).toBe(true);
    });

    await runPerformancePipeline('exec-1');
  });

  it('attribution compiler runs after DNA capture', async () => {
    const { runPerformancePipeline } = await import('../../performance/performance-engine');
    let dnaCompleted = false;

    mockIdentifyAndCaptureDna.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      dnaCompleted = true;
    });
    mockRunAttributionCompiler.mockImplementation(async () => {
      expect(dnaCompleted).toBe(true);
    });

    await runPerformancePipeline('exec-1');
  });
});

describe('pipeline error propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('propagates error when computeScoresForExecution fails', async () => {
    const { runPerformancePipeline } = await import('../../performance/performance-engine');

    mockComputeScoresForExecution.mockRejectedValue(new Error('Score computation failed'));
    mockIdentifyAndCaptureDna.mockResolvedValue(undefined);
    mockRunAttributionCompiler.mockResolvedValue(undefined);

    await expect(runPerformancePipeline('exec-fail')).rejects.toThrow('Score computation failed');
  });

  it('does not call subsequent phases when computeScoresForExecution fails', async () => {
    const { runPerformancePipeline } = await import('../../performance/performance-engine');

    mockComputeScoresForExecution.mockRejectedValue(new Error('Score failed'));
    mockIdentifyAndCaptureDna.mockResolvedValue(undefined);
    mockRunAttributionCompiler.mockResolvedValue(undefined);

    await runPerformancePipeline('exec-fail').catch(() => {});

    expect(mockIdentifyAndCaptureDna).not.toHaveBeenCalled();
    expect(mockRunAttributionCompiler).not.toHaveBeenCalled();
  });
});
