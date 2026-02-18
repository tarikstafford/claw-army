# Phase 3: Bot Runtime and Tool Gateway - Research

**Researched:** 2026-02-18
**Domain:** Fastify gateway service, JWT auth, Zod v4 validation, Redis rate limiting, Vercel AI SDK, Docker network isolation, LLM tool-calling loop, artifact storage
**Confidence:** HIGH for Tool Gateway patterns, Vercel AI SDK core API, JWT auth, and Zod v4; MEDIUM for bot reasoning loop architecture and AI SDK 6 stopWhen API; LOW for GCP VPC firewall specifics and artifact storage backend choice

---

## Summary

Phase 3 has four cooperating sub-systems: (1) a **Tool Gateway** — a new Fastify microservice that acts as the sole external interface for bot containers, enforcing JWT auth, allowlist checks, Zod v4 argument validation, per-bot Redis rate limiting, and structured audit logging on every invocation; (2) **Tool Implementations** — the three concrete tools (llm_call routing to a configured LLM provider via Vercel AI SDK, fetch_url with domain allowlist enforcement, write_file writing to a local artifact store); (3) a **Bot Worker Reasoning Loop** — replacing the Phase 2 stub bot with a real LLM-backed reasoning loop that iterates tool calls via the Tool Gateway until the task is complete; and (4) **Container Network Isolation** — confirming that bots on the `bot-internal` Docker network can reach the Tool Gateway and nothing else.

The `@claw/tool-contracts` package (already built in Phase 1/2) defines all three tool schemas in Zod v4. The JWT infrastructure (minting in `bot-orchestrator.ts`, `jose` library with HS256) is already in place from Phase 2. The Tool Gateway is a **new Fastify service** — not added to the existing execution-service — because it has a separate network boundary role: bots reach it, but it reaches back to LLM providers and the artifact store. This separation is the security boundary.

The key architectural tension in Phase 3 is the reasoning loop design: the bot worker needs to call `generateText` with tool definitions, but those tool implementations must NOT run locally inside the bot container — they must be HTTP calls to the Tool Gateway. The bot's tools are thin HTTP proxy stubs; all enforcement happens in the gateway. Vercel AI SDK 6 (package `ai@6.x`) with `generateText + tools + stopWhen: stepCountIs(N)` is the correct primitive for the loop.

**Primary recommendation:** Build the Tool Gateway as a new `services/tool-gateway` Fastify service. Use `@fastify/jwt` (verify-only mode with shared HS256 secret) for bot auth, manual Zod v4 `.safeParse()` for argument validation inside route handlers, and `rate-limiter-flexible` with the existing `ioredis` connection for per-bot rate limiting. For tool implementations: Vercel AI SDK `ai@6.x` with provider packages for llm_call, native Node.js `fetch` with URL hostname check for fetch_url, and `node:fs/promises` + UUID for write_file artifacts. For the bot reasoning loop: Vercel AI SDK `generateText` with `tools` defined as HTTP proxy stubs that POST to the Tool Gateway.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | 5.7.4 | Tool Gateway HTTP service | Already chosen for execution-service; same patterns apply |
| @fastify/jwt | 10.0.0 | JWT verification middleware for bot auth | Official Fastify plugin; wraps fast-jwt; Bearer token preHandler support |
| @fastify/rate-limit | 10.3.0 | Per-route rate limit scaffolding | Official plugin; supports custom keyGenerator and custom store |
| rate-limiter-flexible | 9.1.1 | Per-bot sliding-window rate limiting against Redis | Battle-tested; supports dual limiters (calls/min + tokens/min) with ioredis |
| ai | 6.0.90 | Vercel AI SDK — generateText, tool-calling loop | Unified API across providers; stopWhen controls loop; usage returns token counts |
| @ai-sdk/openai | 3.0.29 | OpenAI provider for llm_call | Official Vercel AI SDK provider; supports GPT-4o, GPT-4o-mini, o1 etc. |
| @ai-sdk/anthropic | 3.0.45 | Anthropic provider for llm_call | Official provider; Claude 3.5 Sonnet, Haiku etc. |
| @ai-sdk/google | 3.0.29 | Google provider for llm_call | Official provider; Gemini 2.0 Flash etc. |
| zod | ^4.3.6 | Argument schema validation (already in tool-contracts) | Already in use; v4 API with z.safeParse for gateway handlers |
| jose | 6.1.3 | JWT minting (bot-orchestrator) + verify (shared) | Already in use from Phase 2; jwtVerify used by gateway |
| ioredis | 5.9.3 | Redis client for rate limiter | Already installed; rate-limiter-flexible accepts ioredis instances |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @sinclair/typebox | 0.34.48 | Route-level schema for gateway's own endpoints | Fastify TypeBox provider already used in execution-service |
| @fastify/type-provider-typebox | 6.1.0 | TypeBox type provider for Fastify | Same pattern as execution-service |
| undici | 7.22.0 | fetch_url implementation — HTTP client | Node.js built-in fetch is backed by undici; available natively in Node 18+ |
| @google-cloud/storage | 7.19.0 | write_file artifact store (GCS in production) | Use local fs in dev, GCS bucket in prod; Phase 3 uses local fs with path-based API |
| drizzle-orm | 0.45.1 | Tool Gateway audit log writes | Insert tool_invocation_log rows after each invocation |
| @claw/tool-contracts | workspace | Zod schemas for all three tool request/response shapes | Already defined; gateway validates incoming requests against these |
| @claw/db | workspace | Drizzle client for audit log + execution metadata lookups | Already built; gateway needs to read allowed_tools from executions table |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rate-limiter-flexible | @fastify/rate-limit custom store | @fastify/rate-limit is designed for IP-based limiting; custom store is complex. rate-limiter-flexible has native ioredis support and dual-limiter (calls + tokens) as first-class features. Use rate-limiter-flexible for the per-bot logic, @fastify/rate-limit for any IP-level protection. |
| @fastify/jwt | Manual jose jwtVerify in preHandler | Both work. @fastify/jwt adds fastify.authenticate decorator and request.jwtVerify() shorthand which makes route protection cleaner. For Phase 3 verify-only mode, either is fine; @fastify/jwt reduces boilerplate. |
| Vercel AI SDK (ai@6) | Direct OpenAI/Anthropic SDK calls | Direct SDKs require per-provider conditionals and different response shapes. AI SDK provides a unified LanguageModelV1 interface — switching providers is one import change. The tool-calling loop logic (stopWhen, usage tracking) is also provided by the SDK. |
| ai@6 | ai@4 or ai@5 | AI SDK 6 introduced `stopWhen` (replaces `maxSteps`), merged generateObject into generateText, and introduced ToolLoopAgent. Migration is a breaking change. Since this is greenfield for Phase 3, use the current stable (6.x). |
| Local fs artifact store | @google-cloud/storage (GCS) | Local fs is sufficient for Phase 3 success criteria (write_file returns artifactId + path). GCS is the production target. Abstract behind an ArtifactStore interface so Phase 4+ can swap backends without touching the gateway. |
| docker network --internal | --network none (on bots) | `--network none` blocks everything including loopback connections to the host network. The bot needs to reach the Tool Gateway at its container IP. Using a user-defined bridge `bot-internal` pre-created from Phase 2 and attaching the Tool Gateway container to that same network is the correct approach. `--internal` flag on `docker network create` additionally prevents external internet routing (no default gateway) from within the network. |

