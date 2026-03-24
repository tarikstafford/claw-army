import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared CouncilContext fixture ──────────────────────────────────────────────

const makeCtx = (overrides = {}) => ({
  executionId: 'exec-1',
  botId: 'bot-1',
  soulId: 'soul-1',
  soulContent: '# SOUL.md\n## Identity and Role\nI am a cautious verifier.',
  constitutionDirectives: ['Never fabricate data', 'Always cite sources'],
  taskCategory: 'web-research',
  botMetrics: {
    tasksClaimed: 10,
    tasksCompleted: 8,
    tasksFailed: 2,
    compositeScore: '0.78',
    tier: 'Understudy',
  },
  decisionTraces: [
    {
      decisionId: 'dec-1',
      decisionType: 'tool_call',
      directiveReferenced: 'Always cite sources',
      attributionConfidence: '0.9',
      outcome: 'success',
      metadata: { tool: 'fetch_url' },
    },
  ],
  telemetryMetrics: [
    { metricName: 'token_total', metricValue: '5000' },
  ],
  ...overrides,
});

// ─── Shared bot row fixture ────────────────────────────────────────────────────

const makeBotRow = (overrides = {}) => ({
  id: 'bot-1',
  executionId: 'exec-1',
  soulId: 'soul-1',
  tasksClaimed: 10,
  tasksCompleted: 8,
  tasksFailed: 2,
  compositeScore: '0.78',
  tier: 'Understudy',
  ...overrides,
});

// ─── Performance Judge tests ─────────────────────────────────────────────────────

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn().mockReturnValue({}),
  },
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn().mockReturnValue('mocked-anthropic-model'),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn().mockReturnValue('mocked-openai-model'),
}));

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  bots: { id: 'id', tasksClaimed: 'tasks_claimed', tasksCompleted: 'tasks_completed', tasksFailed: 'tasks_failed', compositeScore: 'composite_score', tier: 'tier' },
  botSouls: { id: 'id', soulContent: 'soul_content', constitutionDirectives: 'constitution_directives', taskCategory: 'task_category' },
  councilVerdicts: { executionId: 'execution_id', botId: 'bot_id' },
}));

describe('runPerformanceJudge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns typed output with all required fields', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({
      output: {
        verdictType: 'Maintain',
        confidence: 0.72,
        summary: 'Solid performance',
        reasoning: 'Tasks completed at 80% rate',
        keyMetrics: { successRate: 0.8, compositeScore: 0.78, tier: 'Understudy' },
      },
    } as never);

    const { runPerformanceJudge } = await import('../council/performance-judge.js');
    const result = await runPerformanceJudge(makeCtx());

    expect(result).toHaveProperty('verdictType');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('reasoning');
    expect(result).toHaveProperty('keyMetrics');
    expect(['Promote', 'Maintain', 'Monitor', 'Demote', 'Retire']).toContain(result.verdictType);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('throws if generateText returns null output', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({ output: null } as never);

    const { runPerformanceJudge } = await import('../council/performance-judge.js');
    await expect(runPerformanceJudge(makeCtx())).rejects.toThrow('Performance Judge');
  });
});

// ─── Soul Analyst tests ───────────────────────────────────────────────────────────

describe('runSoulAnalyst', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns typed output with all required fields', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({
      output: {
        directiveAttributionVerification: [
          {
            decisionId: 'dec-1',
            directiveReferenced: 'Always cite sources',
            selfReportedConfidence: 0.9,
            counterfactualScore: 0.85,
            counterfactualOverrides: false,
            reasoning: 'Directive was causally relevant',
          },
        ],
        overallSoulAlignment: 0.82,
        verdictType: 'Maintain',
        confidence: 0.75,
        summary: 'Good soul alignment',
        disagreementRate: 0.0,
      },
    } as never);

    const { runSoulAnalyst } = await import('../council/soul-analyst.js');
    const result = await runSoulAnalyst(makeCtx());

    expect(result).toHaveProperty('overallSoulAlignment');
    expect(result).toHaveProperty('verdictType');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('disagreementRate');
    expect(result).toHaveProperty('directiveAttributionVerification');
    expect(Array.isArray(result.directiveAttributionVerification)).toBe(true);
  });

  it('applies deterministic counterfactualOverrides post-processing', async () => {
    // selfReportedConfidence=0.9, counterfactualScore=0.5 → diff=0.4 > 0.25 → should override
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({
      output: {
        directiveAttributionVerification: [
          {
            decisionId: 'dec-1',
            directiveReferenced: 'Always cite sources',
            selfReportedConfidence: 0.9,
            counterfactualScore: 0.5,
            counterfactualOverrides: false, // LLM says no, but threshold says yes
            reasoning: 'Questionable',
          },
        ],
        overallSoulAlignment: 0.5,
        verdictType: 'Monitor',
        confidence: 0.55,
        summary: 'Concerning soul alignment',
        disagreementRate: 0.0, // LLM says 0, threshold override should make it 1.0
      },
    } as never);

    const { runSoulAnalyst } = await import('../council/soul-analyst.js');
    const result = await runSoulAnalyst(makeCtx());

    // The deterministic post-processing should have overridden to true
    expect(result.directiveAttributionVerification[0]!.counterfactualOverrides).toBe(true);
    expect(result.disagreementRate).toBe(1.0);
  });
});

