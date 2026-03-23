# Phase 1: Submodule Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 01-submodule-integration
**Areas discussed:** Submodule placement & workspace wiring, Database unification strategy, Express server mounting, Dev command orchestration

---

## Submodule Placement & Workspace Wiring

### Q1: Where should claw-paper-clip live in the directory tree?

| Option | Description | Selected |
|--------|-------------|----------|
| vendor/paperclip | Vendor convention — signals 'external dependency, don't edit'. Clean separation | |
| paperclip/ (root level) | Flat and simple. Risk: could look like owned code | ✓ |
| packages/paperclip | Sits alongside workspace packages. pnpm auto-discovers it | |

**User's choice:** paperclip/ (root level)
**Notes:** None

### Q2: How should Paperclip's internal packages be exposed to Akasa code?

| Option | Description | Selected |
|--------|-------------|----------|
| pnpm workspace glob | Add 'paperclip/packages/*' to pnpm-workspace.yaml. Direct workspace resolution | ✓ |
| Explicit workspace references | List specific packages in package.json with workspace: protocol | |

**User's choice:** pnpm workspace glob
**Notes:** None

### Q3: Should Akasa's existing @claw/* packages be renamed?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep @claw/* | No churn — both @claw/* and @paperclipai/* coexist | ✓ |
| Rename to @akasa/* | Brand alignment but large churn | |

**User's choice:** Keep @claw/*
**Notes:** None

---

## Database Unification Strategy

### Q1: How should tables coexist in one Postgres database?

| Option | Description | Selected |
|--------|-------------|----------|
| Single schema, separate migration dirs | Both use 'public' schema. Separate migration dirs | ✓ |
| Separate Postgres schemas | Paperclip in 'paperclip' schema, Akasa in 'public'. Cross-schema JOINs needed | |
| Shared Drizzle schema | Import Paperclip's tables into @claw/db. One migration system | |

**User's choice:** Single schema, separate migration dirs
**Notes:** None

### Q2: Who owns the database connection at runtime?

| Option | Description | Selected |
|--------|-------------|----------|
| Paperclip owns it | Express server creates the pool. Akasa routes receive via app context | ✓ |
| Each creates its own pool | Independent connections, simpler setup, doubled connections | |
| Shared connection module | New @claw/connection package | |

**User's choice:** Paperclip owns it
**Notes:** None

### Q3: Foreign key strategy between repos?

| Option | Description | Selected |
|--------|-------------|----------|
| Logical FKs | Plain ID columns, no references() constraints. Matches existing pattern | ✓ |
| Real foreign keys | DB-enforced referential integrity. Requires careful migration ordering | |

**User's choice:** Logical FKs
**Notes:** None

---

## Express Server Mounting

### Q1: How should Akasa routes mount onto Paperclip's Express server?

| Option | Description | Selected |
|--------|-------------|----------|
| Plugin/extension hook | Paperclip exposes app.use() extension point. Akasa registers a router | ✓ |
| Direct app import | Akasa imports Express app instance directly | |
| Middleware injection via config | Config file listing middleware modules to mount | |

**User's choice:** Plugin/extension hook
**Notes:** None

### Q2: What route namespace for Akasa's evolution routes?

| Option | Description | Selected |
|--------|-------------|----------|
| /api/akasa/* | Clear brand separation from Paperclip's /api/v1/* | ✓ |
| /api/evolution/* | Descriptive but narrow | |
| Mixed into /api/v1/* | Blends with Paperclip's API | |

**User's choice:** /api/akasa/*
**Notes:** None

### Q3: Keep Fastify execution-service or replace?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace fully | Paperclip Express is THE backend. One process | ✓ |
| Keep both temporarily | Parallel backends for gradual migration | |
| You decide | Claude's discretion | |

**User's choice:** Replace fully
**Notes:** None

---

## Dev Command Orchestration

### Q1: How should `pnpm dev` start both services?

| Option | Description | Selected |
|--------|-------------|----------|
| pnpm --parallel --filter | Native pnpm, no extra dependency | ✓ |
| Turbo (turborepo) | Task orchestration with caching. Heavier setup | |
| concurrently package | Simple process runner. Extra dependency | |

**User's choice:** pnpm --parallel --filter
**Notes:** None

### Q2: Should `pnpm dev` also start Docker infra?

| Option | Description | Selected |
|--------|-------------|----------|
| No, keep separate | Users run docker compose first. Matches existing workflow | ✓ |
| Yes, include docker compose | One command for everything. Slower restart cycle | |

**User's choice:** No, keep separate
**Notes:** None

---

## Claude's Discretion

- pnpm workspace glob syntax and .npmrc adjustments
- Migration conflict detection approach
- How Paperclip's DB pool is exposed for Akasa consumption
- Whether @claw/source condition extends to Paperclip packages

## Deferred Ideas

None — discussion stayed within phase scope
