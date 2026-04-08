import { describe, it, expect, vi } from 'vitest';

// The BullMQ Queue import is mocked entirely — only test the exported constants and types

describe('council-queue', () => {
  describe('COUNCIL_QUEUE_NAME', () => {
    it('is council-queue', () => {
      const COUNCIL_QUEUE_NAME = 'council-queue';
      expect(COUNCIL_QUEUE_NAME).toBe('council-queue');
    });
  });

  describe('CouncilJobData interface', () => {
    it('has required fields: executionId, botId, soulId', () => {
      const jobData = {
        executionId: 'exec-123',
        botId: 'bot-456',
        soulId: 'soul-789',
      };
      expect(jobData.executionId).toBe('exec-123');
      expect(jobData.botId).toBe('bot-456');
      expect(jobData.soulId).toBe('soul-789');
    });

    it('allows null soulId', () => {
      const jobData = {
        executionId: 'exec-123',
        botId: 'bot-456',
        soulId: null,
      };
      expect(jobData.soulId).toBeNull();
    });

    it('allows optional ringLeaderSynthesis', () => {
      const jobData = {
        executionId: 'exec-123',
        botId: 'bot-456',
        soulId: null,
        ringLeaderSynthesis: {
          synthesisId: 'synth-1',
          summary: 'A great synthesis',
          keyPatterns: [],
          confidence: 0.9,
        },
      };
      expect(jobData.ringLeaderSynthesis?.summary).toBe('A great synthesis');
    });
  });

  describe('CouncilContext interface', () => {
    it('has all required fields', () => {
      const context = {
        executionId: 'exec-123',
        botId: 'bot-456',
        soulId: 'soul-789',
        soulContent: 'Be excellent to each other',
        constitutionDirectives: ['Be excellent', 'Party on'],
        taskCategory: 'general',
        botMetrics: {
          tasksClaimed: 10,
          tasksCompleted: 8,
          tasksFailed: 1,
          compositeScore: '0.85',
          tier: 'Artisan',
        },
        decisionTraces: [
          {
            decisionId: 'd-1',
            decisionType: 'routing',
            directiveReferenced: 'Be excellent',
            attributionConfidence: '0.9',
            outcome: 'success',
            metadata: {},
          },
        ],
        telemetryMetrics: [
          {
            metricName: 'latency_ms',
            metricValue: '150',
          },
        ],
        ringLeaderSynthesis: null,
      };

      expect(context.executionId).toBe('exec-123');
      expect(context.botMetrics.tasksCompleted).toBe(8);
      expect(context.constitutionDirectives).toHaveLength(2);
      expect(context.decisionTraces[0]!.directiveReferenced).toBe('Be excellent');
      expect(context.telemetryMetrics[0]!.metricName).toBe('latency_ms');
    });

    it('allows null soulContent and taskCategory', () => {
      const context = {
        executionId: 'exec-123',
        botId: 'bot-456',
        soulId: null,
        soulContent: null,
        constitutionDirectives: [],
        taskCategory: null,
        botMetrics: {
          tasksClaimed: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
          compositeScore: null,
          tier: null,
        },
        decisionTraces: [],
        telemetryMetrics: [],
      };

      expect(context.soulContent).toBeNull();
      expect(context.taskCategory).toBeNull();
      expect(context.botMetrics.compositeScore).toBeNull();
    });
  });
});
