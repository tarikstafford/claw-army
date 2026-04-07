import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockValues = vi.fn();

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn(),
    insert: mockInsert.mockReturnValue({
      values: mockValues.mockResolvedValue(undefined),
    }),
  },
  toolInvocations: {
    id: 'id',
    executionId: 'execution_id',
    botId: 'bot_id',
    toolName: 'tool_name',
    invocationId: 'invocation_id',
    rejected: 'rejected',
    rejectionReason: 'rejection_reason',
    durationMs: 'duration_ms',
    promptTokens: 'prompt_tokens',
    completionTokens: 'completion_tokens',
    totalTokens: 'total_tokens',
    requestSummary: 'request_summary',
    responseSummary: 'response_summary',
  },
}));

describe('writeAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({
      values: mockValues.mockResolvedValue(undefined),
    });
  });

  it('writes correct fields to toolInvocations table', async () => {
    const { writeAuditLog } = await import('../services/audit-log.js');

    const entry = {
      executionId: 'exec-123',
      botId: 'bot-456',
      toolName: 'llm_call',
      invocationId: 'inv-789',
      rejected: false,
      durationMs: 1500,
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      requestSummary: { model: 'gpt-4' },
      responseSummary: { content: 'Hello' },
    };

    await writeAuditLog(entry);

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        executionId: 'exec-123',
        botId: 'bot-456',
        toolName: 'llm_call',
        invocationId: 'inv-789',
        rejected: false,
        rejectionReason: null,
        durationMs: 1500,
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        requestSummary: { model: 'gpt-4' },
        responseSummary: { content: 'Hello' },
      }),
    );
  });

  it('omits optional fields when not provided', async () => {
    const { writeAuditLog } = await import('../services/audit-log.js');

    const entry = {
      executionId: 'exec-123',
      botId: 'bot-456',
      toolName: 'fetch_url',
      invocationId: 'inv-abc',
      rejected: true,
      rejectionReason: 'not_in_allowlist',
    };

    await writeAuditLog(entry);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        executionId: 'exec-123',
        botId: 'bot-456',
        toolName: 'fetch_url',
        invocationId: 'inv-abc',
        rejected: true,
        rejectionReason: 'not_in_allowlist',
        durationMs: null,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        requestSummary: null,
        responseSummary: null,
      }),
    );
  });

  it('truncates requestSummary when exceeds 2000 characters', async () => {
    const { writeAuditLog } = await import('../services/audit-log.js');

    const longContent = 'x'.repeat(3000);
    const entry = {
      executionId: 'exec-123',
      botId: 'bot-456',
      toolName: 'llm_call',
      invocationId: 'inv-long',
      rejected: false,
      requestSummary: { largeData: longContent },
    };

    await writeAuditLog(entry);

    const insertCall = mockValues.mock.calls[0][0];
    expect(insertCall.requestSummary).toMatchObject({
      _truncated: true,
    });
    expect(insertCall.requestSummary.preview.length).toBe(2000);
    expect(insertCall.requestSummary.preview.startsWith('{"largeData":"')).toBe(true);
  });

  it('does not crash when database write fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockValues.mockRejectedValueOnce(new Error('DB connection failed'));

    const { writeAuditLog } = await import('../services/audit-log.js');

    const entry = {
      executionId: 'exec-123',
      botId: 'bot-456',
      toolName: 'llm_call',
      invocationId: 'inv-fail',
      rejected: false,
    };

    await expect(writeAuditLog(entry)).resolves.not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[audit-log] Failed to write audit log entry:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});