---
phase: 01-submodule-integration
plan: 01
subsystem: infra
tags: [git-submodule, pnpm-workspace, drizzle, migrations, paperclip]

# Dependency graph
requires: []
provides:
  - claw-paper-clip registered as git submodule at paperclip/
  - pnpm workspace spanning both repos; @paperclipai/* packages resolve as workspace members
  - Akasa migration journal isolated to drizzle.__akasa_migrations (safe to run alongside Paperclip)
affects:
  - 01-02 (Paperclip server integration — needs workspace wiring)
  - all subsequent phases importing @paperclipai/* packages

# Tech tracking
tech-stack:
  added:
    - git submodule (claw-paper-clip at 944b35e)
  patterns:
    - pnpm workspace extends across both repos with strictPeerDependencies: false for cross-repo peer conflicts
    - Drizzle migrations.table config for journal isolation in shared Postgres

key-files:
  created:
    - .gitmodules
  modified:
    - pnpm-workspace.yaml
    - package.json
    - packages/db/drizzle.config.ts
    - pnpm-lock.yaml

key-decisions:
  - "Used strictPeerDependencies: false to handle cross-repo zod v3/v4 and drizzle-orm version mismatches between Akasa and Paperclip workspaces"
  - "Akasa migration journal renamed to __akasa_migrations — fresh v6.0 database assumed, no row migration from __drizzle_migrations needed"

patterns-established:
  - "Pattern 1: Paperclip workspace globs — include packages/adapters/*, packages/plugins/*, packages/plugins/examples/* as separate entries since Paperclip's own workspace does the same"
  - "Pattern 2: Root packageManager field overrides nested packageManager declarations from submodule to prevent corepack enforcement errors"

requirements-completed: [SUB-01, SUB-02, SUB-03]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 01 Plan 01: Submodule Registration and Workspace Wiring Summary

**claw-paper-clip registered as git submodule at paperclip/, pnpm workspace extended to resolve @paperclipai/* packages, and Akasa migration journal isolated to drizzle.__akasa_migrations**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-23T10:22:15Z
- **Completed:** 2026-03-23T10:24:12Z
- **Tasks:** 2
- **Files modified:** 4 (+ pnpm-lock.yaml)

## Accomplishments
- Git submodule `paperclip/` registered and cloned at commit 944b35e (heads/master of claw-paper-clip)
- pnpm workspace expanded with 6 new Paperclip package globs; `pnpm install` completes without errors
- `@paperclipai/db` and `@paperclipai/shared` resolve as workspace packages (`pnpm ls` confirmed)
- Akasa's Drizzle migration journal renamed from default `__drizzle_migrations` to `__akasa_migrations` — no collision with Paperclip's journal when both run against same Postgres

## Task Commits

Each task was committed atomically:

1. **Task 1: Add git submodule and extend pnpm workspace** - `a273f9b` (chore)
2. **Task 2: Isolate Akasa migration journal table** - `d3264c8` (chore)

## Files Created/Modified
- `.gitmodules` — Git submodule registration for paperclip/ at tarikstafford/claw-paper-clip
- `pnpm-workspace.yaml` — Extended with 6 Paperclip package globs + `strictPeerDependencies: false`
- `package.json` — Added `"packageManager": "pnpm@10.11.1"` to override submodule's pnpm@9.15.4 declaration
- `packages/db/drizzle.config.ts` — Added `migrations: { table: '__akasa_migrations', schema: 'drizzle' }`
- `pnpm-lock.yaml` — Regenerated to include all Paperclip workspace packages

## Decisions Made
- **strictPeerDependencies: false**: Paperclip's server uses `better-call` (requires zod@^4) and `better-auth` (requires drizzle-orm@>=0.41.0), while Paperclip's packages use zod@3.25.76 and drizzle-orm@0.38.4. These are Paperclip's own internal version mismatches — not ours to fix. Suppressing enforces a correct install without blocking the workspace.
- **__akasa_migrations**: Drizzle's default `__drizzle_migrations` table is used by Paperclip's own DB migrations. Using the same table name on the same Postgres database would corrupt both journals. Renaming Akasa's table to `__akasa_migrations` is the cleanest isolation with no downstream migration impact since v6.0 starts fresh.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added strictPeerDependencies: false to fix pnpm install failure**
- **Found during:** Task 1 (pnpm install after workspace extension)
- **Issue:** pnpm install exited with `ERR_PNPM_PEER_DEP_ISSUES` — Paperclip's `better-call` requires `zod@^4` but Paperclip provides `zod@3.25.76`; `better-auth` requires `drizzle-orm@>=0.41.0` but Paperclip provides `0.38.4`. These are cross-repo version mismatches in Paperclip's own dependencies that we cannot resolve.
- **Fix:** Added `strictPeerDependencies: false` to `pnpm-workspace.yaml` root config (exactly as suggested in the pnpm error output). pnpm install then completed successfully.
- **Files modified:** `pnpm-workspace.yaml`
- **Verification:** `pnpm install` exits 0, `@paperclipai/db` and `@paperclipai/shared` resolve as workspace packages
- **Committed in:** a273f9b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug/blocking install)
**Impact on plan:** Auto-fix necessary to complete the task. `strictPeerDependencies: false` is the correct pnpm mechanism for cross-repo workspace peer conflicts. No scope creep.

## Issues Encountered
- Paperclip's `plugin-sdk` package has no `dist/` directory (not built), causing WARN messages about missing `paperclip-plugin-dev-server` bin symlinks. These are non-blocking warnings for dev tooling only — pnpm install still succeeds and workspace packages resolve correctly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Submodule and workspace wiring complete — Plan 02 can now import from `@paperclipai/*` packages
- `packages/db/drizzle.config.ts` uses isolated migration table — ready for migration runs
- Paperclip plugin-sdk's missing `dist/` may cause issues if Paperclip's dev server tooling is needed in a future phase

## Self-Check: PASSED

- `.planning/phases/01-submodule-integration/01-01-SUMMARY.md` — FOUND
- `.gitmodules` — FOUND
- Commit `a273f9b` (Task 1) — FOUND
- Commit `d3264c8` (Task 2) — FOUND

---
*Phase: 01-submodule-integration*
*Completed: 2026-03-23*
