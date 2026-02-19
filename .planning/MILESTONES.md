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

## v1.1 Google Auth Gate (Shipped: 2026-02-19)

**Phases completed:** 1 phase (Phase 7), 6 plans
**Timeline:** 1 day (2026-02-19)
**Code shipped:** +5,613 / -223 lines across 54 files

**Delivered:** Google OAuth authentication gate — unauthenticated users are redirected to /login, authenticated users access /new-execution with session tokens forwarded to the backend, and POST /executions enforces 401 without a valid Auth.js session.

**Key accomplishments:**
- Migrated SvelteKit from adapter-static → adapter-vercel, enabling server-side hooks and load functions required by Auth.js
- Backend 401 enforcement on POST /executions via HKDF key derivation + JWE (jose compactDecrypt) for Auth.js v5 session token verification
- Auth.js Google OAuth core setup — hooks.server.ts intercepts /auth/* routes, App.Locals.auth() typed globally across all server files
- /login page with dark-themed card + Google OAuth button; authenticated nav shows user avatar, name, and Sign Out
- /new-execution auth guard + server action that reads the httpOnly session cookie and forwards it as Authorization: Bearer to execution-service
- All 8 Google Auth Gate flows human-verified end-to-end: redirect, login page, Google OAuth, post-auth redirect, authenticated nav, sign-out, form submission, backend 401

**Archive:**
- `.planning/milestones/v1.1-ROADMAP.md` — full phase details

---

