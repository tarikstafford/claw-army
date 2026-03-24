import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @claw/db before importing the module under test
vi.mock('@claw/db', () => {
  const insertMock = vi.fn();
  const valuesMock = vi.fn().mockResolvedValue(undefined);
  insertMock.mockReturnValue({ values: valuesMock });

  return {
    db: {
      insert: insertMock,
    },
    toolInvocationLogs: Symbol('toolInvocationLogs'),
  };
});

import { logInvocation } from '../services/invocation-logger.js';
import { db, toolInvocationLogs } from '@claw/db';

describe('logInvocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock chain
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });
  });

  it('inserts a row with correct fields', async () => {
    const input = {
      toolId: 'hubspot',
      action: 'hubspot:create-contact',
      agentId: 'agent-123',
      userId: 'user-456',
      connectionId: 'conn-789',
      latencyMs: 120,
      success: true,
      requestSummary: 'create contact test',
      responseSummary: 'contact created',
    };

    await logInvocation(input);

    expect(db.insert).toHaveBeenCalledWith(toolInvocationLogs);
    const valuesMock = (db.insert as ReturnType<typeof vi.fn>).mock.results[0]?.value?.values;
    expect(valuesMock).toHaveBeenCalledOnce();

    const insertedRow = valuesMock.mock.calls[0]?.[0];
    expect(insertedRow).toMatchObject({
      toolId: 'hubspot',
      action: 'hubspot:create-contact',
      agentId: 'agent-123',
      userId: 'user-456',
      connectionId: 'conn-789',
      latencyMs: 120,
      success: true,
      requestSummary: 'create contact test',
      responseSummary: 'contact created',
    });
  });

  it('truncates requestSummary and responseSummary to 500 chars', async () => {
    const longString = 'x'.repeat(600);

    await logInvocation({
      toolId: 'slack',
      action: 'slack:send-message',
      agentId: null,
      userId: 'user-1',
      connectionId: 'conn-1',
      latencyMs: 50,
      success: true,
      requestSummary: longString,
      responseSummary: longString,
    });

    const valuesMock = (db.insert as ReturnType<typeof vi.fn>).mock.results[0]?.value?.values;
    const insertedRow = valuesMock.mock.calls[0]?.[0];

    expect(insertedRow.requestSummary).toHaveLength(500);
    expect(insertedRow.responseSummary).toHaveLength(500);
  });

  it('does not throw when db insert fails (fire-and-forget)', async () => {
    const valuesMock = vi.fn().mockRejectedValue(new Error('DB connection lost'));
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: valuesMock });

    // Should not throw
    await expect(
      logInvocation({
        toolId: 'hubspot',
        action: 'hubspot:create-deal',
        agentId: 'agent-001',
        userId: 'user-001',
        connectionId: 'conn-001',
        latencyMs: 200,
        success: false,
        errorMessage: 'Deal creation failed',
      }),
    ).resolves.toBeUndefined();
  });
});
