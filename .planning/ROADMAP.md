# Roadmap: Claw Bot Army

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-02-19)
- ✅ **v1.1 Google Auth Gate** — Phase 7 (shipped 2026-02-19)
- ✅ **v2.0 The SOUL System** — Phases 8-14 (shipped 2026-02-22)
- ✅ **v3.0 Bot Reliability & UX Overhaul** — Phases 15-23 (shipped 2026-02-23)
- ✅ **v4.0 The Ring Leader** — Phases 24-32 (shipped 2026-03-02)
- 🚧 **v5.0 Full Spectrum** — Phases 33-41 (in progress)

---

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

<details>
<summary>✅ v1.1 Google Auth Gate (Phase 7) — SHIPPED 2026-02-19</summary>

- [x] Phase 7: Google Auth Gate (6/6 plans) — completed 2026-02-19

See `.planning/milestones/v1.1-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v2.0 The SOUL System (Phases 8-14) — SHIPPED 2026-02-22</summary>

- [x] Phase 8: Database Schema and Shared Types (2/2 plans) — completed 2026-02-21
- [x] Phase 9: Soul Generation and Dispatch Integration (3/3 plans) — completed 2026-02-21
- [x] Phase 10: Decision Trace Collection (2/2 plans) — completed 2026-02-22
- [x] Phase 11: The Council (2/2 plans) — completed 2026-02-22
- [x] Phase 12: Human Confirmation Gate (2/2 plans) — completed 2026-02-22
- [x] Phase 13: God Layer and Agent Class System (4/4 plans) — completed 2026-02-22
- [x] Phase 14: UI Extensions (4/4 plans) — completed 2026-02-22

See `.planning/milestones/v2.0-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v3.0 Bot Reliability & UX Overhaul (Phases 15-23) — SHIPPED 2026-02-23</summary>

- [x] Phase 15: Bot Reliability (3/4 plans — 15-04 gap promoted to Phase 20) — completed 2026-02-23
- [x] Phase 16: Named Objectives Data Model (3/3 plans) — completed 2026-02-22
- [x] Phase 17: Objective Hub UI (3/3 plans) — completed 2026-02-22
- [x] Phase 18: Soul Inspector (2/2 plans) — completed 2026-02-22
- [x] Phase 19: Run View Enhancements (2/2 plans) — completed 2026-02-23
- [x] Phase 20: Spawn Timeout Error Preservation (1/1 plan) — completed 2026-02-23
- [x] Phase 21: Launch-from-Objective UI (2/2 plans) — completed 2026-02-23
- [x] Phase 22: v3.0 Tech Debt Cleanup (1/1 plan) — completed 2026-02-23
- [x] Phase 23: Akasa UI Rebrand — Design System Rollout (7/7 plans) — completed 2026-02-23

