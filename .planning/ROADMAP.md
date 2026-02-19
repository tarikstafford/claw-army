# Roadmap: Claw Bot Army

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-02-19)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) — SHIPPED 2026-02-19</summary>

- [x] Phase 1: Data Foundation (4/4 plans) — completed 2026-02-18
- [x] Phase 2: Core Execution Pipeline (4/4 plans) — completed 2026-02-18
- [x] Phase 3: Bot Runtime and Tool Gateway (4/4 plans) — completed 2026-02-19
- [x] Phase 4: Control Plane Services (3/3 plans) — completed 2026-02-19
- [x] Phase 5: Performance Intelligence and DNA Capture (3/3 plans) — completed 2026-02-19
- [x] Phase 6: UI Command Center (5/5 plans) — completed 2026-02-19

See `.planning/milestones/v1.0-ROADMAP.md` for full phase details.

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Data Foundation | v1.0 | 4/4 | Complete | 2026-02-18 |
| 2. Core Execution Pipeline | v1.0 | 4/4 | Complete | 2026-02-18 |
| 3. Bot Runtime and Tool Gateway | v1.0 | 4/4 | Complete | 2026-02-19 |
| 4. Control Plane Services | v1.0 | 3/3 | Complete | 2026-02-19 |
| 5. Performance Intelligence and DNA Capture | v1.0 | 3/3 | Complete | 2026-02-19 |
| 6. UI Command Center | v1.0 | 5/5 | Complete | 2026-02-19 |
| 7. Google Auth Gate | v1.1 | 0/6 | Not started | — |

### Phase 7: Google Auth Gate

**Goal:** Add Google OAuth authentication to the UI so unauthenticated users cannot access /new-execution. Includes /login page, nav user display, server-side route protection, and backend 401 enforcement on POST /executions. PRD at tasks/prd-google-auth.md
**Depends on:** Phase 6
**Plans:** 6 plans

Plans:
- [ ] 07-01-PLAN.md — Migrate adapter-static to adapter-vercel (server runtime prerequisite)
- [ ] 07-02-PLAN.md — Backend auth: verify-auth-token.ts + preHandler on POST /executions
- [ ] 07-03-PLAN.md — Auth.js core setup: @auth/sveltekit, auth.ts, hooks.server.ts, catch-all route
- [ ] 07-04-PLAN.md — Login page (/login) + root layout session loader + nav user display
- [ ] 07-05-PLAN.md — /new-execution auth guard + form action with Bearer token forwarding
- [ ] 07-06-PLAN.md — Human verification: end-to-end auth gate flows
