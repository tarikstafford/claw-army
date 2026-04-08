import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { runPerformanceJudge, type PerformanceJudgeOutput } from '../../council/performance-judge';
import type { CouncilContext } from '../../queue/council-queue';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn<typeof actual.generateText>(),
    Output: {
      object: vi.fn(),
    },
  };
});

const mockGenerateText = vi.mocked(generateText);

function createMockCouncilContext(overrides: Partial<CouncilContext> = {}): CouncilContext {
  return {
    executionId: 'exec-123',
    botId: 'bot-456',
    soulId: 'soul-789',
    soulContent: 'Test soul content for the agent',
    constitutionDirectives: ['prioritize accuracy', 'avoid speculation'],
    taskCategory: 'data-processing',
    botMetrics: {
      tasksClaimed: 10,
      tasksCompleted: 8,
      tasksFailed: 1,
      compositeScore: '0.85',
      tier: 'Understudy',
    },
    decisionTraces: [
      {
        decisionId: 'dec-001',
        decisionType: 'route-intelligence',
        directiveReferenced: 'prioritize accuracy',
        attributionConfidence: '0.9',
        outcome: 'success',
        metadata: {},
      },
      {
        decisionId: 'dec-002',
        decisionType: 'reallocate-resources',
        directiveReferenced: 'avoid speculation',
        attributionConfidence: '0.7',
        outcome: 'partial',
        metadata: {},
      },
    ],
    telemetryMetrics: [
      { metricName: 'latency_ms', metricValue: '150' },
      { metricName: 'tokens_used', metricValue: '5000' },
    ],
    ringLeaderSynthesis: null,
    ...overrides,
  };
}

