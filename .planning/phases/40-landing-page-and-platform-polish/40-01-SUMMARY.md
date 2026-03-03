---
phase: 40-landing-page-and-platform-polish
plan: "01"
subsystem: ui-landing-backend
tags: [landing-page, form, waitlist, footer, polish]
dependency_graph:
  requires: []
  provides: [waitlist-endpoint, request-access-form, clean-footer]
  affects: [services/ui, services/execution-service]
tech_stack:
  added: []
  patterns: [svelte-form-actions, use-enhance, fastify-typebox-schema]
key_files:
  created:
    - services/ui/src/routes/+page.server.ts
  modified:
    - services/ui/src/routes/+page.svelte
    - services/execution-service/src/routes/admin.ts
decisions:
  - "POST /admin/waitlist logs email via request.log.info (Cloud Logging in prod) — no DB write, zero schema churn (satisfies POLISH-01 'stores or forwards')"
  - "Simple email.includes('@') check in both server action and backend handler — AJV v8 ignores format: 'email' by default, so typebox minLength + runtime check suffices"
  - "use:enhance on form for no-reload submission — success/error states rendered via conditional {#if form?.success} pattern"
  - "Resources and Company footer groups removed entirely — Platform group with valid anchor links (#how, #soul, #humans, #agents) retained"
metrics:
  duration: "2 min"
  completed: "2026-03-03"
  tasks_completed: 2
  files_changed: 3
---

# Phase 40 Plan 01: Landing Page Form and Footer Cleanup Summary

Landing page "Request access" form wired to real backend endpoint via SvelteKit form action + use:enhance, with success/error feedback; Resources and Company dead-link footer groups removed.

## What Was Built

### Task 1: Backend waitlist endpoint + UI form wiring

**`services/execution-service/src/routes/admin.ts`** — Added `POST /waitlist` handler inside `adminRoutes`:
- Accepts `{ email: string }` body with TypeBox schema (minLength: 3)
- Runtime `email.includes('@')` validation — returns 400 on failure
- `request.log.info({ email }, 'waitlist signup')` — Cloud Logging captures in prod
- Returns `{ ok: true }` on success

**`services/ui/src/routes/+page.server.ts`** (new file) — SvelteKit server action:
- Named export `requestAccess` (not `default`) — no auth check, public landing page
- Extracts and trims email from formData
- Client-side validation: returns `fail(400, { error })` for missing `@`
- POSTs to `${EXECUTION_SERVICE_URL}/admin/waitlist` with JSON body
- Returns structured errors for fetch failure (503) and non-ok responses
- Returns `{ success: true }` on success

**`services/ui/src/routes/+page.svelte`** — Updated form section:
- Added `import { enhance } from '$app/forms'` and `let { form } = $props()`
- Replaced static `<div class="access-form">` with `<form method="POST" action="?/requestAccess" use:enhance>`
- Button replaces anchor: `<button type="submit" class="btn-primary">Request access</button>`
- Conditional rendering: success (teal), error (rose), default (faint) message below form

### Task 2: Remove dead footer links

Removed the **Resources** group (Documentation, Status, Changelog — all `href="#access"` placeholders) and the **Company** group (About, Contact, Privacy — all `href="#access"` placeholders) from the footer. Retained the **Platform** group with valid same-page anchors (`#how`, `#soul`, `#humans`, `#agents`).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e286b47 | feat(40-01): wire landing page request access form to backend waitlist endpoint |
| 2 | faed140 | feat(40-01): remove dead footer links — Resources and Company groups deleted |

## Verification

All 5 plan verification criteria confirmed:
1. `+page.server.ts` exists with `requestAccess` action export
2. `admin.ts` contains `POST /waitlist` handler with email logging
3. `+page.svelte` has `<form method="POST" action="?/requestAccess" use:enhance>`
4. Footer has no dead `#access` links — 0 Resources/Company groups remain
5. `svelte-check` passes with 0 errors

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: services/ui/src/routes/+page.server.ts
- FOUND: services/ui/src/routes/+page.svelte (modified)
- FOUND: services/execution-service/src/routes/admin.ts (modified)

Commits verified:
- FOUND: e286b47 (Task 1)
- FOUND: faed140 (Task 2)