**Installation:**
```bash
# services/tool-gateway (new service)
pnpm add fastify @fastify/jwt @fastify/rate-limit @sinclair/typebox @fastify/type-provider-typebox \
  @claw/tool-contracts @claw/db @claw/event-schemas \
  ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google \
  rate-limiter-flexible ioredis jose zod

pnpm add -D typescript tsx @types/node vitest

# services/bot-worker (new service, replaces stub-bot for Phase 3)
pnpm add ai @ai-sdk/openai @ai-sdk/anthropic @claw/tool-contracts @claw/event-schemas \
  bullmq ioredis jose zod

pnpm add -D typescript tsx @types/node
```

---

## Architecture Patterns

### Recommended Project Structure

```
claw-army/
├── services/
│   ├── tool-gateway/                    # NEW: Plan 03-01 + 03-02
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   └── tool-invoke.ts      # POST /tool.invoke — main gateway endpoint
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts             # JWT verify preHandler
│   │   │   │   └── rate-limit.ts       # rate-limiter-flexible setup
│   │   │   ├── tools/
│   │   │   │   ├── llm-call.ts         # llm_call tool implementation
│   │   │   │   ├── fetch-url.ts        # fetch_url tool implementation
│   │   │   │   └── write-file.ts       # write_file tool implementation
│   │   │   ├── services/
│   │   │   │   ├── audit-log.ts        # Drizzle insert to tool_invocations table
│   │   │   │   └── allowlist.ts        # allowed_tools lookup from executions table
│   │   │   ├── app.ts
│   │   │   └── main.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── bot-worker/                      # NEW: Plan 03-03 (replaces stub-bot role)
│   │   ├── src/
│   │   │   ├── reasoning-loop.ts       # generateText + tool proxy stubs
│   │   │   ├── tools/
│   │   │   │   └── gateway-proxy.ts    # HTTP stubs that POST to tool gateway
│   │   │   └── main.ts                 # BullMQ Worker + SIGTERM flush
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── execution-service/              # EXISTING from Phase 2
│   │   └── src/
│   │       └── ... (update BOT_IMAGE to point to bot-worker)
│   └── stub-bot/                       # EXISTING (keep for reference, deprecate)
│
└── packages/
    ├── tool-contracts/                 # EXISTING — schemas already defined
    └── db/
        └── src/schema/
            └── tool-invocations.ts    # NEW: audit log table (add to schema)
```

### Pattern 1: Tool Gateway — POST /tool.invoke Route

**What:** A single endpoint that all bots POST to. The request body is one of the three tool contract request shapes. The handler validates JWT, checks allowlist, validates args with Zod, enforces rate limits, dispatches to the tool implementation, logs the invocation, and returns the response.

**When to use:** This is the ONLY external endpoint the Tool Gateway exposes to bots.

**Example:**
```typescript
// services/tool-gateway/src/routes/tool-invoke.ts
// Source: @claw/tool-contracts (existing schemas), @fastify/jwt, rate-limiter-flexible

import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import {
  llmCallRequestSchema,
  fetchUrlRequestSchema,
  writeFileRequestSchema,
  type ToolName,
} from '@claw/tool-contracts';
import { db, executions } from '@claw/db';
import { eq } from 'drizzle-orm';
import { executeLlmCall } from '../tools/llm-call.js';
import { executeFetchUrl } from '../tools/fetch-url.js';
import { executeWriteFile } from '../tools/write-file.js';
import { writeAuditLog } from '../services/audit-log.js';
import { checkRateLimit } from '../middleware/rate-limit.js';

const TOOL_SCHEMAS: Record<string, { parse: (data: unknown) => unknown }> = {
  llm_call: llmCallRequestSchema,
  fetch_url: fetchUrlRequestSchema,
  write_file: writeFileRequestSchema,
};

export const toolInvokeRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post('/tool.invoke', {
    // Fastify-level schema is loose — we do deep validation manually with Zod
    schema: {
      body: Type.Object({
        toolName: Type.String(),
        botId: Type.String(),
        executionId: Type.String(),
        invocationId: Type.String(),
        timestamp: Type.String(),
        args: Type.Unknown(),
      }),
    },
    preHandler: [fastify.authenticate],  // JWT verify
  }, async (request, reply) => {
    const startMs = Date.now();
    const { toolName, botId, executionId } = request.body as {
      toolName: string; botId: string; executionId: string;
    };

    // 1. Allowlist check — read from executions table
    const exec = await db.select({ allowedTools: executions.allowedTools })
      .from(executions).where(eq(executions.id, executionId)).limit(1);
    if (!exec[0] || !exec[0].allowedTools.includes(toolName)) {
      await writeAuditLog({ botId, executionId, toolName, rejected: true, reason: 'not_in_allowlist' });
      return reply.code(403).send({ success: false, error: `Tool ${toolName} not in allowed_tools` });
    }

    // 2. Rate limit check
    const rateLimitResult = await checkRateLimit(botId);
    if (!rateLimitResult.allowed) {
      await writeAuditLog({ botId, executionId, toolName, rejected: true, reason: 'rate_limit_exceeded' });
      return reply.code(429).send({ success: false, error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter });
    }

    // 3. Zod argument validation
    const schema = TOOL_SCHEMAS[toolName];
    if (!schema) {
      return reply.code(400).send({ success: false, error: `Unknown tool: ${toolName}` });
    }
    const parsed = (schema as { safeParse: (d: unknown) => { success: boolean; error?: { issues: unknown[] }; data?: unknown } })
      .safeParse(request.body);
    if (!parsed.success) {
      await writeAuditLog({ botId, executionId, toolName, rejected: true, reason: 'schema_invalid' });
      return reply.code(422).send({ success: false, error: 'Schema validation failed', details: parsed.error?.issues });
    }

    // 4. Dispatch to tool implementation
    let result: unknown;
    try {
      if (toolName === 'llm_call') result = await executeLlmCall(parsed.data as never);
      else if (toolName === 'fetch_url') result = await executeFetchUrl(parsed.data as never);
      else if (toolName === 'write_file') result = await executeWriteFile(parsed.data as never);
    } catch (err) {
      await writeAuditLog({ botId, executionId, toolName, rejected: false, error: (err as Error).message, durationMs: Date.now() - startMs });
      return reply.code(500).send({ success: false, error: (err as Error).message });
    }

    // 5. Audit log successful invocation
    await writeAuditLog({ botId, executionId, toolName, rejected: false, result, durationMs: Date.now() - startMs });

    return reply.code(200).send({ success: true, result, durationMs: Date.now() - startMs });
  });
};
```

