import { describe, it, expect } from 'vitest';
import {
  verifyConstitution,
  buildAgentSessionPrompt,
  type BuildParams,
} from '../../services/agent-session-builder.js';

describe('agent-session-builder', () => {
  describe('verifyConstitution', () => {
    it('returns verified=true when no directives are expected', () => {
      const result = verifyConstitution('any soul content', []);
      expect(result.verified).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('returns verified=true when all directives are present in soul content', () => {
      const soulContent = 'INVIOLABLE: Never harm users\nINVIOLABLE: Always be honest';
      const directives = ['INVIOLABLE: Never harm users', 'INVIOLABLE: Always be honest'];
      const result = verifyConstitution(soulContent, directives);
      expect(result.verified).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('returns verified=false with missing directives when some are absent', () => {
      const soulContent = 'INVIOLABLE: Never harm users';
      const directives = ['INVIOLABLE: Never harm users', 'INVIOLABLE: Always be honest'];
      const result = verifyConstitution(soulContent, directives);
      expect(result.verified).toBe(false);
      expect(result.missing).toEqual(['INVIOLABLE: Always be honest']);
    });

    it('trims whitespace before comparing', () => {
      const soulContent = 'INVIOLABLE: Never harm users';
      const directives = ['  INVIOLABLE: Never harm users  '];
      const result = verifyConstitution(soulContent, directives);
      expect(result.verified).toBe(true);
    });
  });

  describe('buildAgentSessionPrompt', () => {
    function makeParams(overrides: Partial<BuildParams> = {}): BuildParams {
      return {
        soulContent: '# SOUL.md\nINVIOLABLE: Be safe\n## Identity\nI am a test agent.',
        constitutionDirectives: ['INVIOLABLE: Be safe'],
        taskDescription: 'Analyze the dataset',
        taskId: 'task-1',
        requiredTools: ['browser', 'code_runner'],
        complexity: 'medium',
        upstreamOutputs: null,
        ...overrides,
      };
    }

    it('includes soul content, task brief, and footer in fullPrompt', () => {
      const result = buildAgentSessionPrompt(makeParams());

      expect(result.fullPrompt).toContain('# SOUL.md');
      expect(result.fullPrompt).toContain('## Task Assignment');
      expect(result.fullPrompt).toContain('Task ID: task-1');
      expect(result.fullPrompt).toContain('Complexity: medium');
      expect(result.fullPrompt).toContain('browser, code_runner');
      expect(result.fullPrompt).toContain('Analyze the dataset');
      expect(result.fullPrompt).toContain('You are bound by the SOUL.md constitution');
    });

    it('sets constitutionVerified=true when all directives present', () => {
      const result = buildAgentSessionPrompt(makeParams());
      expect(result.constitutionVerified).toBe(true);
    });

    it('sets constitutionVerified=false when directives are missing', () => {
      const result = buildAgentSessionPrompt(
        makeParams({ constitutionDirectives: ['INVIOLABLE: Missing directive'] }),
      );
      expect(result.constitutionVerified).toBe(false);
    });

    it('includes upstream intelligence when provided', () => {
      const result = buildAgentSessionPrompt(
        makeParams({
          upstreamOutputs: [
            { taskId: 'task-0', summary: 'Upstream result summary' },
          ],
        }),
      );

      expect(result.fullPrompt).toContain('## Upstream Intelligence');
      expect(result.fullPrompt).toContain('### Task task-0');
      expect(result.fullPrompt).toContain('Upstream result summary');
      expect(result.upstreamIntelligence).not.toBeNull();
    });

    it('omits upstream intelligence when upstreamOutputs is null', () => {
      const result = buildAgentSessionPrompt(makeParams());
      expect(result.fullPrompt).not.toContain('## Upstream Intelligence');
      expect(result.upstreamIntelligence).toBeNull();
    });

    it('omits upstream intelligence when upstreamOutputs is empty', () => {
      const result = buildAgentSessionPrompt(makeParams({ upstreamOutputs: [] }));
      expect(result.upstreamIntelligence).toBeNull();
    });

    it('displays "(none specified)" when requiredTools is empty', () => {
      const result = buildAgentSessionPrompt(makeParams({ requiredTools: [] }));
      expect(result.taskBrief).toContain('(none specified)');
    });

    it('returns all expected fields', () => {
      const result = buildAgentSessionPrompt(makeParams());
      expect(result).toHaveProperty('fullPrompt');
      expect(result).toHaveProperty('soulContent');
      expect(result).toHaveProperty('constitutionVerified');
      expect(result).toHaveProperty('constitutionDirectives');
      expect(result).toHaveProperty('taskBrief');
      expect(result).toHaveProperty('upstreamIntelligence');
    });
  });
});
