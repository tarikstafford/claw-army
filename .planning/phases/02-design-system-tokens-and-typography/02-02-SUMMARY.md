---
phase: 02-design-system-tokens-and-typography
plan: 02
subsystem: ui
tags: [design-system, css-tokens, migration, lint]
dependency_graph:
  requires: [02-01]
  provides: [DS-01, DS-02, DS-04, DS-05, DS-06, DS-07]
  affects:
    - services/ui/src/routes/(app)/dashboard/+page.svelte
    - services/ui/src/routes/(app)/objectives/new/+page.svelte
    - services/ui/src/routes/(app)/new-execution/+page.svelte
    - services/ui/src/routes/(app)/negative-signals/+page.svelte
    - services/ui/src/routes/(app)/souls/[id]/+page.svelte
    - services/ui/src/routes/(app)/executions/[id]/bots/[botId]/+page.svelte
    - services/ui/src/routes/(app)/executions/[id]/report/+page.svelte
    - services/ui/src/routes/(app)/executions/[id]/pre-flight/+page.svelte
    - services/ui/src/routes/(app)/executions/[id]/+page.svelte
    - services/ui/src/routes/(app)/category-benchmarks/+page.svelte
    - services/ui/src/routes/(app)/souls/+page.svelte
    - services/ui/src/routes/(app)/guide/+page.svelte
    - services/ui/src/routes/(app)/billing/+page.svelte
    - services/ui/src/routes/(app)/verdicts/+page.svelte
    - services/ui/src/routes/(app)/objectives/+page.svelte
    - services/ui/src/routes/(app)/+layout.svelte
    - services/ui/src/routes/(marketing)/+layout.svelte
    - services/ui/src/routes/(marketing)/login/+page.svelte
    - services/ui/src/routes/(marketing)/+page.svelte
    - services/ui/src/routes/(app)/verdicts/[verdictId]/+page.svelte
    - services/ui/src/routes/(app)/objectives/[id]/+page.svelte
    - services/ui/src/routes/(app)/admin/+page.svelte
    - services/ui/src/lib/components/SoulInspectorPanel.svelte
    - services/ui/src/lib/components/SoulTierBadge.svelte
    - services/ui/src/lib/components/VerdictConfirmPanel.svelte
    - package.json
tech_stack:
  added: []
  patterns:
    - "lint:tokens grep script banning all v5 token names"
    - "Bulk find-and-replace Python script for token migration"
key_files:
  created: []
  modified:
    - services/ui/src/routes/(app)/dashboard/+page.svelte
    - services/ui/src/routes/(app)/objectives/new/+page.svelte
    - services/ui/src/routes/(app)/new-execution/+page.svelte
    - services/ui/src/routes/(app)/negative-signals/+page.svelte
    - services/ui/src/routes/(app)/souls/[id]/+page.svelte
    - services/ui/src/routes/(app)/executions/[id]/bots/[botId]/+page.svelte
    - services/ui/src/routes/(app)/executions/[id]/report/+page.svelte
    - services/ui/src/routes/(app)/executions/[id]/pre-flight/+page.svelte
    - services/ui/src/routes/(app)/executions/[id]/+page.svelte
    - services/ui/src/routes/(app)/category-benchmarks/+page.svelte
    - services/ui/src/routes/(app)/souls/+page.svelte
    - services/ui/src/routes/(app)/guide/+page.svelte
    - services/ui/src/routes/(app)/billing/+page.svelte
    - services/ui/src/routes/(app)/verdicts/+page.svelte
    - services/ui/src/routes/(app)/objectives/+page.svelte
    - services/ui/src/routes/(app)/+layout.svelte
    - services/ui/src/routes/(marketing)/+layout.svelte
    - services/ui/src/routes/(marketing)/login/+page.svelte
    - services/ui/src/routes/(marketing)/+page.svelte
    - services/ui/src/routes/(app)/verdicts/[verdictId]/+page.svelte
    - services/ui/src/routes/(app)/objectives/[id]/+page.svelte
    - services/ui/src/routes/(app)/admin/+page.svelte
    - services/ui/src/lib/components/SoulInspectorPanel.svelte
    - services/ui/src/lib/components/SoulTierBadge.svelte
    - services/ui/src/lib/components/VerdictConfirmPanel.svelte
    - package.json
decisions:
  - "guide/+page.svelte had deprecated tokens not caught by initial grep (file length > 300 lines) — fixed by running same replacement script on it"
  - "Python replace script used for bulk migration — faster and safer than manual editing 25 files"
metrics:
  duration: "2 minutes"
  completed: "2026-03-23"
  tasks_completed: 3
  files_changed: 26
---

# Phase 02 Plan 02: Consumer Token Migration Summary

**One-liner:** Migrated all 25 Svelte consumer files from v5 CSS token names to v2 semantic aliases and added lint:tokens enforcement script that exits 0, with Vite build passing clean.

## What Was Built

### Task 1: First Batch (12 files) Token Migration

Applied complete v5-to-v2 token substitution across 12 Svelte files:

- `dashboard/+page.svelte` — `--bg-card`, `--violet-bright/dim`, `--text-faint`, `--border-mid`
- `objectives/new/+page.svelte` — `--bg-card`, `--bg-3`, `--violet-*`, `--border-*`, `--text-faint`
- `new-execution/+page.svelte` — `--bg-card`, `--bg-2/3`, `--violet-*`, `--border-*`, `--teal-dim`
- `negative-signals/+page.svelte` — `--bg-card`, `--bg-3`, `--violet-bright`, `--text-faint`, `--amber`, `--teal`
- `souls/[id]/+page.svelte` — all `--s-N` spacing tokens + `--violet-*`, `--bg-card`, `--bg-3`, `--text-faint`
- `executions/[id]/bots/[botId]/+page.svelte` — all `--s-N` + `--violet-*`, `--teal/teal-dim`, `--amber/amber-dim`, `--bg-*`
- `executions/[id]/report/+page.svelte` — all `--s-N` + `--violet-*`, `--teal-dim`, `--amber-dim`, `--bg-card`
- `executions/[id]/pre-flight/+page.svelte` — `--s-9`, `--bg-card/card-2`, `--violet-*`, `--bg-2/3`, `--text-faint`
- `executions/[id]/+page.svelte` — `--bg-card`, `--border-mid`, `--teal`, `--amber`, `--text-faint`
- `category-benchmarks/+page.svelte` — `--violet-light`, `--teal`, `--amber`, `--text-faint`, `--rose`
- `souls/+page.svelte` — `--s-4`, `--bg-card`, `--border-mid`, `--violet-light`, `--text-faint`
- `guide/+page.svelte` — extensive `--s-N`, `--bg-card`, `--bg-2/3`, `--violet-*`, `--amber-dim`, `--teal-dim`, `--rose-dim`, `--border-mid`, `--text-faint`

**Token mapping applied (representative):**
- `var(--bg-card)` → `var(--card)`
- `var(--bg-2)` → `var(--bg2)`, `var(--bg-3)` → `var(--bg3)`
- `var(--violet-bright)` → `var(--accent-m)`, `var(--violet-dim)` → `var(--accent-dim)`
- `var(--text-faint)` → `var(--bo-faint)`
- `var(--border-mid)` → `var(--border)`, `var(--border-hi)` → `var(--bo-bhi)`
- `var(--teal-dim)` → `rgba(45, 212, 191, 0.10)`
- `var(--amber-dim)` → `rgba(251, 191, 36, 0.10)`
- `var(--rose-dim)` → `rgba(244, 114, 182, 0.08)`
- `var(--s-N)` → `var(--space-xs/sm/lg/xl/2xl/3xl)` or explicit px values

### Task 2: Second Batch (13 files) Token Migration

Applied same substitutions to remaining 13 files. Full codebase grep confirmed zero deprecated tokens in `services/ui/src/`.

Files: `billing`, `verdicts`, `objectives`, `(app)/+layout`, `(marketing)/+layout`, `login`, `(marketing)/+page`, `verdicts/[verdictId]`, `objectives/[id]`, `admin`, `SoulInspectorPanel`, `SoulTierBadge`, `VerdictConfirmPanel`.

### Task 3: lint:tokens Script

Added to root `package.json`:
```json
"lint:tokens": "! grep -rn --include='*.svelte' --include='*.css' --include='*.ts' -e '--h-' -e '--d-' -e '--ak-' -e 'var(--bg-card)' ... services/ui/src/"
```

Bans:
- `--h-*` (v1.0 Screenplay tokens)
- `--d-*` (v1.0 Director's Cut tokens)
- `--ak-*` (v3.0 Akasa tokens)
- All v5.0 token names replaced in Tasks 1-2

**Verification results:**
- `pnpm lint:tokens` — exit code 0 (no matches)
- `pnpm --filter @claw/ui build` — exit code 0, built in 2.36s

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm lint:tokens` exits 0 | PASS |
| `pnpm --filter @claw/ui build` exits 0 | PASS |
| `grep "var(--s-"` returns nothing in svelte files | PASS |
| `grep "var(--bg-card)"` returns nothing | PASS |
| `grep "var(--violet-bright)"` returns nothing | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] guide/+page.svelte had deprecated tokens not caught by initial grep**
- **Found during:** Task 1 verification
- **Issue:** Initial grep on guide page only checked 300 lines and returned no matches. The file is ~1400 lines and contained many deprecated tokens beyond line 300.
- **Fix:** Ran the same Python replacement script on guide/+page.svelte explicitly before verification.
- **Files modified:** `services/ui/src/routes/(app)/guide/+page.svelte`
- **Commit:** Included in Task 1 commit (d02de12)

## Known Stubs

None. This plan performs token migration only — no UI rendering or data flow introduced.

## Self-Check: PASSED

Files created/modified:
- `package.json` — FOUND (lint:tokens script added)
- `services/ui/src/routes/(app)/dashboard/+page.svelte` — FOUND
- All 25 component files migrated — FOUND

Commits:
- `d02de12` feat(02-02): migrate first batch of 12 Svelte files from v5 to v2 tokens — FOUND
- `1ab4653` feat(02-02): migrate remaining 13 Svelte files from v5 to v2 tokens — FOUND
- `994d43c` feat(02-02): add lint:tokens enforcement script to root package.json — FOUND
