# Stack Research

**Domain:** AI Multi-Agent Bot Orchestration Platform
**Researched:** 2026-02-18
**Confidence:** MEDIUM-HIGH (core stack HIGH; GCP service choice MEDIUM; some version numbers from npm searches, not Context7)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS | Runtime | LTS with long support window; Fastify v5 requires ≥20; 22 gives native fetch, performance improvements, and is current LTS as of 2025 |
| TypeScript | 5.x (≥5.4) | Type safety | Required by all major libraries (Fastify, Drizzle, AI SDK); enables strict mode for complex orchestration logic |
| Fastify | 5.7.x | HTTP API server | 2-3x faster than Express; native TypeScript; built-in JSON schema validation that maps directly to Zod; plugin ecosystem for SSE + WebSocket; required for Tool Gateway throughput |
| BullMQ | 5.69.x | Task queue + worker orchestration | De facto Node.js queue in 2025; built on Redis; supports leasing (claiming), delayed jobs, priority, retries, rate-limiting; exactly what the bot task claim model needs |
| Redis (via GCP Memorystore) | 7.x | BullMQ backing store | BullMQ requires Redis ≥7 for optimal operation; Memorystore is fully managed on GCP; must set `maxmemory-policy: noeviction` |
| Drizzle ORM | 0.45.x (stable) | Database access | Lightweight (7kb, zero deps), SQL-first, TypeScript-native type inference; migration-safe with drizzle-kit; faster cold-start than Prisma; better fit for serverless-adjacent Cloud Run |
| PostgreSQL (via Cloud SQL) | 15 | Structured data storage | Relational model fits execution/bot/task/trace schema; Cloud SQL is managed GCP; supports JSONB for flexible trace payloads; far easier to query for reports than Firestore |
| Vercel AI SDK | ai@5.x, @ai-sdk/anthropic@3.x, @ai-sdk/openai@3.x | Multi-provider LLM routing | Unified TypeScript API across 25+ providers; released AI SDK 5 July 2025 with major architectural changes; native Node.js support (not Vercel-only); handles streaming, tool calling, provider fallback |
| dockerode | 4.0.9 | Docker container management from Node.js | Only maintained Node.js Docker Remote API client; supports HostConfig resource limits (Memory, NanoCpus); streams for container logs; used for spawning bot worker containers locally or against a Docker daemon |
| Svelte 5 + SvelteKit 2 | svelte@5.x, @sveltejs/kit@2.x | Frontend command center | Svelte 5 stable since Oct 2024 with Runes reactivity; SvelteKit 2 has native SSE support; smallest bundle size of any component framework; reactive enough for live dashboard updates without heavy state management overhead |
| Zod | 4.x | Schema validation | TypeScript-first; zero deps; validates Tool Gateway requests at the edge before they hit business logic; integrates with Fastify's schema system |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fastify/sse` | latest | Server-Sent Events | Live execution feed from API to frontend; one-way streaming fits the use case (server pushes bot events, no client-to-server SSE needed) |
| `@fastify/websocket` | latest | WebSocket (optional upgrade) | If bidirectional real-time control (pause/stop execution) is needed from the UI; use SSE first, add WebSocket only if needed |
| `@fastify/cors` | latest | CORS | SvelteKit frontend on a different origin needs CORS headers on API |
| `@fastify/rate-limit` | latest | Rate limiting | Protect Tool Gateway `/tool.invoke` endpoint from bot thrashing |
| `ioredis` | 5.x | Redis client | BullMQ's internal dependency; also used directly for pub/sub events (broadcasting bot events to SSE connections) |
| `drizzle-kit` | 0.28.x | Database migrations | Generate and apply SQL migrations from Drizzle schema definitions |
| `pg` (node-postgres) | 8.x | PostgreSQL driver for Drizzle | Drizzle requires a driver; pg is the standard, battle-tested PostgreSQL driver for Node.js |
| `@opentelemetry/sdk-node` | 0.x | Structured tracing | OpenTelemetry is the 2025 standard for AI agent observability; captures traces per bot step (tool calls, LLM calls, durations, tokens); exports to Cloud Trace or any OTLP backend |
| `@opentelemetry/api` | 1.x | OTel instrumentation API | Instrument custom spans for bot execution steps without coupling to SDK |
| `winston` or `pino` | latest | Structured logging | Fastify has built-in pino logging; use pino for consistent structured JSON logs across all services; ships to Cloud Logging automatically on GCP |
| `vitest` | 2.x | Testing | Fast, native TypeScript, compatible with Node.js ESM; replaces Jest for modern stacks |
| `dotenv` / `@google-cloud/secret-manager` | latest | Secret management | Local: dotenv; GCP production: Secret Manager for API keys (Anthropic, OpenAI); never environment variables for production secrets |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `tsx` | TypeScript execution for dev | Run TypeScript directly without build step during development; replaces `ts-node` (deprecated pattern) |
| `eslint` + `@typescript-eslint` | Linting | Catch type errors and unsafe patterns; configure with strict TypeScript rules |
| `prettier` | Formatting | Auto-format; add Svelte plugin (`prettier-plugin-svelte`) for frontend consistency |
| `drizzle-kit` CLI | Schema management | `drizzle-kit generate` + `drizzle-kit migrate` for schema changes |
| Docker + Docker Compose | Local development | Run Redis, PostgreSQL, and bot worker containers locally; mirrors GCP production topology |
| gcloud CLI | GCP deployment | Deploy Cloud Run jobs, manage Memorystore, Cloud SQL; use `gcloud run jobs create` for bot workers |