### Pattern 2: JWT Auth — @fastify/jwt Verify-Only Mode

**What:** The Tool Gateway only verifies JWTs (never mints them — that's the execution-service's job). `@fastify/jwt` in verify-only mode validates the signature with the shared `BOT_JWT_SECRET`, extracts `botId` and `executionId` from the payload, and makes them available on `request.user`. The `fastify.authenticate` decorator is added as a preHandler on the `/tool.invoke` route.

**Key gotcha:** The JWT is minted with HS256 (`jose`) in the execution-service with a 15-minute expiry. The gateway must use the SAME secret (`BOT_JWT_SECRET` env var) or verification will fail. Do not fall back to a hardcoded dev secret silently in the gateway — fail loudly if the env var is missing.

**Example:**
```typescript
// services/tool-gateway/src/middleware/auth.ts
// Source: https://github.com/fastify/fastify-jwt

import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';

export default fp(async (fastify) => {
  const secret = process.env.BOT_JWT_SECRET;
  if (!secret) throw new Error('[tool-gateway] BOT_JWT_SECRET is required');

  await fastify.register(jwt, {
    secret,
    // verify-only: bots present tokens, gateway only verifies
  });

  fastify.decorate('authenticate', async (request: never, reply: never) => {
    try {
      await (request as { jwtVerify: () => Promise<void> }).jwtVerify();
    } catch (err) {
      (reply as { code: (n: number) => { send: (d: unknown) => void } })
        .code(401).send({ success: false, error: 'Unauthorized' });
    }
  });
});
```

**Type augmentation** is needed for `fastify.authenticate` to be recognized by TypeScript — add a `types.d.ts` or use the standard Fastify type augmentation pattern from the `@fastify/jwt` README.

### Pattern 3: Per-Bot Rate Limiting with rate-limiter-flexible

**What:** Two rate limiters per bot: `calls/min` (tool call count) and `tokens/min` (token consumption). Both use Redis sorted sets or counters. rate-limiter-flexible provides `RateLimiterRedis` which handles the Redis key management, atomic operations, and TTL. The key is `botId` (not IP address).

**When to use:** Called inside the route handler AFTER allowlist check but BEFORE Zod validation (fail fast — don't pay Zod parse cost if rate-limited).

**Example:**
```typescript
// services/tool-gateway/src/middleware/rate-limit.ts
// Source: https://github.com/animir/node-rate-limiter-flexible

import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import Redis from 'ioredis';

const redisClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

// 60 tool calls per bot per minute
const callsLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl:calls',
  points: 60,          // 60 calls
  duration: 60,        // per 60 seconds
});

// 100,000 tokens per bot per minute (conservative default)
const tokensLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl:tokens',
  points: 100_000,
  duration: 60,
});

export async function checkCallRateLimit(botId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    await callsLimiter.consume(botId, 1);
    return { allowed: true };
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      return { allowed: false, retryAfter: Math.ceil(err.msBeforeNext / 1000) };
    }
    throw err;
  }
}

// Called AFTER llm_call returns usage.totalTokens
export async function consumeTokens(botId: string, tokens: number): Promise<void> {
  try {
    await tokensLimiter.consume(botId, tokens);
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      // Token limit exceeded — throw structured error so handler returns 429
      throw Object.assign(new Error('Token rate limit exceeded'), { code: 'TOKEN_RATE_LIMIT', retryAfter: Math.ceil(err.msBeforeNext / 1000) });
    }
    throw err;
  }
}
```

**Important:** For `llm_call`, token counting happens AFTER the call returns (you need the response to know how many tokens were consumed). The check-then-call-then-consume pattern means a single call that exceeds the token limit succeeds but subsequent calls within the window are blocked. This is acceptable and matches how the LLM providers themselves enforce limits. Document this explicitly.

### Pattern 4: Vercel AI SDK generateText Tool-Calling Loop

**What:** The bot worker uses Vercel AI SDK `generateText` with tool definitions that are thin HTTP proxy stubs posting to the Tool Gateway. `stopWhen: stepCountIs(N)` controls the maximum number of iterations. The SDK handles the conversation history accumulation across steps automatically.

**When to use:** The bot's main reasoning loop per task.

**Example:**
```typescript
// services/bot-worker/src/reasoning-loop.ts
// Source: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text

import { generateText, tool, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

const TOOL_GATEWAY_URL = process.env.TOOL_GATEWAY_URL ?? 'http://tool-gateway:3002';
const BOT_JWT = process.env.BOT_JWT ?? '';
const BOT_ID = process.env.BOT_ID ?? '';
const EXECUTION_ID = process.env.EXECUTION_ID ?? '';

// Thin HTTP stub — all enforcement is in the gateway, not here
async function callGateway(toolName: string, args: unknown): Promise<unknown> {
  const response = await fetch(`${TOOL_GATEWAY_URL}/tool.invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BOT_JWT}`,
    },
    body: JSON.stringify({
      toolName,
      botId: BOT_ID,
      executionId: EXECUTION_ID,
      invocationId: randomUUID(),
      timestamp: new Date().toISOString(),
      args,
    }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error ?? 'Tool invocation failed');
  return data.result;
}

export async function runReasoningLoop(taskDescription: string): Promise<string> {
  const { text, steps } = await generateText({
    model: openai('gpt-4o-mini'),  // model from env in production
    system: 'You are a task-execution agent. Use the available tools to complete the task.',
    prompt: taskDescription,
    tools: {
      llm_call: tool({
        description: 'Call an LLM for reasoning or text generation',
        parameters: z.object({
          model: z.string(),
          messages: z.array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string() })),
          maxTokens: z.number().optional(),
        }),
        execute: async (args) => callGateway('llm_call', args),
      }),
      fetch_url: tool({
        description: 'Fetch the content of a URL',
        parameters: z.object({
          url: z.string(),
          method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
          headers: z.record(z.string(), z.string()).optional(),
          body: z.string().optional(),
        }),
        execute: async (args) => callGateway('fetch_url', args),
      }),
      write_file: tool({
        description: 'Write a file to the artifact store',
        parameters: z.object({
          path: z.string(),
          content: z.string(),
          encoding: z.enum(['utf-8', 'base64']).optional(),
        }),
        execute: async (args) => callGateway('write_file', args),
      }),
    },
    stopWhen: stepCountIs(20),     // maximum 20 tool-call iterations
    onStepFinish: ({ stepType, toolCalls }) => {
      console.log(`[bot] Step complete: ${stepType}, tool calls: ${toolCalls.length}`);
    },
  });

  return text;
}
```

