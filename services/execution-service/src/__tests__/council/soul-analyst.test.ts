import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText } from 'ai';
import { runSoulAnalyst, COUNTERFACTUAL_OVERRIDE_THRESHOLD, type SoulAnalystOutput } from '../council/soul-analyst';
import type { CouncilContext } from '../queue/council-queue';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn<typeof actual.generateText>(),
  };
});

const mockGenerateText = vi.mocked(generateText);

function createMockCouncilContext(overrides: Partial<CouncilContext> = {}): CouncilContext {
  return {
    executionId: 'exec-123',
    botId: 'bot-456',
    soulId: 'soul-789',
    soulContent: 'Test soul content emphasizing accuracy and thoroughness',
    constitutionDirectives: ['prioritize accuracy', 'avoid speculation', 'document reasoning'],
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
      {
        decisionId: 'dec-003',
        decisionType: 'document-reasoning',
        directiveReferenced: 'document reasoning',
        attributionConfidence: '0.85',
        outcome: 'success',
        metadata: {},
      },
    ],
    telemetryMetrics: [
      { metricName: 'latency_ms', metricValue: '150' },
    ],
    ringLeaderSynthesis: null,
    ...overrides,
  };
}

describe('runSoulAnalyst', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('COUNTERFACTUAL_OVERRIDE_THRESHOLD', () => {
    it('is exported and equals 0.25', () => {
      expect(COUNTERFACTUAL_OVERRIDE_THRESHOLD).toBe(0.25);
    });
  });

  it('returns a valid SoulAnalystOutput with Promote verdict for high soul alignment', async () => {
    const mockOutput: SoulAnalystOutput = {
      directiveAttributionVerification: [
        {
          decisionId: 'dec-001',
          directiveReferenced: 'prioritize accuracy',
          selfReportedConfidence: 0.9,
          counterfactualScore: 0.85,
          counterfactualOverrides: false,
          reasoning: 'Strong alignment between claimed directive and actual behavior',
        },
      ],
      overallSoulAlignment: 0.92,
      verdictType: 'Promote',
      confidence: 0.88,
      summary: 'Agent demonstrates strong soul alignment',
      disagreementRate: 0,
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
    const result = await runSoulAnalyst(ctx);

    expect(result.verdictType).toBe('Promote');
    expect(result.overallSoulAlignment).toBeGreaterThan(0.9);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('returns a Monitor verdict when soul alignment is moderate', async () => {
    const mockOutput: SoulAnalystOutput = {
      directiveAttributionVerification: [
        {
          decisionId: 'dec-001',
          directiveReferenced: 'prioritize accuracy',
          selfReportedConfidence: 0.9,
          counterfactualScore: 0.5,
          counterfactualOverrides: true,
          reasoning: 'Agent claims directive influenced decision but evidence suggests otherwise',
        },
        {
          decisionId: 'dec-002',
          directiveReferenced: 'avoid speculation',
          selfReportedConfidence: 0.6,
          counterfactualScore: 0.55,
          counterfactualOverrides: false,
          reasoning: 'Minor discrepancy within acceptable range',
        },
      ],
      overallSoulAlignment: 0.55,
      verdictType: 'Monitor',
      confidence: 0.72,
      summary: 'Mixed soul alignment with some directive mismatches',
      disagreementRate: 0.5,
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
    const result = await runSoulAnalyst(ctx);

    expect(result.verdictType).toBe('Monitor');
    expect(result.overallSoulAlignment).toBeLessThan(0.7);
  });

  it('returns a Demote verdict when soul alignment is low', async () => {
    const mockOutput: SoulAnalystOutput = {
      directiveAttributionVerification: [
        {
          decisionId: 'dec-001',
          directiveReferenced: 'prioritize accuracy',
          selfReportedConfidence: 0.9,
          counterfactualScore: 0.2,
          counterfactualOverrides: true,
          reasoning: 'Directive had no meaningful influence on this decision',
        },
      ],
      overallSoulAlignment: 0.30,
      verdictType: 'Demote',
      confidence: 0.82,
      summary: 'Poor soul alignment — agent frequently ignores its constitution',
      disagreementRate: 1.0,
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
    const result = await runSoulAnalyst(ctx);

    expect(result.verdictType).toBe('Demote');
    expect(result.overallSoulAlignment).toBeLessThan(0.4);
  });

  it('returns a Retire verdict when soul alignment is critically low', async () => {
    const mockOutput: SoulAnalystOutput = {
      directiveAttributionVerification: [],
      overallSoulAlignment: 0.10,
      verdictType: 'Retire',
      confidence: 0.95,
      summary: 'Agent fundamentally disregards its soul constitution',
      disagreementRate: 1.0,
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
    const result = await runSoulAnalyst(ctx);

    expect(result.verdictType).toBe('Retire');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('recomputes counterfactualOverrides using threshold (overrides LLM value)', async () => {
    const mockOutput: SoulAnalystOutput = {
      directiveAttributionVerification: [
        {
          decisionId: 'dec-001',
          directiveReferenced: 'prioritize accuracy',
          selfReportedConfidence: 0.9,
          counterfactualScore: 0.5,
          counterfactualOverrides: false,
          reasoning: 'LLM says no override',
        },
      ],
      overallSoulAlignment: 0.7,
      verdictType: 'Maintain',
      confidence: 0.75,
      summary: 'Soul alignment acceptable',
      disagreementRate: 0,
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
    const result = await runSoulAnalyst(ctx);

    expect(result.directiveAttributionVerification[0].counterfactualOverrides).toBe(true);
  });

  it('does not override when difference is within threshold', async () => {
    const mockOutput: SoulAnalystOutput = {
      directiveAttributionVerification: [
        {
          decisionId: 'dec-001',
          directiveReferenced: 'prioritize accuracy',
          selfReportedConfidence: 0.8,
          counterfactualScore: 0.7,
          counterfactualOverrides: true,
          reasoning: 'LLM says override',
        },
      ],
      overallSoulAlignment: 0.75,
      verdictType: 'Maintain',
      confidence: 0.75,
      summary: 'Soul alignment acceptable',
      disagreementRate: 1.0,
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
    const result = await runSoulAnalyst(ctx);

    expect(result.directiveAttributionVerification[0].counterfactualOverrides).toBe(false);
  });

  it('recomputes disagreementRate from corrected overrides', async () => {
    const mockOutput: SoulAnalystOutput = {
      directiveAttributionVerification: [
        {
          decisionId: 'dec-001',
          directiveReferenced: 'prioritize accuracy',
          selfReportedConfidence: 0.9,
          counterfactualScore: 0.5,
          counterfactualOverrides: false,
          reasoning: 'Override',
        },
        {
          decisionId: 'dec-002',
          directiveReferenced: 'avoid speculation',
          selfReportedConfidence: 0.8,
          counterfactualScore: 0.6,
          counterfactualOverrides: false,
          reasoning: 'Override',
        },
      ],
      overallSoulAlignment: 0.7,
      verdictType: 'Maintain',
      confidence: 0.75,
      summary: 'Soul alignment acceptable',
      disagreementRate: 0.5,
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
    const result = await runSoulAnalyst(ctx);

    expect(result.disagreementRate).toBe(1.0);
  });

  it('handles empty directiveAttributionVerification (no qualifying traces)', async () => {
    const mockOutput: SoulAnalystOutput = {
      directiveAttributionVerification: [],
      overallSoulAlignment: 0.65,
      verdictType: 'Monitor',
      confidence: 0.70,
      summary: 'No high-confidence attributions to verify',
      disagreementRate: 0,
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

    const result = await runSoulAnalyst(ctx);

    expect(result.directiveAttributionVerification).toHaveLength(0);
    expect(result.disagreementRate).toBe(0);
  });

  it('filters decision traces to attributionConfidence > 0.5 and non-null directive', async () => {
    const mockOutput: SoulAnalystOutput = {
      directiveAttributionVerification: [],
      overallSoulAlignment: 0.5,
      verdictType: 'Monitor',
      confidence: 0.65,
      summary: 'Limited verifiable attributions',
      disagreementRate: 0,
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
      decisionTraces: [
        {
          decisionId: 'dec-low',
          decisionType: 'route-intelligence',
          directiveReferenced: 'prioritize accuracy',
          attributionConfidence: '0.3',
          outcome: 'success',
          metadata: {},
        },
        {
          decisionId: 'dec-null',
          decisionType: 'route-intelligence',
          directiveReferenced: null,
          attributionConfidence: '0.8',
          outcome: 'success',
          metadata: {},
        },
        {
          decisionId: 'dec-qualifying',
          decisionType: 'route-intelligence',
          directiveReferenced: 'avoid speculation',
          attributionConfidence: '0.9',
          outcome: 'success',
          metadata: {},
        },
      ],
    });

    await runSoulAnalyst(ctx);

    const callArgs = mockGenerateText.mock.calls[0]?.[0];
    expect(callArgs.prompt).toContain('dec-qualifying');
    expect(callArgs.prompt).not.toContain('dec-low');
    expect(callArgs.prompt).not.toContain('dec-null');
  });

  it('caps decision traces at 20', async () => {
    const mockOutput: SoulAnalystOutput = {
      directiveAttributionVerification: [],
      overallSoulAlignment: 0.6,
      verdictType: 'Monitor',
      confidence: 0.70,
      summary: 'Evaluating many traces',
      disagreementRate: 0,
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

    const manyTraces = Array.from({ length: 30 }, (_, i) => ({
      decisionId: `dec-${i}`,
      decisionType: 'route-intelligence',
      directiveReferenced: 'prioritize accuracy',
      attributionConfidence: '0.9',
      outcome: 'success' as const,
      metadata: {},
    }));

    const ctx = createMockCouncilContext({
      decisionTraces: manyTraces,
    });

    await runSoulAnalyst(ctx);

    const callArgs = mockGenerateText.mock.calls[0]?.[0];
    const promptContent = callArgs.prompt as string;
    expect(promptContent).toContain('dec-0');
    expect(promptContent).not.toContain('dec-20');
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

    await expect(runSoulAnalyst(ctx)).rejects.toThrow(
      'Soul Analyst returned null output — schema validation failed',
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

    await expect(runSoulAnalyst(ctx)).rejects.toThrow(
      'Soul Analyst returned null output — schema validation failed',
    );
  });

  it('handles missing soulContent', async () => {
    const mockOutput: SoulAnalystOutput = {
      directiveAttributionVerification: [],
      overallSoulAlignment: 0.5,
      verdictType: 'Monitor',
      confidence: 0.68,
      summary: 'Limited soul content available',
      disagreementRate: 0,
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
      soulContent: null,
    });

    const result = await runSoulAnalyst(ctx);

    expect(result).toBeDefined();
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('handles empty constitutionDirectives', async () => {
    const mockOutput: SoulAnalystOutput = {
      directiveAttributionVerification: [],
      overallSoulAlignment: 0.4,
      verdictType: 'Monitor',
      confidence: 0.72,
      summary: 'No constitution directives defined',
      disagreementRate: 0,
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
      constitutionDirectives: [],
    });

    const result = await runSoulAnalyst(ctx);

    expect(result).toBeDefined();
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('handles tie-breaking with mid-range soul alignment', async () => {
    const mockOutput: SoulAnalystOutput = {
      directiveAttributionVerification: [
        {
          decisionId: 'dec-001',
          directiveReferenced: 'prioritize accuracy',
          selfReportedConfidence: 0.6,
          counterfactualScore: 0.55,
          counterfactualOverrides: false,
          reasoning: 'Borderline alignment',
        },
      ],
      overallSoulAlignment: 0.5,
      verdictType: 'Maintain',
      confidence: 0.50,
      summary: 'Mid-range soul alignment — maintain status',
      disagreementRate: 0,
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
    const result = await runSoulAnalyst(ctx);

    expect(result.verdictType).toBe('Maintain');
    expect(result.confidence).toBe(0.5);
  });
});