// ─── Devil's Advocate tests ──────────────────────────────────────────────────────

describe('runDevilsAdvocate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns typed output with all required fields', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({
      output: {
        challenges: [
          {
            claim: 'Tasks were easy',
            counterArgument: 'Success rate may be inflated by trivial tasks',
            severity: 'minor',
          },
        ],
        strongUnresolvedArgument: false,
        verdictType: 'Maintain',
        confidence: 0.6,
        summary: 'No strong concerns identified',
      },
    } as never);

    const { runDevilsAdvocate } = await import('../council/devils-advocate.js');
    const result = await runDevilsAdvocate(makeCtx());

    expect(result).toHaveProperty('challenges');
    expect(result).toHaveProperty('strongUnresolvedArgument');
    expect(result).toHaveProperty('verdictType');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('summary');
    expect(Array.isArray(result.challenges)).toBe(true);
  });

  it('sets strongUnresolvedArgument=true deterministically when strong severity exists', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockResolvedValue({
      output: {
        challenges: [
          { claim: 'Serious flaw', counterArgument: 'Agent falsified data', severity: 'strong' },
        ],
        strongUnresolvedArgument: false, // LLM says false, should be overridden
        verdictType: 'Demote',
        confidence: 0.4,
        summary: 'Strong concerns identified',
      },
    } as never);

    const { runDevilsAdvocate } = await import('../council/devils-advocate.js');
    const result = await runDevilsAdvocate(makeCtx());

    expect(result.strongUnresolvedArgument).toBe(true);
  });
});

// ─── Council Runner tests ─────────────────────────────────────────────────────────