**Critical:** The bot-worker's tool definitions are schema mirrors of `@claw/tool-contracts`. The Zod schemas in `parameters` must match exactly what the gateway validates. The tool-contracts package already defines these — import and reuse them rather than redefining.

### Pattern 5: fetch_url Tool with Domain Allowlist

**What:** The gateway's `fetch_url` implementation validates the requested URL's hostname against an allowlist before making the HTTP request. The allowlist is either per-execution (from DB) or a global environment variable list. Response body is truncated at a configurable max size.

**Example:**
```typescript
// services/tool-gateway/src/tools/fetch-url.ts
import type { FetchUrlRequest, FetchUrlResponse } from '@claw/tool-contracts';

// Global domain allowlist — comma-separated env var, or locked per-execution
const DOMAIN_ALLOWLIST = (process.env.FETCH_URL_DOMAIN_ALLOWLIST ?? '')
  .split(',').map(d => d.trim()).filter(Boolean);

const MAX_BODY_BYTES = 1_000_000; // 1 MB truncation limit

export async function executeFetchUrl(req: FetchUrlRequest): Promise<FetchUrlResponse['result']> {
  const url = new URL(req.args.url); // throws on malformed URL

  // Domain allowlist check
  if (DOMAIN_ALLOWLIST.length > 0 && !DOMAIN_ALLOWLIST.includes(url.hostname)) {
    throw new Error(`Domain ${url.hostname} not in fetch_url allowlist`);
  }

  const startMs = Date.now();
  const response = await fetch(req.args.url, {
    method: req.args.method,
    headers: req.args.headers,
    body: req.args.body,
    signal: AbortSignal.timeout(30_000), // 30-second timeout
  });

  const rawBytes = await response.arrayBuffer();
  const truncated = rawBytes.byteLength > MAX_BODY_BYTES;
  const body = Buffer.from(rawBytes.slice(0, MAX_BODY_BYTES)).toString('utf-8');
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => { headers[key] = value; });

  return {
    statusCode: response.status,
    headers,
    body,
    truncated,
  };
}
```

### Pattern 6: llm_call Tool with Vercel AI SDK Multi-Provider Routing

**What:** The gateway's `llm_call` implementation routes to the correct LLM provider based on the `model` field prefix (e.g., `gpt-4o` → OpenAI, `claude-3-5-sonnet` → Anthropic). Returns token counts from `usage` to enable token rate limit consumption.

**Example:**
```typescript
// services/tool-gateway/src/tools/llm-call.ts
// Source: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import type { LlmCallRequest, LlmCallResponse } from '@claw/tool-contracts';
import { LanguageModelV1 } from '@ai-sdk/provider';

function resolveModel(modelId: string): LanguageModelV1 {
  if (modelId.startsWith('gpt-') || modelId.startsWith('o1') || modelId.startsWith('o3')) {
    return openai(modelId);
  }
  if (modelId.startsWith('claude-')) {
    return anthropic(modelId);
  }
  if (modelId.startsWith('gemini-')) {
    return google(modelId);
  }
  // Default: attempt OpenAI (will error at API level if not recognized)
  return openai(modelId);
}

export async function executeLlmCall(req: LlmCallRequest): Promise<LlmCallResponse['result']> {
  const model = resolveModel(req.args.model);

  const result = await generateText({
    model,
    messages: req.args.messages,
    maxOutputTokens: req.args.maxTokens,
    temperature: req.args.temperature,
  });

  return {
    content: result.text,
    model: result.response.modelId,
    promptTokens: result.usage.inputTokens,
    completionTokens: result.usage.outputTokens,
    totalTokens: result.usage.totalTokens,
  };
}
```

**Note:** `result.usage.inputTokens` and `result.usage.outputTokens` are the AI SDK 6 field names. In SDK 4.x they were `promptTokens` / `completionTokens`. Verify against the installed SDK version's TypeScript types at implementation time.

### Pattern 7: write_file Tool with Local Artifact Store

**What:** Phase 3 uses the local filesystem as the artifact store. The implementation writes to a configured `ARTIFACT_ROOT` directory, names files by UUID, and returns the `artifactId` and path. The interface is designed to be swappable with GCS in Phase 4+.

