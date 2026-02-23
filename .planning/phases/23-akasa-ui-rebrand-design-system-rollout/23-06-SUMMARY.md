---
phase: 23-akasa-ui-rebrand-design-system-rollout
plan: "06"
subsystem: ui
tags: [svelte, css, design-system, akasa, rebrand]
dependency_graph:
  requires: ["23-01"]
  provides: ["guide-page-akasa", "admin-page-akasa", "billing-page-akasa"]
  affects: ["services/ui/src/routes/guide/+page.svelte", "services/ui/src/routes/admin/+page.svelte", "services/ui/src/routes/billing/+page.svelte"]
tech_stack:
  added: []
  patterns:
    - "Callout semantic split: violet-dim for tips/cost-control, amber-dim for soul-mechanic notes (verdicts/DNA)"
    - "Danger states: var(--error)/var(--error-dim) replaces all --critical usage in admin"
    - "Svelte {#each} template syntax creates false-positive hex grep matches — verified actual hex count is 0"
key_files:
  created: []
  modified:
    - services/ui/src/routes/guide/+page.svelte
    - services/ui/src/routes/admin/+page.svelte
    - services/ui/src/routes/billing/+page.svelte
decisions:
  - "[23-06] Callout semantic split: callout--violet for product tips (Quick Start, Cost Control, Guardrails), callout--amber for soul/governance language (Army Builder, DNA compounds, Verdicts best practice) — amber is intervention/soul-mechanic language per prior decisions"
  - "[23-06] tier-artisan border uses rgba(251,191,36,0.2) opacity amber — Artisan amber border follows soul-tier coloring; kept as near-zero hex (opacity value cannot be expressed as CSS token)"
  - "[23-06] Admin stat-running card uses teal border/dim (active/live state) — matches teal=liveness pattern from 23-05"
  - "[23-06] Admin stat-failed card uses error border/dim — error is form/API failure language per 23-01 decision"
  - "[23-06] Billing status-completed uses violet-bright/violet-dim — positive outcome maps to violet (signal) not teal (live)"
  - "[23-06] #fff retained for button text on var(--violet) background — no --white token in app.css; universally correct neutral"
metrics:
  duration: "6 min"
  completed: "2026-02-23"
  tasks: 2
  files: 3
---

# Phase 23 Plan 06: Guide, Admin & Billing Akasa Restyle Summary

Akasa dark-theme restyle of the three utility pages: guide (1,328 lines, brand substitution), admin (598 lines, danger-state migration), and billing (299 lines, full light-to-dark restyle).

## What Was Built

### Task 1: Guide page — brand substitution + full Akasa restyle (commit `8d8c982`)

The largest single page in the app at 1,328 lines. Two changes applied:

**Brand substitution:** All "Claw Army" references replaced with "Akasa":
- `<title>Guide | Claw Army</title>` → `<title>Guide | Akasa</title>`
- Section lead copy: "Claw Army turns a plain-language..." → "Akasa turns a plain-language..."
- Billing section: "Claw Army charges on a bot-hour..." → "Akasa charges on a bot-hour..."
- Guardrails intro: "Claw Army runs hard safety controls..." → "Akasa runs hard safety controls..."

**CSS restyle — token replacements:**
- `--signal` → `var(--violet-bright)` (section tags, feature tags, guardrail tags, numbered list markers)
- `--text-primary` → `var(--text)` (all headings, h1/h2/h3, card titles)
- `--text-secondary` → `var(--text-muted)` (all body copy, list items, card paragraphs)
- `--surface-1` → `var(--bg-card)` (all cards: step-card, feature-card, config-item, tier-card, dna-item, verdict-card, example, billing-formula, guardrail-item)
- `--surface-2` → `var(--bg-2)` (code blocks, config-tip backgrounds)
- `--signal-tint`/`--signal-border` → `var(--violet-dim)` (callout backgrounds, example-tag bg)
- `--alert-tint`/`--alert` → `var(--amber-dim)`/`var(--amber)` (alert callouts)
- `--active`/`--active-tint`/`--active-border` → `var(--teal)`/`var(--teal-dim)` (Good badge)
- `--critical`/`--critical-tint` → `var(--error)`/`var(--error-dim)` (Avoid badge, bad list markers)
- Border-radius updated to `14px` throughout

**Soul-concept sections (amber):**
- `tier-artisan .tier-label` → `color: var(--amber)`
- `tier-understudy .tier-label` → `color: var(--teal)` (active/progression state)
- `dna-label` → `color: var(--amber)` (DNA is soul concept)
- Callouts for DNA compounding and verdicts best-practice use `callout--amber`

