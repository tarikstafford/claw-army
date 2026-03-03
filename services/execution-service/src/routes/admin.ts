import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { InstancesClient } from '@google-cloud/compute';
import IORedis from 'ioredis';
import { db } from '@claw/db';
import { sql } from 'drizzle-orm';
import { pruneDecisionTraces } from '../performance/attribution-compiler';
import { taskQueue } from '../queue/task-queue';

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID ?? 'claw-local';
const GCP_ZONE = process.env.GCP_ZONE ?? 'us-central1-a';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Module-level singleton — do NOT create per-request (avoids repeated auth overhead)
const gceClient = new InstancesClient();

async function checkGCE(): Promise<{ ok: true; instanceCount: number } | { ok: false; error: string }> {
  try {
    let instanceCount = 0;
    for await (const _instance of gceClient.list({ project: GCP_PROJECT_ID, zone: GCP_ZONE, maxResults: 1 })) {
      instanceCount++;
      break; // only need the first page
    }
    return { ok: true, instanceCount };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function checkCloudSQL(): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }> {
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function checkRedis(): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }> {
  const client = new IORedis(REDIS_URL, { connectTimeout: 2000, lazyConnect: true });
  try {
    const start = Date.now();
    await client.connect();
    await client.ping();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    await client.disconnect();
  }
}

async function checkBullMQ(): Promise<{ ok: true; counts: Record<string, number> } | { ok: false; error: string }> {
  try {
    const counts = await taskQueue.getJobCounts('waiting', 'active', 'failed');
    return { ok: true, counts };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /admin/cleanup/decision-traces
   *
   * Triggers TTL-based pruning of the decision_traces table.
   * Deletes rows older than 90 days when total count exceeds 5M rows.
   *
   * Intended to be called by Cloud Scheduler or a manual operator.
   * Phase 8 documents the 90-day / 5M-row policy;
   * Phase 10 implements this enforcement endpoint.
   */
  app.post('/cleanup/decision-traces', async (_request, reply) => {
    const result = await pruneDecisionTraces();
    return reply.status(200).send({
      status: 'ok',
      deleted: result.deleted,
    });
  });

  /**
   * POST /admin/waitlist
   *
   * Accepts an email address for the early-access waitlist.
   * No DB write — logs the email to Cloud Logging (satisfies POLISH-01
   * "stores or forwards" requirement with zero schema churn).
   */
  app.post(
    '/waitlist',
    {
      schema: {
        body: Type.Object({
          email: Type.String({ minLength: 3 }),
        }),
      },
    },
    async (request, reply) => {
      const { email } = request.body as { email: string };

      // Simple @ check — AJV v8 ignores format: 'email' by default
      if (!email.includes('@')) {
        return reply.status(400).send({ error: 'A valid email address is required.' });
      }

      request.log.info({ email }, 'waitlist signup');
      return reply.status(200).send({ ok: true });
    },
  );

  /**
   * GET /admin/health
   *
   * Probes all four subsystems (GCE, Cloud SQL, Redis, BullMQ) and returns structured JSON.
   * Returns 200 with status "healthy" when all subsystems are reachable.
   * Returns 503 with status "degraded" when any subsystem is unreachable.
   *
   * Subsystem checks run in parallel via Promise.allSettled so all complete
   * even if one throws.
   *
   * POLISH-03
   */
  app.get('/health', async (_request, reply) => {
    const [gce, cloudSQL, redis, bullMQ] = await Promise.allSettled([
      checkGCE(),
      checkCloudSQL(),
      checkRedis(),
      checkBullMQ(),
    ]);

    const extract = (r: PromiseSettledResult<any>) =>
      r.status === 'fulfilled' ? r.value : { ok: false, error: String(r.reason) };

    const subsystems = {
      gce: extract(gce),
      cloudSQL: extract(cloudSQL),
      redis: extract(redis),
      bullMQ: extract(bullMQ),
    };

    const allHealthy = Object.values(subsystems).every((s: any) => s.ok);
    return reply.code(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'healthy' : 'degraded',
      subsystems,
    });
  });
}