**Example:**
```typescript
// services/tool-gateway/src/tools/write-file.ts
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { WriteFileRequest, WriteFileResponse } from '@claw/tool-contracts';

const ARTIFACT_ROOT = process.env.ARTIFACT_ROOT ?? '/tmp/claw-artifacts';

export async function executeWriteFile(req: WriteFileRequest): Promise<WriteFileResponse['result']> {
  const artifactId = randomUUID();
  const safeBasename = req.args.path.replace(/[^a-zA-Z0-9._-]/g, '_');
  const targetDir = join(ARTIFACT_ROOT, artifactId);
  await mkdir(targetDir, { recursive: true });
  const targetPath = join(targetDir, safeBasename);

  const content = req.args.encoding === 'base64'
    ? Buffer.from(req.args.content, 'base64')
    : req.args.content;

  await writeFile(targetPath, content);
  const sizeBytes = Buffer.byteLength(typeof content === 'string' ? content : content);

  return {
    artifactId,
    path: targetPath,
    sizeBytes,
  };
}
```

**Path traversal guard:** The `safeBasename` replacement strips directory separators. Never use `req.args.path` directly in `join()` without sanitization.

### Pattern 8: Docker Network Isolation

**What:** Bot containers must be blocked from all network egress except to the Tool Gateway. The existing `bot-internal` bridge network from Phase 2 already isolates bots from the host. For local dev, add the Tool Gateway container to the same `bot-internal` network. For complete external block (no internet), create `bot-internal` with `--internal` flag which prevents Docker from adding a default gateway route into the network, blocking all external routing.

**Local dev approach:**
```bash
# Create isolated internal network (no internet egress)
docker network create --internal bot-internal

# Tool Gateway must be attached to bot-internal so bots can reach it
# docker run ... --network bot-internal ... tool-gateway

# Bot containers remain on bot-internal (from Phase 2 spawnBot config)
# HostConfig.NetworkMode: 'bot-internal'
```

**The trade-off:** `--internal` network means the Tool Gateway itself also cannot initiate outbound connections to LLM providers... unless the Tool Gateway is ALSO attached to the external network (default bridge or host). The Tool Gateway needs TWO network attachments: `bot-internal` (to receive bot requests) and the default bridge/external network (to reach LLM APIs). Bot containers get ONLY `bot-internal`.

**Verification command (from within a running bot container):**
```bash
# Should fail if network isolation is correct:
curl --max-time 5 https://api.openai.com/v1/models  # Must be blocked
nslookup api.openai.com                               # DNS should fail or timeout
# Should succeed:
curl http://tool-gateway:3002/health                   # Must work
```

### Anti-Patterns to Avoid

- **Validating tool arguments in the bot, not the gateway:** The bot is untrusted code. Schema validation must happen in the gateway's request handler, before business logic. The bot may send anything.
- **Using `@fastify/rate-limit` alone for token rate limiting:** `@fastify/rate-limit` counts HTTP requests. Token consumption varies per call (an LLM call can consume 1 to 100,000+ tokens). Token limiting requires a custom variable-cost counter — `rate-limiter-flexible`'s `.consume(key, points)` where `points` is the token count is the right primitive.
- **Running tool implementations inside the bot container:** The whole point of the Tool Gateway is the security boundary. If the bot directly calls the LLM or fetches URLs, the allowlist and audit log are bypassed. The bot must ONLY communicate with the gateway.
- **Sharing the same ioredis connection between rate-limiter-flexible and BullMQ workers:** BullMQ workers need `maxRetriesPerRequest: null`. The rate-limiter-flexible connection should be a separate ioredis instance with default settings (fast-fail on rate limit calls is desirable).
- **Letting the Tool Gateway container join ONLY bot-internal:** The Tool Gateway must have external network access to call LLM providers. Attach it to both `bot-internal` (for bot-to-gateway traffic) and the external network (for gateway-to-LLM-API traffic). Only the bot containers are limited to `bot-internal`.
- **Not sanitizing the `path` argument in write_file:** Direct use of `req.args.path` in `node:path` join operations allows path traversal attacks (`../../etc/passwd`). Always sanitize to a basename before constructing the target path.
- **Using the same JWT secret across environments without env var enforcement:** The gateway must fail loudly (process.exit(1)) if `BOT_JWT_SECRET` is not set in production. The Phase 2 jwt.ts has a console.warn fallback — the gateway should not have this fallback.
- **Forgetting `NODE_OPTIONS=--conditions @claw/source` in Dockerfiles:** All services that import `@claw/tool-contracts` or `@claw/db` via workspace packages need this env var to resolve TypeScript source files in the monorepo. The stub-bot Dockerfile already sets this — follow the same pattern for tool-gateway and bot-worker Dockerfiles.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT verification middleware | Manual `Authorization` header parsing + jose call in every handler | `@fastify/jwt` plugin with `fastify.authenticate` preHandler | @fastify/jwt handles Bearer extraction, expiry validation, and plugs into Fastify's hook system cleanly. The alternative has multiple failure modes (missing header, wrong format, expired token) that need custom error responses. |
| Per-bot call + token rate limiting | Custom Redis INCR/EXPIRE scripts | `rate-limiter-flexible` with `RateLimiterRedis` | rate-limiter-flexible uses atomic Lua scripts for Redis operations. Custom INCR+EXPIRE has a race condition between the check and the increment. Also provides variable-cost `.consume(key, points)` for token counting. |
| Multi-provider LLM routing | Per-provider if/else with different SDK clients | Vercel AI SDK `generateText` + provider packages | AI SDK abstracts all provider differences. Switching from OpenAI to Anthropic is one import change. Usage tracking (`result.usage`) is normalized across providers. |
| LLM tool-calling loop | Manual while loop accumulating conversation history | `generateText` with `stopWhen: stepCountIs(N)` | The SDK handles the full step-tool-result-append-repeat cycle. Manual implementation must correctly accumulate assistant + tool messages in the exact format each provider expects — this varies by provider and is a common source of bugs. |
| URL domain allowlist | Custom DNS resolution + blocklist lookup | `new URL(req.args.url).hostname` comparison against allowlist array | The URL constructor handles all edge cases (punycode, IPv6, port stripping). Simple hostname comparison against an env-configured allowlist is more predictable and auditable than dynamic DNS-based approaches. |
| Audit log schema | Ad-hoc JSON in a text column | New `tool_invocations` Drizzle table with typed columns | Structured columns enable queries like "all rejected calls for botId X in the last hour." A text blob makes this impossible without JSON extraction. |

