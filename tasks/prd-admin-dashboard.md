# PRD: Admin Dashboard

## Introduction

Add an `/admin` route to the existing Claw Army UI that gives the operator a real-time view of all executions across all users — their status, objective, bot activity, and cost. Admins can also stop running executions. Access is protected by a hardcoded password stored as an environment variable.

## Goals

- Provide a single page showing every execution in the system
- Show live bot counts and status alongside each execution
- Surface total spend per execution
- Allow an admin to stop a running execution
- Ship fast — MVP only, no charts or advanced analytics

## User Stories

### US-001: Admin login with password
**Description:** As an admin, I want to enter a password to access the dashboard so that it isn't publicly visible.

**Acceptance Criteria:**
- [ ] `/admin` route shows a password prompt if not authenticated
- [ ] Password is checked against `VITE_ADMIN_PASSWORD` env var (build-time) or a hardcoded fallback
- [ ] On correct password, auth state is stored in `sessionStorage` so refresh doesn't log out
- [ ] On incorrect password, shows an error message
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Executions overview table
**Description:** As an admin, I want to see all executions in a table so I can understand what's running across the system.

**Acceptance Criteria:**
- [ ] Table shows all executions sorted by `created_at` descending
- [ ] Columns: Objective, Status, Bots (active/max), Spend ($), Created At
- [ ] Status has a colour-coded badge (queued=grey, running=blue, completed=green, failed=red, stopped=orange)
- [ ] Table polls the API every 10 seconds to stay current
- [ ] Empty state message when no executions exist
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Live bot count per execution
**Description:** As an admin, I want to see how many bots are active for each running execution so I can gauge system load.

**Acceptance Criteria:**
- [ ] Each execution row shows active bot count out of max (e.g. "2 / 3")
- [ ] Bot count is fetched from `GET /executions/:id/bots` and counts rows with status not `stopped` or `failed`
- [ ] Only fetched for executions with status `running`
- [ ] Typecheck passes

### US-004: Stop a running execution
**Description:** As an admin, I want to stop a running execution so I can intervene if something goes wrong.

**Acceptance Criteria:**
- [ ] Each `running` execution row has a "Stop" button
- [ ] Clicking shows a confirmation dialog before proceeding
- [ ] On confirm, calls `POST /executions/:id/stop`
- [ ] Button is disabled and shows a spinner while the request is in-flight
- [ ] Row status updates to `stopped` after success
- [ ] Error toast shown if the request fails
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Summary stats bar
**Description:** As an admin, I want a quick summary at the top of the page so I can see system health at a glance.

**Acceptance Criteria:**
- [ ] Shows 4 stat cards: Total Executions, Running Now, Total Spend ($), Failed
- [ ] Values are derived from the same executions data already fetched — no extra API calls
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: `/admin` is a new SvelteKit route in `services/ui/src/routes/admin/`
- FR-2: Password auth uses `sessionStorage` — no backend session required
- FR-3: Admin password configured via `VITE_ADMIN_PASSWORD` env var in Vercel (falls back to a hardcoded dev value if unset)
- FR-4: Executions table fetches `GET /executions` — if this endpoint doesn't exist, it must be added to the execution service returning all rows ordered by `created_at DESC`
- FR-5: Bot counts fetched via `GET /executions/:id/bots` for running executions only
- FR-6: Stop action calls `POST /executions/:id/stop` — if this endpoint doesn't exist, it must be added; it should transition status from `running` to `stopped` and stop all active bot containers
- FR-7: Table auto-refreshes every 10 seconds while the page is open
- FR-8: All monetary values displayed in dollars (divide cents by 100, format as `$0.00`)

## Non-Goals

- No per-user breakdown or user accounts
- No charts, graphs, or time-series data
- No task-level drill-down (bot list per execution is out of scope for MVP)
- No audit log of admin actions
- No role-based access — one password, one admin

## Technical Considerations

- Reuse existing badge/status styling from the execution detail page
- The `/api` Vercel proxy already routes to the backend — no new proxy config needed
- `GET /executions` (list all) and `POST /executions/:id/stop` likely need to be added to the execution service
- `VITE_ADMIN_PASSWORD` must be added to Vercel environment variables before deploy

## Success Metrics

- Admin can see all executions and their status within 2 seconds of loading the page
- Admin can stop a running execution in under 3 clicks
- No regressions to existing UI routes

## Open Questions

- Should stopped executions be hidden after a timeout, or always shown?
- Should the spend shown be real billing data or a placeholder until billing is wired up?
