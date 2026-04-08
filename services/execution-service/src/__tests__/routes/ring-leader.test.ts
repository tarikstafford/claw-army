import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { ringLeaderRoutes } from '../../routes/ring-leader.js';
import { getCoordinationLog } from '../../services/coordination-events.js';

vi.mock('@claw/db', () => ({
  db: {
    select: vi.fn(),
  },
  ringLeaderRuns: {},
  ringLeaderFitness: {},
}));

vi.mock('../services/coordination-events.js', () => ({
  getCoordinationLog: vi.fn(),
}));

describe('ringLeaderRoutes', () => {
  let app: ReturnType<typeof Fastify.withTypeProvider<TypeBoxTypeProvider>>;

  beforeEach(async () => {
    app = Fastify({ logger: false }).withTypeProvider<TypeBoxTypeProvider>();
    await app.register(ringLeaderRoutes, { prefix: '/ring-leader' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  const mockRun = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    executionId: '223e4567-e89b-12d3-a456-426614174000',
    status: 'assembling',
    populationManifest: [
      {
        taskId: 'task-1',
        taskDescription: 'Analyze sales data',
        assignedSouls: [
          {
            soulId: 'soul-1',
            agentClass: 'Artisan' as const,
            source: 'library' as const,
            parentSoulId: null,
            mutationApplied: null,
            selectionRationale: 'Highest differentiation score',
            differentiationScore: 0.9,
          },
        ],
        pioneerFlag: false,
        varianceIntent: null,
      },
    ],
    missionBrief: { objective: 'Test mission' },
    runState: null,
    synthesis: null,
  };

  describe('GET /ring-leader/runs/:runId/manifest', () => {
    it('returns 200 with manifest when run exists', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRun]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/ring-leader/runs/123e4567-e89b-12d3-a456-426614174000/manifest',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.runId).toBe(mockRun.id);
      expect(body.executionId).toBe(mockRun.executionId);
      expect(body.manifests).toHaveLength(1);
    });

    it('returns 404 when run not found', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/ring-leader/runs/123e4567-e89b-12d3-a456-426614174000/manifest',
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Ring Leader run not found');
    });

    it('returns empty manifests when populationManifest is null', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockRun, populationManifest: null }]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/ring-leader/runs/123e4567-e89b-12d3-a456-426614174000/manifest',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.manifests).toEqual([]);
    });
  });

  describe('GET /ring-leader/runs/by-execution/:executionId', () => {
    it('returns 200 with manifest when run found by execution ID', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRun]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/ring-leader/runs/by-execution/223e4567-e89b-12d3-a456-426614174000',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.executionId).toBe(mockRun.executionId);
    });

    it('returns 404 when no run found for execution', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/ring-leader/runs/by-execution/223e4567-e89b-12d3-a456-426614174000',
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Ring Leader run not found for this execution');
    });
  });

  describe('GET /ring-leader/runs/by-execution/:executionId/state', () => {
    it('returns 200 with run state', async () => {
      const { db } = await import('@claw/db');
      const runWithState = {
        ...mockRun,
        runState: {
          runId: mockRun.id,
          elapsedTimeSeconds: 120,
          budgetConsumedCents: 500,
          taskStates: {
            'task-1': {
              status: 'running',
              activeAgents: ['bot-1'],
              completedAgents: [],
              failedAgents: [],
              outputQualitySignal: null,
            },
          },
          objectiveDriftScore: 0.1,
          anomalies: [],
        },
      };
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([runWithState]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/ring-leader/runs/by-execution/223e4567-e89b-12d3-a456-426614174000/state',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.runState).not.toBeNull();
      expect(body.runState!.elapsedTimeSeconds).toBe(120);
    });

    it('returns null runState when not yet in coordinating phase', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRun]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/ring-leader/runs/by-execution/223e4567-e89b-12d3-a456-426614174000/state',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.runState).toBeNull();
    });
  });

  describe('GET /ring-leader/runs/by-execution/:executionId/events', () => {
    it('returns 200 with coordination events', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRun]),
          }),
        }),
      } as any);

      const mockEvents = [
        { type: 'population_assembled', timestamp: '2025-01-01T00:00:00Z', payload: {} },
        { type: 'coordinating_started', timestamp: '2025-01-01T00:01:00Z', payload: {} },
      ];
      vi.mocked(getCoordinationLog).mockReturnValue(mockEvents);

      const res = await app.inject({
        method: 'GET',
        url: '/ring-leader/runs/by-execution/223e4567-e89b-12d3-a456-426614174000/events',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.events).toHaveLength(2);
      expect(body.runId).toBe(mockRun.id);
    });
  });

  describe('GET /ring-leader/runs/by-execution/:executionId/synthesis', () => {
    it('returns 200 with synthesis and fitness scores', async () => {
      const { db } = await import('@claw/db');
      const runWithSynthesis = {
        ...mockRun,
        status: 'completed',
        synthesis: { summary: 'All tasks completed successfully' },
      };
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([runWithSynthesis]),
          }),
        }),
      } as any);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              coordinationScore: { collectiveOutcome: 0.9, driftPrevention: 0.8, reallocationEffectiveness: 0.85, budgetManagement: 0.9 },
              soulSelectionScore: { librarySearchQuality: 0.95, differentiationEffectiveness: 0.88, mutationDecisionQuality: 0.82, pioneerHandling: 0.9, selectionRetrospectiveQuality: 0.85 },
              compositeScore: '0.873',
            }]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/ring-leader/runs/by-execution/223e4567-e89b-12d3-a456-426614174000/synthesis',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.synthesis).not.toBeNull();
      expect(body.status).toBe('completed');
    });

    it('returns null fitness when run is in progress', async () => {
      const { db } = await import('@claw/db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRun]),
          }),
        }),
      } as any);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const res = await app.inject({
        method: 'GET',
        url: '/ring-leader/runs/by-execution/223e4567-e89b-12d3-a456-426614174000/synthesis',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.fitness).toBeNull();
    });
  });
});