See `.planning/milestones/v3.0-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v4.0 The Ring Leader (Phases 24-32) — SHIPPED 2026-03-02</summary>

- [x] Phase 24: Ring Leader Schema and Shared Types (2/2 plans) — completed 2026-03-02
- [x] Phase 25: Orchestrator Demotion and Ring Leader Core (3/3 plans) — completed 2026-03-02
- [x] Phase 26: Soul Library Search and Population Assembly (3/3 plans) — completed 2026-03-02
- [x] Phase 27: Budget Validation and Population Sizing (2/2 plans) — completed 2026-03-02
- [x] Phase 28: Ring Leader Agent Spawning (4/4 plans) — completed 2026-03-02
- [x] Phase 29: Real-Time Execution Coordination (5/5 plans) — completed 2026-03-02
- [x] Phase 30: Run Synthesis (3/3 plans) — completed 2026-03-02
- [x] Phase 31: Ring Leader Fitness Scoring (4/4 plans) — completed 2026-03-02
- [x] Phase 32: Dashboard and Reporting (4/4 plans) — completed 2026-03-02

See `.planning/milestones/v4.0-ROADMAP.md` for full phase details.

</details>

---

### 🚧 v5.0 Full Spectrum (In Progress)

**Milestone Goal:** Close all gaps between PRDs, backend logic, and UI — fix API path mismatches, add missing schema columns, expose existing backend data in the UI, implement PRD-promised features not yet built, and replace UI stubs with functional implementations.

- [x] **Phase 33: Execution Data Model Fixes** — Add `llmProvider` and `allowedDomains` columns to executions table; wire Tool Gateway to per-execution domain filtering
- [x] **Phase 34: API Alignment and SSE Verification** — Fix Ring Leader route paths, verify SSE endpoints, add calibration endpoint
- [x] **Phase 35: Execution Form Enhancements** — Add campaign type, tool allowlist, and runtime limit fields to execution creation form
- [x] **Phase 36: Pre-Flight Manifest Review** — Gate execution launch behind manifest review step so user confirms soul assignments before bots spawn (completed 2026-03-03)
- [ ] **Phase 37: Objective CRUD UI** — Create, edit, and archive objectives from the UI (backend already exists)
- [ ] **Phase 38: Objective DNA Evolution Timeline** — Show which souls promoted/retired across runs on objective detail page
- [ ] **Phase 39: Soul and DNA Visibility** — Soul library browser, decision trace viewer, negative signal register, category benchmarks
- [ ] **Phase 40: Ring Leader Fitness Breakdown** — Expose coordination quality and soul selection quality dimensions in execution reports
- [ ] **Phase 41: Landing Page and Platform Polish** — Request access form, footer links, health endpoint

---

## Phase Details

### Phase 33: Execution Data Model Fixes

**Goal**: The executions table carries `llmProvider` and `allowedDomains` so the backend can route LLM calls to the correct provider and enforce per-execution domain filtering through Tool Gateway.
**Depends on**: Phase 32 (v4.0 complete)
**Requirements**: API-02, API-03
**Success Criteria** (what must be TRUE):
  1. POST /executions accepts `llmProvider` (anthropic | openai) and stores it on the executions row
  2. POST /executions accepts `allowedDomains` (string array) and stores it on the executions row
  3. Tool Gateway reads `allowedDomains` from the execution record and applies per-execution domain filtering (not only the global env var)
  4. Existing executions without these fields are unaffected (nullable columns, backward compatible)
**Plans**: 2 plans

Plans:
- [x] 33-01-PLAN.md — Add llmProvider and allowedDomains columns to Drizzle schema, create migration, wire through POST /executions handler
- [x] 33-02-PLAN.md — Wire Tool Gateway proxy to per-execution allowedDomains with TTL cache and X-Execution-Id header

---

### Phase 34: API Alignment and SSE Verification

**Goal**: UI calls reach correct backend routes — Ring Leader paths align, SSE streams emit real events, and the calibration endpoint is reachable.
**Depends on**: Phase 33
**Requirements**: API-01, API-04, API-05, API-06
**Success Criteria** (what must be TRUE):
  1. UI Ring Leader panel fetches `/ring-leader/runs/by-execution/:executionId/*` and receives data (no 404)
  2. `GET /executions/:id/events` SSE stream delivers activity feed events in real time to the browser
  3. `GET /events/lifecycle` SSE stream delivers soul lifecycle notifications (promotion, demotion, pioneer) to the browser
  4. `GET /verdicts/calibration?userId=` returns a JSON body with confirmation rate and a boolean warning flag
**Plans**: 2 plans

Plans:
- [x] 34-01-PLAN.md — Add missing BILLING_EVENTS_TOPIC to SSE subscription with per-topic error resilience
- [x] 34-02-PLAN.md — API alignment smoke tests verifying all 4 requirements via Fastify inject

---

### Phase 35: Execution Form Enhancements

**Goal**: Users can configure campaign type, tool allowlist, and runtime limit when creating an execution — all three fields reach the backend and are stored.
**Depends on**: Phase 33 (llmProvider and allowedDomains columns must exist), Phase 34 (routes aligned)
**Requirements**: FORM-01, FORM-02, FORM-03
**Success Criteria** (what must be TRUE):
  1. New execution form shows a campaign type selector (ad hoc / campaign) and submits the value to the backend
  2. New execution form shows a multi-select tool allowlist and the chosen tools are stored on the execution
  3. New execution form shows a runtime limit input (minutes) and the value is stored on the execution
  4. All three fields are optional with sensible defaults so existing form behavior is not broken
**Plans**: 2 plans

Plans:
- [x] 35-01-PLAN.md — Add campaign type, tool allowlist, and runtime limit to form and server action
- [x] 35-02-PLAN.md — Accept and store campaignType in POST handler, DB migration, and GET response

---

### Phase 36: Pre-Flight Manifest Review

**Goal**: Users see the full population manifest — souls assigned per task, source, and rationale — and must confirm before bots spawn, matching the PRD-promised pre-flight gate.
**Depends on**: Phase 35 (form produces a complete execution record before manifest generation)
**Requirements**: FORM-04
**Success Criteria** (what must be TRUE):
  1. After submitting the execution form, the user lands on a review screen showing the Ring Leader's population manifest (souls per task, class, source, rationale) before any bots are spawned
  2. The user can confirm to proceed or cancel to return to the form
  3. Bots do not spawn until the user confirms — the execution status remains in a pre-flight state until confirmation
  4. The review screen is consistent with the Akasa design system and loads without errors
**Plans**: 2 plans

Plans:
- [ ] 36-01-PLAN.md — Add pre_flight status to DB enum, decouple assemblePopulation from spawnAgentsForRun, add confirm/cancel endpoints
- [ ] 36-02-PLAN.md — Build pre-flight review UI route with manifest polling, confirm/cancel actions, and form redirect

---

### Phase 37: Objective CRUD UI

**Goal**: Users can create new objectives, edit existing ones, and archive objectives directly from the UI — no backend work needed, only forms connecting to the existing CRUD API.
**Depends on**: Phase 34 (routes verified)
**Requirements**: OBJ-01, OBJ-02, OBJ-03
**Success Criteria** (what must be TRUE):
  1. User can open a create objective form, fill in name and default configuration, and the new objective appears in the objectives list
  2. User can open an edit form for an existing objective, change name/description/configuration, and see the changes reflected immediately
  3. User can archive an objective from the objectives list and it disappears from the active list (soft delete)
  4. All forms follow Akasa design system conventions and surface validation errors inline
**Plans**: TBD

Plans:
- [ ] 37-01: Create objective form — modal or page, POST to /objectives, updates list
- [ ] 37-02: Edit objective form — pre-populated PATCH form
- [ ] 37-03: Archive action — confirmation dialog, DELETE/PATCH /objectives/:id, removes from list

---

### Phase 38: Objective DNA Evolution Timeline

**Goal**: The objective detail page shows a chronological timeline of which souls were promoted or retired across all runs linked to that objective, making the evolutionary history visible.
**Depends on**: Phase 37 (objective detail page is functional)
**Requirements**: OBJ-04
**Success Criteria** (what must be TRUE):
  1. Objective detail page includes a DNA evolution timeline section listing promotion and retirement events across runs
  2. Each timeline entry shows the soul's task category, class transition (e.g., Novice→Understudy), run number, and date
  3. Timeline renders correctly when no soul transitions exist yet (empty state)
**Plans**: TBD

Plans:
- [ ] 38-01: Backend query for soul lifecycle events scoped to an objective's runs
- [ ] 38-02: DNA evolution timeline UI component on objective detail page

---

### Phase 39: Soul and DNA Visibility

**Goal**: Users can browse the soul library, inspect decision traces for specific bots, view the negative signal register, explore category benchmarks, and see the Ring Leader fitness score with full dimension breakdown in execution reports.
**Depends on**: Phase 34 (SSE and routes verified; soul data already in DB from prior milestones)
**Requirements**: SOUL-01, SOUL-02, SOUL-03, SOUL-04, SOUL-05
**Success Criteria** (what must be TRUE):
  1. Soul library page lists all souls grouped by task category, showing agent class, generation, and fitness score — user can filter by category or class
  2. Bot detail view (or linked drawer) shows decision traces for that bot — directive references, attribution confidence, and outcome for each decision
  3. A negative signal register page lists failed and retired souls with failure type and directive failure summary
  4. Category benchmarks page shows pioneer progress, baseline scores, benchmark maturity level, and thin-data flags per category
  5. Execution post-run report shows the Ring Leader fitness detail panel — coordination quality (4 dimensions) and soul selection quality (5 dimensions) each with individual scores
**Plans**: TBD

Plans:
- [ ] 39-01: Soul library browser — backend query endpoint, UI route with filtering
- [ ] 39-02: Decision trace viewer — backend endpoint scoped to botId, UI panel on bot detail
- [ ] 39-03: Negative signal register — backend query endpoint, UI route
- [ ] 39-04: Category benchmarks — backend query endpoint, UI route
- [ ] 39-05: Ring Leader fitness breakdown panel in execution report

---

### Phase 40: Landing Page and Platform Polish

**Goal**: The landing page is functional — request access emails are captured, footer links resolve or are removed, and a health endpoint gives operators a quick system status check.
**Depends on**: Phase 34 (routes and endpoints pattern established)
**Requirements**: POLISH-01, POLISH-02, POLISH-03
**Success Criteria** (what must be TRUE):
  1. User can submit their email via the "Request access" form on the landing page and the submission is stored or forwarded (no silent failure, visible confirmation)
  2. All footer links on the landing page either navigate to real targets or are absent — no dead links remain
  3. `GET /admin/health` returns a JSON response with status for GCE, Cloud SQL, Redis, and BullMQ — returns 200 when healthy, 503 when degraded
**Plans**: TBD

Plans:
- [ ] 40-01: Request access endpoint (POST /waitlist or equivalent) and landing page form wiring
- [ ] 40-02: Audit and fix footer links
- [ ] 40-03: Implement GET /admin/health with subsystem checks

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Data Foundation | v1.0 | 4/4 | Complete | 2026-02-18 |
| 2. Core Execution Pipeline | v1.0 | 4/4 | Complete | 2026-02-18 |
| 3. Bot Runtime and Tool Gateway | v1.0 | 4/4 | Complete | 2026-02-19 |
| 4. Control Plane Services | v1.0 | 3/3 | Complete | 2026-02-19 |
| 5. Performance Intelligence and DNA Capture | v1.0 | 3/3 | Complete | 2026-02-19 |
| 6. UI Command Center | v1.0 | 5/5 | Complete | 2026-02-19 |
| 7. Google Auth Gate | v1.1 | 6/6 | Complete | 2026-02-19 |
| 8. Database Schema and Shared Types | v2.0 | 2/2 | Complete | 2026-02-21 |
| 9. Soul Generation and Dispatch Integration | v2.0 | 3/3 | Complete | 2026-02-21 |
| 10. Decision Trace Collection | v2.0 | 2/2 | Complete | 2026-02-22 |
| 11. The Council | v2.0 | 2/2 | Complete | 2026-02-22 |
| 12. Human Confirmation Gate | v2.0 | 2/2 | Complete | 2026-02-22 |
| 13. God Layer and Agent Class System | v2.0 | 4/4 | Complete | 2026-02-22 |
| 14. UI Extensions | v2.0 | 4/4 | Complete | 2026-02-22 |
| 15. Bot Reliability | v3.0 | 3/4 | Complete | 2026-02-23 |
| 16. Named Objectives Data Model | v3.0 | 3/3 | Complete | 2026-02-22 |
| 17. Objective Hub UI | v3.0 | 3/3 | Complete | 2026-02-22 |
| 18. Soul Inspector | v3.0 | 2/2 | Complete | 2026-02-22 |
| 19. Run View Enhancements | v3.0 | 2/2 | Complete | 2026-02-23 |
| 20. Spawn Timeout Error Preservation | v3.0 | 1/1 | Complete | 2026-02-23 |
| 21. Launch-from-Objective UI | v3.0 | 2/2 | Complete | 2026-02-23 |
| 22. v3.0 Tech Debt Cleanup | v3.0 | 1/1 | Complete | 2026-02-23 |
| 23. Akasa UI Rebrand — Design System Rollout | v3.0 | 7/7 | Complete | 2026-02-23 |
| 24. Ring Leader Schema and Shared Types | v4.0 | 2/2 | Complete | 2026-03-02 |
| 25. Orchestrator Demotion and Ring Leader Core | v4.0 | 3/3 | Complete | 2026-03-02 |
| 26. Soul Library Search and Population Assembly | v4.0 | 3/3 | Complete | 2026-03-02 |
| 27. Budget Validation and Population Sizing | v4.0 | 2/2 | Complete | 2026-03-02 |
| 28. Ring Leader Agent Spawning | v4.0 | 4/4 | Complete | 2026-03-02 |
| 29. Real-Time Execution Coordination | v4.0 | 5/5 | Complete | 2026-03-02 |
| 30. Run Synthesis | v4.0 | 3/3 | Complete | 2026-03-02 |
| 31. Ring Leader Fitness Scoring | v4.0 | 4/4 | Complete | 2026-03-02 |
| 32. Dashboard and Reporting | v4.0 | 4/4 | Complete | 2026-03-02 |
| 33. Execution Data Model Fixes | v5.0 | 2/2 | Complete | 2026-03-02 |
| 34. API Alignment and SSE Verification | v5.0 | 2/2 | Complete | 2026-03-03 |
| 35. Execution Form Enhancements | v5.0 | 2/2 | Complete | 2026-03-03 |
| 36. Pre-Flight Manifest Review | 2/2 | Complete    | 2026-03-03 | - |
| 37. Objective CRUD UI | v5.0 | 0/3 | Not started | - |
| 38. Objective DNA Evolution Timeline | v5.0 | 0/2 | Not started | - |
| 39. Soul and DNA Visibility | v5.0 | 0/5 | Not started | - |
| 40. Landing Page and Platform Polish | v5.0 | 0/3 | Not started | - |
