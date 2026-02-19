# Milestones

## v1.0 MVP (Shipped: 2026-02-19)

**Phases completed:** 6 phases, 23 plans
**Timeline:** 2 days (2026-02-18 → 2026-02-19)
**Code shipped:** ~10,220 LOC (8,362 TypeScript + 1,858 Svelte), 216 files

**Delivered:** A fully operational bot fleet platform — deploy AI workers against an objective, watch them run in real-time, enforce budget/guardrails atomically, score every bot's performance, capture elite DNA, and review everything in a Svelte UI.

**Key accomplishments:**
- pnpm monorepo with Drizzle ORM, 6-table PostgreSQL schema, Zod v4 shared-types/event-schemas/tool-contracts packages, and GCP Terraform infrastructure
- Docker internal network isolation — bot containers blocked from all external TCP/DNS with exclusive Tool Gateway access, verified by automated egress test
- Full execution pipeline — POST /executions through lease-based BullMQ task claiming, stub-bot Docker workers, and E2E test covering all 5 Phase 2 success criteria
- Tool Gateway with complete security boundary — JWT auth, per-execution tool allowlist, Zod schema validation, per-bot rate limiting (tools/min, tokens/min), per-invocation audit logging
- Atomic Redis Lua budget enforcement + Guardrail Watchdog (rate/loop detection, bot revocation via deny-list) + Billing Engine (bot-hours, cost estimation, Pub/Sub event sourcing)
- Composite performance scoring (Success 40% + Efficiency 30% + Cost 20% + Stability 10%), elite bot DNA capture (PII-safe structural patterns, versioned JSONB), and Svelte 5 frontend with 6 screens (deploy, live monitoring, post-run dashboard, bot detail, billing)

**Archive:**
- `.planning/milestones/v1.0-ROADMAP.md` — full phase details
- `.planning/milestones/v1.0-REQUIREMENTS.md` — all 51 requirements with outcomes

---