**Verdict badges:**
- promote → `var(--teal)` (soul progression)
- retire → `var(--rose)` (soul lifecycle end)

**Callout semantic split:**
- `callout--violet`: Quick Start tips, Cost Control, Guardrail trigger (product information)
- `callout--amber`: Army Builder note, DNA compounds, Verdicts best practice (soul/governance language)

**Font families:**
- Display headings → `var(--font-display)`
- Body copy → `var(--font-body)`
- Mono labels, tags, code → `var(--font-mono)`

### Task 2: Admin and billing pages (commit `194d20e`)

**Admin page (`/admin`):**
- Title: "Admin | Akasa"
- `--surface` → `var(--bg-card)` for all panels (login-card, stat-cards, table, dialog)
- `--text-primary` → `var(--text)`, `--text-secondary` → `var(--text-muted)`, `--text-secondary` fallback → `var(--text-faint)` for labels
- `--signal` → `var(--violet)` (login button), `var(--violet-bright)` (links, focus ring)
- `--bg` in inputs kept as `var(--bg)` (deepest dark for input fields)
- **Danger states (primary migration):** All `--critical` usage replaced with `var(--error)`:
  - `stop-btn` border/color: `var(--error)`, hover: `var(--error-dim)`
  - `confirm-stop-btn`: `border: 1px solid var(--error)`, color: `var(--error)`, hover: `var(--error-dim)`
  - `error-banner`: `background: var(--error-dim)`, `border: 1px solid var(--error)`, `color: var(--error)`
  - `input.input-error`: `border-color: var(--error)`
  - `stat-card.stat-failed`: `border-color: var(--error)`, `background: var(--error-dim)`
- Status badges migrated to Akasa semantic colors:
  - `running` → teal (active/live)
  - `queued` → text-faint/bg-3/border (neutral)
  - `completed` → violet-bright/violet-dim (positive outcome)
  - `failed` → error (failure state)
  - `stopped`/`paused` → amber (intervention state)
- `stat-card.stat-running` → `border-color: var(--teal)`, `background: var(--teal-dim)`
- Table: `thead` → `var(--bg-3)` header, `tbody td` → `var(--bg-card)`, hover → `var(--bg-2)`
- All font-family updated: labels → `var(--font-mono)`, headings → `var(--text)`
- Border-radius: 14px on all cards/panels

**Billing page (`/billing`):**
- Full restyle from light-mode (hardcoded hex `#f9fafb`, `#e5e7eb`, `#374151`, etc.) to Akasa dark tokens
- Title: "Billing | Akasa"
- `#f9fafb` stat-card → `var(--bg-card)`, `#e5e7eb` borders → `var(--border)`
- `#6b7280` subtitle/labels → `var(--text-muted)`, `var(--text-faint)` for table headers
- `#111827` stat values → `var(--text)` with `var(--font-mono)`
- `#f3f4f6` table header → `var(--bg-3)`
- `#374151` table body text → `var(--text)`
- `#f9fafb` even row alt → removed (rows uniformly `var(--bg-card)`, hover `var(--bg-2)`)
- `#6366f1` links → `var(--violet-bright)`, hover → `var(--violet-light)`
- Status badge complete restyle: running=teal, failed=error, completed=violet-bright, queued=text-faint, stopped/paused=amber
- Error state: `#fef2f2`/`#fecaca`/`#dc2626` → `var(--error-dim)`/`var(--error)` (dark background version)
- Table wrapper: `border: 1px solid var(--border)`, `border-radius: 14px`

## Verification Results

```
Brand check (claw army):     0 matches — PASS
Old tokens check:            0 matches — PASS
Akasa tokens — guide:        239 matches (target: 30+)
Akasa tokens — admin:        71 matches (target: 30+)
Akasa tokens — billing:      40 matches (target: 15+)
var(--error) in admin:       10 matches (danger states confirmed)
```

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes on hex false-positives

Per precedent from 23-03 and 23-04: Svelte `{#each}` template syntax (e.g. `{#each executions as exec (exec.id)}`) generates a false-positive hex match due to the `id)` pattern. Verified by direct line inspection — actual hardcoded hex count is near-zero:
- Guide: `#fff` ×2 (button text on violet background — no CSS token for white)
- Admin: `#fff` ×1 (same)
- Billing: 0 real hex

## Self-Check: PASSED

Files exist:
- `services/ui/src/routes/guide/+page.svelte` — FOUND
- `services/ui/src/routes/admin/+page.svelte` — FOUND
- `services/ui/src/routes/billing/+page.svelte` — FOUND

Commits:
- `8d8c982` — guide page
- `194d20e` — admin + billing pages