**Key insight:** The Tool Gateway's value is the ENFORCEMENT, not the routing. Don't over-engineer the routing — a simple `if/else` dispatch on `toolName` is fine. Invest engineering effort in making the enforcement (allowlist, schema validation, rate limiting, audit log) bulletproof.

---

## Common Pitfalls

### Pitfall 1: Tool Gateway Cannot Reach LLM Providers if Network Config is Wrong

**What goes wrong:** The Tool Gateway container is attached only to `bot-internal` (to receive bot traffic). The `--internal` flag on that network means no external routing exists. LLM API calls from the gateway timeout.

**Why it happens:** `--internal` prevents ALL external routing from the network, including from the Tool Gateway itself. The intent is to block BOTS, not the gateway.

**How to avoid:** The Tool Gateway container needs dual network attachment: connect it to `bot-internal` (receives bot requests) AND the default bridge / host network (reaches LLM APIs). In docker-compose, this is done by listing both networks under the service's `networks` key. Bot containers get only `bot-internal`.

**Warning signs:** Tool Gateway logs show connection timeout when executing `llm_call`; curl from inside the gateway container to `api.openai.com` fails.

### Pitfall 2: AI SDK 6 Usage Field Names Differ from SDK 4.x

**What goes wrong:** Code written against older SDK 4.x examples uses `result.usage.promptTokens` and `result.usage.completionTokens`. In AI SDK 6, these fields are `result.usage.inputTokens` and `result.usage.outputTokens`. This causes `undefined` token values flowing into the audit log and rate limiter.

**Why it happens:** AI SDK 6 renamed usage fields to align with provider-agnostic terminology.

**How to avoid:** Install `ai@6` and check the TypeScript types on `GenerateTextResult.usage` at implementation time. Do not copy AI SDK examples from before 2025 without verifying field names.

**Warning signs:** Token counts in audit log are 0 or `undefined`; token rate limiter never increments.

### Pitfall 3: Zod v4 `safeParse` on Discriminated Union Needs Union Schema

**What goes wrong:** The gateway tries to validate the request body with a single Zod schema but the body shape varies by `toolName`. Using `llmCallRequestSchema.safeParse()` when `toolName === 'fetch_url'` returns a Zod error because the literal check fails.

**Why it happens:** Each tool contract schema has `toolName: z.literal('llm_call')` etc. Parsing a `fetch_url` body against `llmCallRequestSchema` correctly fails the literal check.

**How to avoid:** Dispatch FIRST on `toolName` (parse it as a plain string), THEN select the correct schema. The schema map in Pattern 1 above handles this correctly. Do NOT create a union schema — dispatching then validating is simpler and gives clearer error messages.

**Warning signs:** All tool invocations return 422 validation errors even with correct args.

### Pitfall 4: Bot JWT Expires During Long-Running Tasks (15-Minute Expiry)

**What goes wrong:** A bot with a 15-minute JWT starts a task that takes 20 minutes. Mid-task, the JWT expires. The next Tool Gateway call returns 401. The bot cannot continue and the task fails.

**Why it happens:** Phase 2 mints JWTs with `setExpirationTime('15m')`. The reasoning loop may run longer.

**How to avoid:** Options: (a) extend JWT expiry to match the execution's `runtimeLimitSeconds` (simplest — up to 24h for long tasks); (b) implement JWT refresh by having the bot call a `/token.refresh` endpoint before expiry; (c) use a short-expiry JWT for auth but a longer-lived session token for rate limiting state. For Phase 3, option (a) is the simplest — set JWT expiry based on `runtimeLimitSeconds` rather than a hardcoded 15 minutes. The risk of token theft within the container network is low enough that longer-lived tokens are acceptable here.

**Warning signs:** Tasks longer than 15 minutes always fail with 401 errors mid-execution; logs show `JWTExpired` errors in the gateway.

### Pitfall 5: fetch_url DNS Resolution Happens AFTER Allowlist Check

**What goes wrong:** The domain allowlist checks `new URL(req.args.url).hostname`. An attacker bot could supply `http://allowed-domain.example.com@malicious.com/path` — the hostname parsed by URL would be `malicious.com` (the authority) but a naive string check might pass `allowed-domain.example.com` (the credential part). This is a URL parsing confusion attack.

**Why it happens:** URLs with embedded credentials can confuse developers who do string matching rather than using the URL constructor.

**How to avoid:** Always parse with `new URL()` and use the `.hostname` property (not `.host`, which includes port). The URL constructor normalizes the URL correctly — `new URL('http://allowed.com@malicious.com').hostname` returns `malicious.com`, which correctly fails the allowlist check if `malicious.com` is not allowed.

**Warning signs:** Security audit reveals bots can reach non-allowlisted domains; manual URL crafting bypasses the check.

### Pitfall 6: rate-limiter-flexible Throws (Not Returns) on Rate Limit Exceeded

**What goes wrong:** Code does `const result = await callsLimiter.consume(botId, 1)` inside a try/catch expecting a return value indicating rejection. When the limit is exceeded, `rate-limiter-flexible` throws a `RateLimiterRes` object, not an Error. Code that checks `if (result.isRejected)` never catches the actual limit breach.

**Why it happens:** rate-limiter-flexible's API design uses throw for rejections (the thrown object is an instance of `RateLimiterRes`, not `Error`).

**How to avoid:** Always wrap `.consume()` in try/catch and check `if (err instanceof RateLimiterRes)` to distinguish rate-limit rejections from actual errors.

**Warning signs:** Rate limit never triggers even under heavy load; or catch-all error handlers treat rate-limit rejections as 500 errors instead of 429.

### Pitfall 7: write_file Path Traversal Without Sanitization

**What goes wrong:** Bot sends `path: "../../etc/cron.d/backdoor"`. Gateway constructs `join(ARTIFACT_ROOT, artifactId, '../../etc/cron.d/backdoor')` which resolves outside the artifact root.

**Why it happens:** `path.join` does not prevent traversal — it resolves `..` normally.