describe('runCouncilForBot', () => {
  const mockPJ = {
    verdictType: 'Maintain' as const,
    confidence: 0.72,
    summary: 'Solid performance',
    reasoning: 'Tasks completed at 80% rate',
    keyMetrics: { successRate: 0.8, compositeScore: 0.78, tier: 'Understudy' },
  };

  const mockSA = {
    directiveAttributionVerification: [],
    overallSoulAlignment: 0.82,
    verdictType: 'Maintain' as const,
    confidence: 0.75,
    summary: 'Good soul alignment',
    disagreementRate: 0.0,
  };

  const mockDA = {
    challenges: [],
    strongUnresolvedArgument: false,
    verdictType: 'Maintain' as const,
    confidence: 0.6,
    summary: 'No major concerns',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls all 3 judges and inserts verdict into DB', async () => {
    const { generateText } = await import('ai');
    // generateText called 3 times — once per judge in parallel
    vi.mocked(generateText)
      .mockResolvedValueOnce({ output: mockPJ } as never)
      .mockResolvedValueOnce({ output: mockSA } as never)
      .mockResolvedValueOnce({ output: mockDA } as never);

    const { db: mockDb } = await import('@claw/db');
    const returningMock = vi.fn().mockResolvedValue([{
      id: 'verdict-1',
      executionId: 'exec-1',
      botId: 'bot-1',
      verdictType: 'Maintain',
      status: 'pending',
      weightedConfidenceScore: '0.712',
      requiresHumanConfirmation: false,
      hasUnresolvedDevilsAdvocate: false,
      verdictSummary: 'test',
    }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    vi.mocked(mockDb.insert).mockReturnValue({ values: valuesMock } as never);
    vi.mocked(mockDb.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([makeBotRow()]),
        }),
      }),
    } as never);

    const { runCouncilForBot } = await import('../council/council-runner.js');
    await runCouncilForBot('exec-1', 'bot-1', null);

    expect(mockDb.insert).toHaveBeenCalled();
    expect(valuesMock).toHaveBeenCalled();
    expect(returningMock).toHaveBeenCalled();
  });

  it('sets requiresHumanConfirmation=true for Promote verdict', async () => {
    const { generateText } = await import('ai');
    const promoteVerdict = { ...mockPJ, verdictType: 'Promote' as const, confidence: 0.9 };
    const promoteSA = { ...mockSA, verdictType: 'Promote' as const, confidence: 0.85 };
    const promoteDA = { ...mockDA, verdictType: 'Promote' as const, confidence: 0.8 };

    vi.mocked(generateText)
      .mockResolvedValueOnce({ output: promoteVerdict } as never)
      .mockResolvedValueOnce({ output: promoteSA } as never)
      .mockResolvedValueOnce({ output: promoteDA } as never);

    const { db: mockDb } = await import('@claw/db');
    let capturedValues: Record<string, unknown> = {};
    const returningMock = vi.fn().mockResolvedValue([{ id: 'verdict-2', ...capturedValues }]);
    const valuesMock = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      capturedValues = vals;
      return { returning: returningMock };
    });
    vi.mocked(mockDb.insert).mockReturnValue({ values: valuesMock } as never);
    vi.mocked(mockDb.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([makeBotRow({ compositeScore: '0.9', tier: 'Artisan' })]),
        }),
      }),
    } as never);

    const { runCouncilForBot } = await import('../council/council-runner.js');
    await runCouncilForBot('exec-1', 'bot-1', 'soul-1');

    expect(capturedValues['requiresHumanConfirmation']).toBe(true);
  });

  it('sets requiresHumanConfirmation=true for Retire verdict', async () => {
    const { generateText } = await import('ai');
    const retireVerdict = { ...mockPJ, verdictType: 'Retire' as const, confidence: 0.9 };
    const retireSA = { ...mockSA, verdictType: 'Retire' as const, confidence: 0.85 };
    const retireDA = { ...mockDA, verdictType: 'Retire' as const, confidence: 0.8 };

    vi.mocked(generateText)
      .mockResolvedValueOnce({ output: retireVerdict } as never)
      .mockResolvedValueOnce({ output: retireSA } as never)
      .mockResolvedValueOnce({ output: retireDA } as never);

    const { db: mockDb } = await import('@claw/db');
    let capturedValues: Record<string, unknown> = {};
    const returningMock = vi.fn().mockResolvedValue([{ id: 'verdict-3', ...capturedValues }]);
    const valuesMock = vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      capturedValues = vals;
      return { returning: returningMock };
    });
    vi.mocked(mockDb.insert).mockReturnValue({ values: valuesMock } as never);
    vi.mocked(mockDb.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([makeBotRow({ tasksClaimed: 3, tasksCompleted: 0, compositeScore: '0.1', tier: 'Novice' })]),
        }),
      }),
    } as never);

    const { runCouncilForBot } = await import('../council/council-runner.js');
    await runCouncilForBot('exec-1', 'bot-1', 'soul-1');

    expect(capturedValues['requiresHumanConfirmation']).toBe(true);
  });

  it('handles partial judge failures gracefully (one judge failing)', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText)
      .mockResolvedValueOnce({ output: mockPJ } as never) // PJ succeeds
      .mockRejectedValueOnce(new Error('LLM timeout')) // SA fails
      .mockResolvedValueOnce({ output: mockDA } as never); // DA succeeds

    const { db: mockDb } = await import('@claw/db');
    const returningMock = vi.fn().mockResolvedValue([{ id: 'verdict-4' }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    vi.mocked(mockDb.insert).mockReturnValue({ values: valuesMock } as never);
    vi.mocked(mockDb.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([makeBotRow()]),
        }),
      }),
    } as never);

    const { runCouncilForBot } = await import('../council/council-runner.js');

    // Should not throw even though Soul Analyst failed
    await expect(runCouncilForBot('exec-1', 'bot-1', 'soul-1')).resolves.not.toThrow();
    expect(valuesMock).toHaveBeenCalled();
  });
});
