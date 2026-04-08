import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { runDevilsAdvocate, type DevilsAdvocateOutput } from '../council/devils-advocate';
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
      {
        decisionId: 'dec-003',
        decisionType: 'route-intelligence',
        directiveReferenced: 'prioritize accuracy',
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

describe('runDevilsAdvocate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('model heterogeneity (CNCL-03)', () => {
    it('uses Google gemini-2.5-flash (different provider than Performance Judge)', async () => {
      const mockOutput: DevilsAdvocateOutput = {
        challenges: [],
        strongUnresolvedArgument: false,
        verdictType: 'Maintain',
        confidence: 0.75,
        summary: 'No significant challenges',
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
      await runDevilsAdvocate(ctx);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: google('gemini-2.5-flash'),
        }),
      );

      expect(google('gemini-2.5-flash')).not.toEqual(anthropic('claude-sonnet-4-6'));
    });

    it('Performance Judge uses Anthropic, Devil Advocate uses Google', () => {
      expect(anthropic('claude-sonnet-4-6')).not.toEqual(google('gemini-2.5-flash'));
    });
  });

  it('returns a valid DevilsAdvocateOutput with Maintain verdict', async () => {
    const mockOutput: DevilsAdvocateOutput = {
      challenges: [
        {
          claim: 'Tasks may have been easy rather than due to agent skill',
          counterArgument: 'Tasks required multi-step reasoning',
          severity: 'minor',
        },
      ],
      strongUnresolvedArgument: false,
      verdictType: 'Maintain',
      confidence: 0.78,
      summary: 'Minor concerns but no blocking issues',
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
    const result = await runDevilsAdvocate(ctx);

    expect(result.verdictType).toBe('Maintain');
    expect(result.challenges.length).toBeGreaterThan(0);
    expect(result.strongUnresolvedArgument).toBe(false);
  });

  it('returns Monitor verdict with moderate challenges', async () => {
    const mockOutput: DevilsAdvocateOutput = {
      challenges: [
        {
          claim: 'Success rate could be inflated by easy tasks',
          counterArgument: '20% of tasks were marked as difficult',
          severity: 'moderate',
        },
        {
          claim: 'Directive attributions may be post-hoc rationalization',
          counterArgument: 'Some attributions show high confidence correlation',
          severity: 'moderate',
        },
      ],
      strongUnresolvedArgument: false,
      verdictType: 'Monitor',
      confidence: 0.72,
      summary: 'Legitimate concerns warrant monitoring',
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
    const result = await runDevilsAdvocate(ctx);

    expect(result.verdictType).toBe('Monitor');
    expect(result.challenges.some((c) => c.severity === 'moderate')).toBe(true);
  });

  it('returns Demote verdict when strong unresolved argument exists', async () => {
    const mockOutput: DevilsAdvocateOutput = {
      challenges: [
        {
          claim: 'Systematic failures on critical path tasks',
          counterArgument: 'Agent claims resource constraints',
          severity: 'strong',
        },
      ],
      strongUnresolvedArgument: false,
      verdictType: 'Demote',
      confidence: 0.85,
      summary: 'Strong unresolved concern blocks advancement',
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
    const result = await runDevilsAdvocate(ctx);

    expect(result.strongUnresolvedArgument).toBe(true);
  });

  it('returns Retire verdict for fundamentally flawed agents', async () => {
    const mockOutput: DevilsAdvocateOutput = {
      challenges: [
        {
          claim: 'Agent consistently takes actions contrary to stated directives',
          counterArgument: 'N/A',
          severity: 'strong',
        },
        {
          claim: 'High failure rate suggests systemic issues',
          counterArgument: 'N/A',
          severity: 'strong',
        },
      ],
      strongUnresolvedArgument: true,
      verdictType: 'Retire',
      confidence: 0.92,
      summary: 'Multiple strong unresolved arguments',
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
    const result = await runDevilsAdvocate(ctx);

    expect(result.verdictType).toBe('Retire');
    expect(result.strongUnresolvedArgument).toBe(true);
  });

  it('returns Promote verdict when challenges are minor', async () => {
    const mockOutput: DevilsAdvocateOutput = {
      challenges: [
        {
          claim: 'Minor nitpick about documentation style',
          counterArgument: 'Core functionality unaffected',
          severity: 'minor',
        },
      ],
      strongUnresolvedArgument: false,
      verdictType: 'Promote',
      confidence: 0.88,
      summary: 'No blocking concerns',
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
    const result = await runDevilsAdvocate(ctx);

    expect(result.verdictType).toBe('Promote');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('overrides strongUnresolvedArgument deterministically from challenge severity (CNCL-05)', async () => {
    const mockOutput: DevilsAdvocateOutput = {
      challenges: [
        {
          claim: 'Some minor concern',
          counterArgument: 'Response to minor concern',
          severity: 'minor',
        },
        {
          claim: 'A serious issue that cannot be resolved',
          counterArgument: 'No adequate response',
          severity: 'strong',
        },
      ],
      strongUnresolvedArgument: false,
      verdictType: 'Monitor',
      confidence: 0.70,
      summary: 'LLM missed the strong challenge',
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
    const result = await runDevilsAdvocate(ctx);

    expect(result.strongUnresolvedArgument).toBe(true);
  });

  it('does not override strongUnresolvedArgument when no strong severity challenges exist', async () => {
    const mockOutput: DevilsAdvocateOutput = {
      challenges: [
        {
          claim: 'Minor documentation issue',
          counterArgument: '不影响核心功能',
          severity: 'minor',
        },
        {
          claim: 'Moderate concern about task complexity',
          counterArgument: 'Some tasks were actually challenging',
          severity: 'moderate',
        },
      ],
      strongUnresolvedArgument: false,
      verdictType: 'Maintain',
      confidence: 0.75,
      summary: 'Only minor/moderate concerns',
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
    const result = await runDevilsAdvocate(ctx);

    expect(result.strongUnresolvedArgument).toBe(false);
  });

  it('handles empty decisionTraces', async () => {
    const mockOutput: DevilsAdvocateOutput = {
      challenges: [
        {
          claim: 'No decision data available to evaluate',
          counterArgument: 'Cannot make informed assessment',
          severity: 'moderate',
        },
      ],
      strongUnresolvedArgument: false,
      verdictType: 'Monitor',
      confidence: 0.60,
      summary: 'Insufficient data for confident assessment',
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

    const result = await runDevilsAdvocate(ctx);

    expect(result).toBeDefined();
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('passes all decision traces to prompt (including failures)', async () => {
    const mockOutput: DevilsAdvocateOutput = {
      challenges: [],
      strongUnresolvedArgument: false,
      verdictType: 'Maintain',
      confidence: 0.75,
      summary: 'All traces reviewed',
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
          decisionId: 'dec-success-1',
          decisionType: 'route-intelligence',
          directiveReferenced: 'prioritize accuracy',
          attributionConfidence: '0.9',
          outcome: 'success',
          metadata: {},
        },
        {
          decisionId: 'dec-failure-1',
          decisionType: 'resource-allocation',
          directiveReferenced: 'avoid speculation',
          attributionConfidence: '0.3',
          outcome: 'failure',
          metadata: {},
        },
        {
          decisionId: 'dec-partial-1',
          decisionType: 'task-routing',
          directiveReferenced: null,
          attributionConfidence: '0.6',
          outcome: 'partial',
          metadata: {},
        },
      ],
    });

    await runDevilsAdvocate(ctx);

    const callArgs = mockGenerateText.mock.calls[0]?.[0];
    const promptContent = callArgs.prompt as string;
    expect(promptContent).toContain('dec-success-1');
    expect(promptContent).toContain('dec-failure-1');
    expect(promptContent).toContain('dec-partial-1');
    expect(promptContent).toContain('Successes: 1');
    expect(promptContent).toContain('Failures: 1');
    expect(promptContent).toContain('Partial: 1');
  });

  it('handles missing soulContent', async () => {
    const mockOutput: DevilsAdvocateOutput = {
      challenges: [
        {
          claim: 'Cannot verify directive attribution without soul content',
          counterArgument: 'Limited evaluation possible',
          severity: 'moderate',
        },
      ],
      strongUnresolvedArgument: false,
      verdictType: 'Monitor',
      confidence: 0.65,
      summary: 'Soul content unavailable',
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

    const result = await runDevilsAdvocate(ctx);

    expect(result).toBeDefined();
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('handles missing botMetrics compositeScore and tier', async () => {
    const mockOutput: DevilsAdvocateOutput = {
      challenges: [],
      strongUnresolvedArgument: false,
      verdictType: 'Monitor',
      confidence: 0.68,
      summary: 'Limited metrics available',
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
      botMetrics: { tasksClaimed: 5, tasksCompleted: 3, tasksFailed: 1, compositeScore: null, tier: null },
    });

    const result = await runDevilsAdvocate(ctx);

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

    await expect(runDevilsAdvocate(ctx)).rejects.toThrow(
      "Devil's Advocate returned null output — schema validation failed",
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

    await expect(runDevilsAdvocate(ctx)).rejects.toThrow(
      "Devil's Advocate returned null output — schema validation failed",
    );
  });

  it('uses temperature 0.5 for adversarial creativity', async () => {
    const mockOutput: DevilsAdvocateOutput = {
      challenges: [],
      strongUnresolvedArgument: false,
      verdictType: 'Maintain',
      confidence: 0.75,
      summary: 'Standard evaluation',
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
    await runDevilsAdvocate(ctx);

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.5,
      }),
    );
  });

  it('handles zero tasks claimed', async () => {
    const mockOutput: DevilsAdvocateOutput = {
      challenges: [
        {
          claim: 'No tasks claimed — cannot assess performance',
          counterArgument: 'Wait for task execution data',
          severity: 'moderate',
        },
      ],
      strongUnresolvedArgument: false,
      verdictType: 'Monitor',
      confidence: 0.55,
      summary: 'No task data available',
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

    const result = await runDevilsAdvocate(ctx);

    expect(result).toBeDefined();
    expect(mockGenerateText).toHaveBeenCalled();
  });

  it('includes all three verdict types in challenges analysis', async () => {
    const mockOutput: DevilsAdvocateOutput = {
      challenges: [
        {
          claim: 'Promotion may be premature',
          counterArgument: 'Performance has been consistent',
          severity: 'minor',
        },
      ],
      strongUnresolvedArgument: false,
      verdictType: 'Maintain',
      confidence: 0.73,
      summary: 'Performance acceptable but not exceptional',
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
    const result = await runDevilsAdvocate(ctx);

    expect(['Promote', 'Maintain', 'Monitor', 'Demote', 'Retire']).toContain(result.verdictType);
  });
});