---

## Installation

```bash
# Core API server
npm install fastify @fastify/cors @fastify/rate-limit @fastify/sse @fastify/websocket

# Task queue
npm install bullmq ioredis

# Database
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg

# LLM routing
npm install ai @ai-sdk/anthropic @ai-sdk/openai

# Container management
npm install dockerode
npm install -D @types/dockerode

# Schema validation
npm install zod

# Observability
npm install @opentelemetry/sdk-node @opentelemetry/api pino

# Dev dependencies
npm install -D typescript tsx vitest @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint prettier
```

```bash
# Frontend (separate workspace or monorepo package)
npm create svelte@latest frontend
# Select: SvelteKit, TypeScript, strict mode
cd frontend
npm install
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Fastify | Express | Never for this use case. Express is unmaintained relative to Fastify for new projects; Tool Gateway needs throughput |
| Fastify | NestJS | If team has strong NestJS background AND the added abstraction complexity is worth it; NestJS adds significant overhead for a focused platform like this |
| BullMQ | GCP Cloud Tasks | If you want zero infrastructure management and accept weaker job semantics; Cloud Tasks lacks job progress tracking, worker metrics, and the lease/claim model needed for bot task assignment |
| BullMQ | Temporal | If workflows become complex DAGs requiring durable execution across multi-day timescales; massive overkill for MVP parallelizable-tasks-only model |
| Drizzle ORM | Prisma 7 | If team prefers schema-file approach over TypeScript schema definitions; Prisma 7 dropped its Rust engine so performance gap closed, but Drizzle's zero-dep bundle is still lighter for Cloud Run cold starts |
| Vercel AI SDK | Direct provider SDKs | If only one provider is ever needed; the unified abstraction is worth the thin overhead for multi-provider routing |
| Vercel AI SDK | LiteLLM proxy | If you need a language-agnostic proxy and Python team is involved; LiteLLM adds a network hop and separate service to maintain |
| Cloud SQL (PostgreSQL) | Firestore | If data is truly document-oriented with no relational queries; Claw Army has complex joins (execution → bots → tasks → traces) that relational DB handles cleanly |
| Cloud SQL (PostgreSQL) | TimescaleDB | If telemetry volume exceeds ~5000 data points/sec; TimescaleDB extension on Cloud SQL is available but adds complexity; use plain PostgreSQL for MVP, evaluate TimescaleDB when query performance degrades |
| Svelte 5 + SvelteKit 2 | React + Next.js | If team has zero Svelte experience; React is acceptable but Next.js is overkill for a single-tenant internal tool; SvelteKit 2's native SSE and smaller bundle are genuine wins for this dashboard |
| SSE (`@fastify/sse`) | WebSocket | If UI needs to send real-time commands back to server bidirectionally; for a read-heavy live feed, SSE is simpler, works over HTTP/2, and doesn't need upgrade negotiation |
| dockerode | Native `child_process.spawn docker run` | If you need only basic container spawning without resource monitoring or streaming logs; dockerode's resource limit and stream APIs are worth the dependency |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `bull` (original Bull.js) | Predecessor to BullMQ; no longer actively developed; BullMQ v5 is the maintained successor | `bullmq` |
| `node-docker-api` | Beta status, sparse maintenance; uses the same modem as dockerode but less active | `dockerode` |
| `kue` | Deprecated; based on an older Redis approach; no active development | `bullmq` |
| Prisma 1-6 | Old Rust-engine Prisma with notoriously slow cold starts; acceptable only after Prisma 7 | Wait for Prisma 7 GA, or use Drizzle now |
| `axios` for internal service calls | Adds bloat when Node.js has native `fetch`; only use if you need interceptors extensively | Native `fetch` (Node.js 22) |
| GKE Standard or Autopilot for MVP | Kubernetes management overhead is unjustified for single-tenant MVP; Cloud Run Jobs achieves the isolation requirement with much less ops burden | GCP Cloud Run Jobs for bot workers |
| Kafka or RabbitMQ | Enterprise message bus overkill for this scale; BullMQ + Redis handles the task queue + pub/sub needs entirely | `bullmq` + `ioredis` pub/sub |
| Firebase/Firestore | Document model is a poor fit for structured execution traces and relational reporting queries; no JSONB, complex joins are awkward | Cloud SQL (PostgreSQL) |
| Socket.io | Heavyweight abstraction with polling fallback overhead; adds protocol complexity unnecessarily when native SSE and WebSocket work cleanly with Fastify plugins | `@fastify/sse` + `@fastify/websocket` |
| `ts-node` | Slow startup in 2025; replaced by `tsx` which uses esbuild and starts instantly | `tsx` |

---

## Stack Patterns by Variant

**For bot worker containers (the isolated workers themselves):**
- Use a minimal Node.js Docker image: `node:22-alpine`
- Install only the bot agent code + `@anthropic-ai/sdk` (or Vercel AI SDK)
- No Redis, no Drizzle — bot communicates only via Tool Gateway HTTP
- Enforce `--network=none` at container creation with dockerode, then attach only a custom bridge network pointing to Tool Gateway
- Set HostConfig: `Memory: 512MB`, `NanoCpus: 1_000_000_000` (1 CPU) as baseline limits

**For the Tool Gateway service:**
- Separate Fastify app (could be same process on different port, or separate Cloud Run service)
- Receives all bot tool calls at `POST /tool.invoke`
- Validates against Zod schemas before any downstream execution
- Rate limiting via `@fastify/rate-limit` keyed by `bot_id`
- Logs all calls to PostgreSQL audit table via Drizzle

**For real-time SSE event feed:**
- Orchestrator publishes bot events to Redis pub/sub channel (`execution:{id}:events`) via ioredis
- Fastify SSE endpoint subscribes to that channel and streams to browser
- Pattern: one Redis subscriber per active execution, cleaned up on SSE disconnect
- Avoid subscribing inside each HTTP connection handler — use a shared subscriber and fan out in-process

**For DNA storage:**
- Store in PostgreSQL as JSONB column in a `bot_dna` table
- Include: `system_prompt`, `tool_call_sequence` (array), `argument_patterns` (JSONB), `retry_strategy`, `timing_distribution`
- Tag by `objective_category`, `execution_id`, `bot_score`
- PII-redaction step runs synchronously before insert (regex + pattern matching on prompts/outputs)

**For GCP deployment architecture (MVP):**
- Control Plane API: Cloud Run (service, always-on, min-instances=1)
- Tool Gateway: Cloud Run (service, same or adjacent)
- Bot Workers: Spawned as Cloud Run Jobs (one job execution = one bot) OR dockerode against a GCP VM with Docker daemon
- Note: Cloud Run Jobs cannot be spawned mid-execution by another Cloud Run service via direct Docker socket — use the GCP Jobs API (`@google-cloud/run` client) to trigger job executions, OR run a persistent GCE VM as the "bot host" and use dockerode to manage containers on it directly
- Redis: Cloud Memorystore for Redis (set `maxmemory-policy: noeviction`)
- Database: Cloud SQL for PostgreSQL (private IP, same VPC as Cloud Run)
- Secrets: Secret Manager (Anthropic/OpenAI API keys)

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `bullmq@5.x` | `ioredis@5.x` | BullMQ bundles ioredis internally; if you use ioredis directly for pub/sub, match major version to avoid dual instances |
| `drizzle-orm@0.45.x` | `drizzle-kit@0.28.x` | These must be kept in sync; drizzle-kit generates migrations for the ORM version |
| `ai@5.x` | `@ai-sdk/anthropic@3.x`, `@ai-sdk/openai@3.x` | AI SDK 5 is a breaking change from SDK 4; provider packages must be on the 3.x branch matching SDK 5 |
| Fastify 5.x | Node.js ≥20 | Fastify v5 dropped Node.js 18 support; use Node.js 22 LTS |
| `@opentelemetry/sdk-node` | `@opentelemetry/api@1.x` | API must be 1.x for compatibility across all OTel packages; do not mix major versions |
| Svelte 5 | SvelteKit 2.x | Svelte 5 Runes require SvelteKit 2.12+ for `$app/state`; use latest SvelteKit 2.x |

---

## GCP Service Decision: Cloud Run Jobs vs dockerode on GCE

This is a **critical architectural fork** that the roadmap must resolve in Phase 1.

**Option A: GCP Cloud Run Jobs (recommended for MVP)**
- Each bot = one Cloud Run Job execution
- Triggered via `@google-cloud/run` Node.js client from the Control Plane
- Network isolation: VPC Direct Egress with egress set to `private-ranges-only`; Tool Gateway is the only reachable service
- Pros: fully managed, auto-scales, no VM to maintain, per-second billing
- Cons: cold start (~1-3s), cannot use dockerode directly (no Docker daemon access), container creation is API-driven not socket-driven
- MEDIUM confidence: verify Cloud Run Jobs can be triggered with sufficient frequency for 10+ concurrent bots without quota issues

**Option B: dockerode on a persistent GCE VM**
- Control Plane connects to Docker daemon on a GCE instance via TCP or Unix socket
- dockerode spawns/monitors containers directly
- Network isolation: custom Docker bridge network, only Tool Gateway gateway is on the network
- Pros: full Docker API control, faster container start, resource limits via HostConfig
- Cons: VM management overhead, single point of failure unless multi-VM, more ops complexity
- HIGH confidence: this pattern is well-established for bot-host architectures

**Recommendation:** Start with Option B (dockerode on GCE) for MVP. Reason: the bot task claim-and-execute loop requires rapid container lifecycle management (spawn, monitor, kill on idle, reassign on failure) that is easier to control via direct Docker API than Cloud Run Jobs API latency. Cloud Run Jobs is better suited for scheduled/batch jobs, not tight orchestration loops. Evaluate Cloud Run Jobs as a migration target post-MVP when scale demands it.

---

## Sources

- BullMQ npm: https://www.npmjs.com/package/bullmq — version 5.69.x confirmed current; MEDIUM confidence (npm search, not Context7)
- BullMQ docs: https://docs.bullmq.io — Redis requirements, connection patterns, production config
- dockerode GitHub: https://github.com/apocas/dockerode — version 4.0.9 confirmed from releases page; HIGH confidence
- Vercel AI SDK blog: https://vercel.com/blog/ai-sdk-5 — AI SDK 5 released July 31, 2025; HIGH confidence
- AI SDK docs: https://ai-sdk.dev/docs/introduction — multi-provider pattern, Node.js support
- @ai-sdk/anthropic, @ai-sdk/openai npm versions: 3.0.44 and 3.0.29 — MEDIUM confidence (npm search)
- Fastify npm: version 5.7.4 current — MEDIUM confidence (npm search); Fastify v5 officially released per OpenJS Foundation
- drizzle-orm npm: 0.45.x stable — MEDIUM confidence (npm search)
- GCP Cloud Run Jobs: https://cloud.google.com/run/docs/create-jobs — Node.js quickstart confirmed
- GCP Cloud Run vs GKE: https://cloud.google.com/blog/products/containers-kubernetes/when-to-use-google-kubernetes-engine-vs-cloud-run-for-containers
- GCP Memorystore: https://cloud.google.com/memorystore — managed Redis on GCP
- GCP VPC/Cloud Run isolation: https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc
- SvelteKit SSE: https://github.com/razshare/sveltekit-sse; https://medium.com/version-1/sse-in-sveltekit-5c085b3b61d1
- Svelte 5 release: https://svelte.dev/blog/svelte-5-is-alive — stable October 2024
- Drizzle vs Prisma: https://www.bytebase.com/blog/drizzle-vs-prisma/ — MEDIUM confidence (community article)
- OpenTelemetry AI agents: https://opentelemetry.io/blog/2025/ai-agent-observability/ — HIGH confidence (official OTel blog)
- LLM gateway comparison: https://www.helicone.ai/blog/top-llm-gateways-comparison-2025 — LOW confidence (vendor blog)
- PostgreSQL vs TimescaleDB: https://pgbench.com/comparisons/postgres-vs-timescaledb/ — MEDIUM confidence

---

*Stack research for: Claw Bot Army — AI Multi-Agent Orchestration Platform*
*Researched: 2026-02-18*
