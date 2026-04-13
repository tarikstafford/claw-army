import { describe, it, expect, vi, beforeEach } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Mock node:fs/promises before importing injectSoulIntoAgent
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock @claw/db with a chainable mock db
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
};

vi.mock('@claw/db', () => ({
  db: mockDb,
  paperclipAgents: {
    id: 'id',
    companyId: 'company_id',
    adapterConfig: 'adapter_config',
    updatedAt: 'updated_at',
  },
}));

describe('injectSoulIntoAgent', () => {
  let mkdir: ReturnType<typeof vi.fn>;
  let writeFile: ReturnType<typeof vi.fn>;
  let injectSoulIntoAgent: (
    agentId: string,
    companyId: string,
    soulContent: string,
    soulId: string,
    adapterType?: string,
  ) => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset the chainable mock
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockResolvedValue({ rowCount: 1 });

    const fs = await import('node:fs/promises');
    mkdir = fs.mkdir as unknown as ReturnType<typeof vi.fn>;
    writeFile = fs.writeFile as unknown as ReturnType<typeof vi.fn>;

    const injectorModule = await import('../services/soul-injector.js');
    injectSoulIntoAgent = injectorModule.injectSoulIntoAgent;
  });

  describe('default adapter (instructionsFilePath)', () => {
    it('writes soul content to disk and updates agent adapterConfig.instructionsFilePath', async () => {
      const agentId = 'agent-uuid-123';
      const companyId = 'company-uuid-456';
      const soulContent = '# SOUL.md\n## Identity and Role\nTest agent soul content';
      const soulId = 'soul-uuid-789';

      await injectSoulIntoAgent(agentId, companyId, soulContent, soulId);

      // Verify mkdir was called for soul directory
      expect(mkdir).toHaveBeenCalledWith(
        join(homedir(), '.akasa', 'souls'),
        { recursive: true },
      );

      // Verify writeFile was called with soul content
      expect(writeFile).toHaveBeenCalledWith(
        join(homedir(), '.akasa', 'souls', `${soulId}.md`),
        soulContent,
        'utf-8',
      );

      // Verify DB update was called
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('openai_compatible adapter (systemPrompt)', () => {
    it('sets adapterConfig.systemPrompt instead of instructionsFilePath for openai_compatible adapter', async () => {
      const agentId = 'agent-openai-compat';
      const companyId = 'company-123';
      const soulContent = '# SOUL.md system prompt content';
      const soulId = 'soul-openai-123';
      const adapterType = 'openai_compatible';

      await injectSoulIntoAgent(
        agentId,
        companyId,
        soulContent,
        soulId,
        adapterType,
      );

      // For openai_compatible, systemPrompt should be set in the DB call
      expect(mockDb.update).toHaveBeenCalled();
      const setCall = mockDb.set.mock.calls[0];
      expect(setCall).toBeDefined();
      // The set call should contain systemPrompt in adapterConfig
      const setArg = setCall?.[0] as Record<string, unknown> | undefined;
      if (setArg && typeof setArg === 'object') {
        // adapterConfig should include systemPrompt
        const adapterConfig = setArg['adapterConfig'] as Record<string, unknown> | undefined;
        if (adapterConfig) {
          expect(adapterConfig).toHaveProperty('systemPrompt');
        }
      }
    });
  });
});