**How to avoid:** Strip all directory separators from `req.args.path` before joining. Use only the basename: `path.basename(req.args.path)`. Alternatively, resolve the full path and assert it starts with `ARTIFACT_ROOT`.

**Warning signs:** Artifacts appear outside the configured `ARTIFACT_ROOT` directory.

---

## Code Examples

Verified patterns from official sources and current codebase analysis:

### Tool Gateway Fastify App Bootstrap

```typescript
// services/tool-gateway/src/app.ts
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import authPlugin from './middleware/auth.js';
import { toolInvokeRoutes } from './routes/tool-invoke.js';

export function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register JWT auth plugin (adds fastify.authenticate)
  app.register(authPlugin);

  // Tool invoke route
  app.register(toolInvokeRoutes);

  // Health check (no auth required — for load balancer/liveness probes)
  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
```

### Bot Worker Main (BullMQ + Reasoning Loop + SIGTERM)

```typescript
// services/bot-worker/src/main.ts
// Pattern follows stub-bot/src/main.ts from Phase 2
import 'dotenv/config';
import { Worker } from 'bullmq';
import { runReasoningLoop } from './reasoning-loop.js';

const BOT_ID = process.env.BOT_ID ?? '';
const EXECUTION_ID = process.env.EXECUTION_ID ?? '';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return { host: parsed.hostname, port: parseInt(parsed.port || '6379'), maxRetriesPerRequest: null as null };
}

const worker = new Worker(
  'claw-tasks',
  async (job) => {
    const { taskId, description } = job.data as { taskId: string; executionId: string; description: string };
    console.log(`[bot-worker] Starting task ${taskId}: ${description}`);
    const result = await runReasoningLoop(description);
    console.log(`[bot-worker] Completed task ${taskId}`);
    return result;
  },
  {
    connection: parseRedisUrl(REDIS_URL),
    lockDuration: 300_000,  // 5 minutes — tasks may take longer than 30s with real LLM
    concurrency: 1,
  },
);

worker.on('error', (err) => console.error('[bot-worker] Worker error:', err));

// SIGTERM: flush in-progress job before exit
process.on('SIGTERM', async () => {
  console.log('[bot-worker] SIGTERM received, draining...');
  await worker.close();
  process.exit(0);
});
```

**Critical:** `lockDuration` must be extended from the Phase 2 stub's 30 seconds to at least 5 minutes (300,000ms) because real LLM calls + multi-step loops can take minutes. BullMQ's lock renewal (built into the Worker processor pattern) handles keeping the lock alive — but the initial `lockDuration` must be long enough for the first renewal to occur.

### Audit Log Table (New Drizzle Schema)

```typescript
// packages/db/src/schema/tool-invocations.ts — NEW
import { pgTable, uuid, varchar, boolean, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { executions } from './executions';
import { bots } from './bots';

export const toolInvocations = pgTable('tool_invocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  executionId: uuid('execution_id').notNull().references(() => executions.id, { onDelete: 'cascade' }),
  botId: uuid('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  toolName: varchar('tool_name', { length: 50 }).notNull(),
  invocationId: uuid('invocation_id').notNull(),
  rejected: boolean('rejected').notNull().default(false),
  rejectionReason: varchar('rejection_reason', { length: 100 }),
  durationMs: integer('duration_ms'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens: integer('total_tokens'),
  requestSummary: jsonb('request_summary'),  // truncated args for audit
  responseSummary: jsonb('response_summary'), // truncated result for audit
  invokedAt: timestamp('invoked_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (t) => [
  index('tool_invocations_execution_id_idx').on(t.executionId),
  index('tool_invocations_bot_id_idx').on(t.botId),
  index('tool_invocations_invoked_at_idx').on(t.invokedAt),
]);
```

### Network Isolation Validation Commands