describe('runPerformanceJudge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a valid PerformanceJudgeOutput for a high-performing bot', async () => {
    const mockOutput: PerformanceJudgeOutput = {
      verdictType: 'Promote',
      confidence: 0.92,
      summary: 'Exceptional performance across all metrics',
      reasoning: 'Agent completed 90% of tasks with high accuracy',
      keyMetrics: {
        successRate: 90,
        compositeScore: 0.85,
        tier: 'Understudy',
      },
    };

    mockGenerateText.mockResolvedValueOnce({
      output: mockOutput,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: {} as Parameters<typeof generateText>[0],
      response: {} as Parameters<typeof generateText>[0]['response'],
      text: '',
      toolCalls: [],
      toolResults: [],
      reasoning: undefined,
    });

    const ctx = createMockCouncilContext({
      botMetrics: { tasksClaimed: 10, tasksCompleted: 9, tasksFailed: 1, compositeScore: '0.85', tier: 'Understudy' },
    });

    const result = await runPerformanceJudge(ctx);

    expect(result.verdictType).toBe('Promote');
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.keyMetrics.successRate).toBe(90);
  });

  it('returns a Monitor verdict for concerning performance patterns', async () => {
    const mockOutput: PerformanceJudgeOutput = {
      verdictType: 'Monitor',
      confidence: 0.75,
      summary: 'Concerning patterns detected',
      reasoning: 'High failure rate on complex tasks',
      keyMetrics: {
        successRate: 55,
        compositeScore: 0.55,
        tier: 'Understudy',
      },
    };

    mockGenerateText.mockResolvedValueOnce({
      output: mockOutput,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: {} as Parameters<typeof generateText>[0],
      response: {} as Parameters<typeof generateText>[0]['response'],
      text: '',
      toolCalls: [],
      toolResults: [],
      reasoning: undefined,
    });

    const ctx = createMockCouncilContext({
      botMetrics: { tasksClaimed: 10, tasksCompleted: 5, tasksFailed: 3, compositeScore: '0.55', tier: 'Understudy' },
    });

    const result = await runPerformanceJudge(ctx);

    expect(result.verdictType).toBe('Monitor');
    expect(result.confidence).toBeLessThanOrEqual(0.8);
  });

  it('returns a Demote verdict for poor performance', async () => {
    const mockOutput: PerformanceJudgeOutput = {
      verdictType: 'Demote',
      confidence: 0.88,
      summary: 'Significant performance decline',
      reasoning: 'Only 30% task completion rate',
      keyMetrics: {
        successRate: 30,
        compositeScore: 0.30,
        tier: 'Understudy',
      },
    };

    mockGenerateText.mockResolvedValueOnce({
      output: mockOutput,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: {} as Parameters<typeof generateText>[0],
      response: {} as Parameters<typeof generateText>[0]['response'],
      text: '',
      toolCalls: [],
      toolResults: [],
      reasoning: undefined,
    });

    const ctx = createMockCouncilContext({
      botMetrics: { tasksClaimed: 10, tasksCompleted: 3, tasksFailed: 5, compositeScore: '0.30', tier: 'Understudy' },
    });

    const result = await runPerformanceJudge(ctx);

    expect(result.verdictType).toBe('Demote');
    expect(result.keyMetrics.successRate).toBe(30);
  });

  it('returns a Retire verdict for fundamentally ineffective agents', async () => {
    const mockOutput: PerformanceJudgeOutput = {
      verdictType: 'Retire',
      confidence: 0.95,
      summary: 'Agent consistently fails to meet minimum thresholds',
      reasoning: 'Sub-20% success rate across multiple work cycles',
      keyMetrics: {
        successRate: 15,
        compositeScore: 0.15,
        tier: 'Novice',
      },
    };

    mockGenerateText.mockResolvedValueOnce({
      output: mockOutput,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: {} as Parameters<typeof generateText>[0],
      response: {} as Parameters<typeof generateText>[0]['response'],
      text: '',
      toolCalls: [],
      toolResults: [],
      reasoning: undefined,
    });

    const ctx = createMockCouncilContext({
      botMetrics: { tasksClaimed: 10, tasksCompleted: 1, tasksFailed: 8, compositeScore: '0.15', tier: 'Novice' },
    });

    const result = await runPerformanceJudge(ctx);

    expect(result.verdictType).toBe('Retire');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('handles missing compositeScore gracefully', async () => {
    const mockOutput: PerformanceJudgeOutput = {
      verdictType: 'Maintain',
      confidence: 0.70,
      summary: 'Performance within acceptable range',
      reasoning: 'Adequate task completion despite missing composite score',
      keyMetrics: {
        successRate: 70,
        compositeScore: 0,
        tier: 'Novice',
      },
    };

    mockGenerateText.mockResolvedValueOnce({
      output: mockOutput,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: {} as Parameters<typeof generateText>[0],
      response: {} as Parameters<typeof generateText>[0]['response'],
      text: '',
      toolCalls: [],
      toolResults: [],
      reasoning: undefined,
    });

    const ctx = createMockCouncilContext({
      botMetrics: { tasksClaimed: 10, tasksCompleted: 7, tasksFailed: 2, compositeScore: null, tier: 'Novice' },
    });

    const result = await runPerformanceJudge(ctx);

    expect(result).toBeDefined();
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('handles empty decisionTraces', async () => {
    const mockOutput: PerformanceJudgeOutput = {
      verdictType: 'Maintain',
      confidence: 0.65,
      summary: 'Limited evidence available',
      reasoning: 'No decision traces to evaluate',
      keyMetrics: {
        successRate: 0,
        compositeScore: 0,
        tier: 'Novice',
      },
    };

    mockGenerateText.mockResolvedValueOnce({
      output: mockOutput,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: {} as Parameters<typeof generateText>[0],
      response: {} as Parameters<typeof generateText>[0]['response'],
      text: '',
      toolCalls: [],
      toolResults: [],
      reasoning: undefined,
    });

    const ctx = createMockCouncilContext({
      decisionTraces: [],
    });

    const result = await runPerformanceJudge(ctx);

    expect(result).toBeDefined();
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('handles missing ringLeaderSynthesis', async () => {
    const mockOutput: PerformanceJudgeOutput = {
      verdictType: 'Maintain',
      confidence: 0.72,
      summary: 'Performance acceptable without synthesis data',
      reasoning: 'Standard metrics evaluation',
      keyMetrics: {
        successRate: 80,
        compositeScore: 0.80,
        tier: 'Understudy',
      },
    };

    mockGenerateText.mockResolvedValueOnce({
      output: mockOutput,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: {} as Parameters<typeof generateText>[0],
      response: {} as Parameters<typeof generateText>[0]['response'],
      text: '',
      toolCalls: [],
      toolResults: [],
      reasoning: undefined,
    });

    const ctx = createMockCouncilContext({
      ringLeaderSynthesis: undefined,
    });

    const result = await runPerformanceJudge(ctx);

    expect(result).toBeDefined();
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('throws error when output is null', async () => {
    mockGenerateText.mockResolvedValueOnce({
      output: null,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: {} as Parameters<typeof generateText>[0],
      response: {} as Parameters<typeof generateText>[0]['response'],
      text: '',
      toolCalls: [],
      toolResults: [],
      reasoning: undefined,
    });

    const ctx = createMockCouncilContext();

    await expect(runPerformanceJudge(ctx)).rejects.toThrow(
      'Performance Judge returned null output — schema validation failed',
    );
  });

  it('throws error when output is undefined', async () => {
    mockGenerateText.mockResolvedValueOnce({
      output: undefined,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: {} as Parameters<typeof generateText>[0],
      response: {} as Parameters<typeof generateText>[0]['response'],
      text: '',
      toolCalls: [],
      toolResults: [],
      reasoning: undefined,
    });

    const ctx = createMockCouncilContext();

    await expect(runPerformanceJudge(ctx)).rejects.toThrow(
      'Performance Judge returned null output — schema validation failed',
    );
  });

  it('uses Anthropic claude-sonnet-4-6 model', async () => {
    const mockOutput: PerformanceJudgeOutput = {
      verdictType: 'Maintain',
      confidence: 0.75,
      summary: 'Standard performance',
      reasoning: 'Metrics within normal range',
      keyMetrics: { successRate: 75, compositeScore: 0.75, tier: 'Understudy' },
    };

    mockGenerateText.mockResolvedValueOnce({
      output: mockOutput,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: {} as Parameters<typeof generateText>[0],
      response: {} as Parameters<typeof generateText>[0]['response'],
      text: '',
      toolCalls: [],
      toolResults: [],
      reasoning: undefined,
    });

    const ctx = createMockCouncilContext();
    await runPerformanceJudge(ctx);

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: anthropic('claude-sonnet-4-6'),
        temperature: 0.2,
      }),
    );
  });

  it('correctly calculates success rate from tasks claimed', async () => {
    const mockOutput: PerformanceJudgeOutput = {
      verdictType: 'Promote',
      confidence: 0.90,
      summary: 'Excellent performance',
      reasoning: '100% task completion',
      keyMetrics: { successRate: 100, compositeScore: 1.0, tier: 'Understudy' },
    };

    mockGenerateText.mockResolvedValueOnce({
      output: mockOutput,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: {} as Parameters<typeof generateText>[0],
      response: {} as Parameters<typeof generateText>[0]['response'],
      text: '',
      toolCalls: [],
      toolResults: [],
      reasoning: undefined,
    });

    const ctx = createMockCouncilContext({
      botMetrics: { tasksClaimed: 5, tasksCompleted: 5, tasksFailed: 0, compositeScore: '1.0', tier: 'Understudy' },
    });

    await runPerformanceJudge(ctx);

    const callArgs = mockGenerateText.mock.calls[0]?.[0];
    expect(callArgs.prompt).toContain('Tasks Claimed: 5');
    expect(callArgs.prompt).toContain('Tasks Completed: 5');
    expect(callArgs.prompt).toContain('Success Rate: 100.0%');
  });

  it('handles zero tasks claimed (N/A success rate)', async () => {
    const mockOutput: PerformanceJudgeOutput = {
      verdictType: 'Monitor',
      confidence: 0.60,
      summary: 'No tasks claimed to evaluate',
      reasoning: 'Cannot assess performance with zero tasks',
      keyMetrics: { successRate: 0, compositeScore: 0, tier: 'Novice' },
    };

    mockGenerateText.mockResolvedValueOnce({
      output: mockOutput,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: {} as Parameters<typeof generateText>[0],
      response: {} as Parameters<typeof generateText>[0]['response'],
      text: '',
      toolCalls: [],
      toolResults: [],
      reasoning: undefined,
    });

    const ctx = createMockCouncilContext({
      botMetrics: { tasksClaimed: 0, tasksCompleted: 0, tasksFailed: 0, compositeScore: null, tier: null },
    });

    await runPerformanceJudge(ctx);

    const callArgs = mockGenerateText.mock.calls[0]?.[0];
    expect(callArgs.prompt).toContain('Tasks Claimed: 0');
    expect(callArgs.prompt).toContain('Success Rate: N/A%');
  });

  it('handles tie-breaking scenarios with mid-range confidence', async () => {
    const mockOutput: PerformanceJudgeOutput = {
      verdictType: 'Maintain',
      confidence: 0.50,
      summary: 'Borderline performance — recommend maintaining current status',
      reasoning: 'Mixed results require more data before decision',
      keyMetrics: { successRate: 50, compositeScore: 0.50, tier: 'Understudy' },
    };

    mockGenerateText.mockResolvedValueOnce({
      output: mockOutput,
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: {} as Parameters<typeof generateText>[0],
      response: {} as Parameters<typeof generateText>[0]['response'],
      text: '',
      toolCalls: [],
      toolResults: [],
      reasoning: undefined,
    });

    const ctx = createMockCouncilContext({
      botMetrics: { tasksClaimed: 10, tasksCompleted: 5, tasksFailed: 5, compositeScore: '0.50', tier: 'Understudy' },
    });

    const result = await runPerformanceJudge(ctx);

    expect(result.verdictType).toBe('Maintain');
    expect(result.confidence).toBe(0.50);
  });
});