```bash
# From within a running bot container (for success criteria verification):

# This MUST fail (blocked by network isolation):
curl --max-time 5 https://api.openai.com/v1/models 2>&1 | grep -E "timeout|refused|Network"

# This MUST also fail (DNS blocked on --internal networks):
nslookup api.openai.com 2>&1 | grep -E "timeout|NXDOMAIN|refused"

# This MUST succeed (Tool Gateway reachable on bot-internal):
curl http://tool-gateway:3002/health
# Expected: {"status":"ok"}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `maxSteps` in AI SDK 4.x | `stopWhen: stepCountIs(N)` in AI SDK 6 | AI SDK 6 (2025) | `maxSteps` removed; `stopWhen` is more composable |
| `result.usage.promptTokens` / `completionTokens` | `result.usage.inputTokens` / `outputTokens` in AI SDK 6 | AI SDK 6 (2025) | Field rename; old names undefined in SDK 6 |
| `jsonwebtoken` for JWT | `jose` + `@fastify/jwt` | 2022+ (this project: Phase 2) | jose is async-native, zero-dep |
| Custom Redis INCR for rate limiting | `rate-limiter-flexible` with `RateLimiterRedis` | Long-standing best practice | Atomic Lua scripts eliminate race conditions; variable-cost consume |
| Docker `bridge` network (default) | User-defined bridge + `--internal` flag | Docker best practices | `--internal` prevents external egress from the network namespace |
| `@google-cloud/storage` for all artifact storage | Local `node:fs` (dev) + GCS (prod) behind interface | Standard layered design | Enables Phase 3 testing without GCP credentials |

**Deprecated/outdated:**
- `ai@4.x` and `ai@5.x`: AI SDK 6 has significant API changes. `maxSteps` → `stopWhen`, usage field renames, new `ToolLoopAgent` class. Greenfield Phase 3 code should target SDK 6.
- `bull` npm package: Superseded by `bullmq`. Bot worker continues using BullMQ from Phase 2.
- Phase 2 `stub-bot`: The stub bot image (`claw-stub-bot`) is replaced by `bot-worker` in Phase 3. The execution-service's `BOT_IMAGE` env var should be updated to point to the new bot-worker image.

---

## Open Questions

1. **JWT expiry for long-running tasks**
   - What we know: Phase 2 mints 15-minute JWTs. The execution's `runtimeLimitSeconds` can be up to 24 hours. Tasks using LLM loops can take 10-60+ minutes.
   - What's unclear: Whether to (a) extend JWT expiry to `runtimeLimitSeconds`, (b) implement a refresh mechanism, or (c) mint a new JWT per tool invocation from the execution-service.
   - Recommendation: For Phase 3, extend JWT expiry to match `runtimeLimitSeconds` capped at 24 hours. The security risk within the isolated `bot-internal` network is low. Document as MEDIUM confidence — this is the "Tool Gateway auth patterns and bot JWT rotation strategy" item flagged in prior decisions.

2. **Token rate limit enforcement timing**
   - What we know: For `llm_call`, we don't know the token count until AFTER the API call returns. The check-then-call-then-consume pattern means a single over-limit call succeeds.
   - What's unclear: Whether the success criteria (GATE-04) requires blocking the call that CAUSES the limit to be exceeded, or only subsequent calls.
   - Recommendation: Read success criterion 4 carefully: "A bot that exceeds its per-minute tool-call or token rate limit is blocked mid-invocation; subsequent calls within the same rate window continue to be rejected." This implies the CALL that causes the breach can succeed, but subsequent ones are blocked. The consume-after-return pattern satisfies this. Confirm interpretation with the user in CONTEXT.md.

3. **Artifact store volume in Docker for local dev**
   - What we know: `write_file` writes to `ARTIFACT_ROOT` (e.g., `/tmp/claw-artifacts`). The Tool Gateway is a Docker container.
   - What's unclear: Whether to bind-mount the artifact root from the host (for visibility) or use a Docker volume (for isolation).
   - Recommendation: Use a named Docker volume (`claw-artifacts`) mounted at `/artifacts` in the Tool Gateway container. This avoids host permission issues and works in CI. Add to `docker-compose.dev.yml`.

4. **Which model to use as the bot worker's "meta-model" for task decomposition**
   - What we know: Phase 3 replaces the stub planner with real LLM decomposition. The `planObjective` stub in `planner.service.ts` needs to become an actual LLM call.
   - What's unclear: Whether the planning LLM call happens in the execution-service (pre-spawn, before bots start) or inside each bot's reasoning loop.
   - Recommendation: Move planning into the execution-service's planner.service.ts as an actual `llm_call` via the Tool Gateway (the execution-service would also be a Tool Gateway client), OR simplify by having the execution-service call the LLM directly (not through the gateway). Phase 3 plan 03-03 is "Bot worker reasoning loop" — the intent is that bots do the LLM calls, not the execution-service. Clarify in CONTEXT.md.

5. **`docker network create bot-internal` with `--internal` vs existing pre-created network**
   - What we know: Prior decisions state "bot-internal Docker network pre-created: `docker network create bot-internal`" — but this was done WITHOUT `--internal`. Adding `--internal` to an existing network requires recreating it.
   - What's unclear: Whether the success criteria's "direct HTTP call and DNS query from within a running bot container" tests require `--internal` or just network mode isolation.
   - Recommendation: Recreate `bot-internal` WITH `--internal` for Phase 3: `docker network create --internal bot-internal`. This is a breaking change to the Phase 2 setup but necessary for the Phase 3 network isolation success criterion. Document in the plan.

---

## Sources

### Primary (HIGH confidence)

- https://github.com/fastify/fastify-jwt — @fastify/jwt README, verify-only mode, authenticate decorator pattern
- https://github.com/animir/node-rate-limiter-flexible — rate-limiter-flexible README, RateLimiterRedis, variable-cost consume
- https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text — generateText API, usage fields, stopWhen parameter
- https://ai-sdk.dev/docs/ai-sdk-core/agents — Agent loop control, stopWhen: stepCountIs pattern
- https://docs.docker.com/engine/network/drivers/none/ — none network driver docs
- https://docs.docker.com/reference/cli/docker/network/create/ — --internal flag docs
- Codebase analysis: `/packages/tool-contracts/src/` — all three tool schemas verified in Zod v4
- Codebase analysis: `/services/execution-service/src/orchestrator/jwt.ts` — JWT mint/verify patterns
- Codebase analysis: `/packages/db/src/schema/` — existing tables; tool_invocations table is missing (new)
- npm show results — Verified versions: ai@6.0.90, @ai-sdk/openai@3.0.29, @ai-sdk/anthropic@3.0.45, @ai-sdk/google@3.0.29, @fastify/jwt@10.0.0, @fastify/rate-limit@10.3.0, rate-limiter-flexible@9.1.1, undici@7.22.0

### Secondary (MEDIUM confidence)

- https://vercel.com/blog/ai-sdk-6 — AI SDK 6 release notes, stopWhen, usage field renames
- https://github.com/fastify/fastify-jwt/blob/main/README.md — preHandler authenticate pattern
- https://redis.io/tutorials/howtos/ratelimiting/ — Redis rate limiting patterns (fixed vs sliding window)
- Docker networking community discussions — `--internal` flag behavior with egress blocking

### Tertiary (LOW confidence — validate before acting)

- AI SDK 6 `result.usage.inputTokens` / `outputTokens` field names: Derived from release notes + TypeScript types; verify against installed SDK types at implementation time.
- Docker `--internal` flag blocking DNS within the network: Documented behavior but behavior on Docker Desktop for Mac vs Linux may differ. Verify with the validation commands in the Code Examples section.
- GCP VPC firewall rules for production network isolation (Plan 03-04): Not researched — production GCP deployment is out of Phase 3 scope for local dev verification.

---

## Metadata

**Confidence breakdown:**
- Tool Gateway patterns (Fastify, JWT, Zod, audit log): HIGH — all patterns extend Phase 2 patterns already in codebase
- Rate limiting (rate-limiter-flexible + Redis): HIGH — library API verified, ioredis integration confirmed
- Vercel AI SDK generateText + tools: HIGH for core API; MEDIUM for AI SDK 6-specific field names (verify types at implementation)
- Bot reasoning loop architecture: MEDIUM — the pattern is correct but the model routing, system prompt design, and loop tuning need to be worked out in implementation
- Docker network isolation: MEDIUM — `--internal` flag is documented; local dev vs production behavior needs validation per success criteria
- JWT expiry strategy: MEDIUM — the prior decisions flagged this as MEDIUM confidence; recommendations made but need user input

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days — AI SDK is active development; check for SDK 6.x minor version changes; all other libraries are stable)
