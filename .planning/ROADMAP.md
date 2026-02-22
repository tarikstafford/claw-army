# Roadmap: Claw Bot Army

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-02-19)
- ✅ **v1.1 Google Auth Gate** — Phase 7 (shipped 2026-02-19)
- ✅ **v2.0 The SOUL System** — Phases 8-14 (shipped 2026-02-22)
- 🚧 **v3.0 Bot Reliability & UX Overhaul** — Phases 15-19 (in progress)

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

---

### 🚧 v3.0 Bot Reliability & UX Overhaul (In Progress)

**Milestone Goal:** Fix bot spawning and harden the full GCE/OpenClaw lifecycle, then rebuild the UI around the objective as the primary unit of navigation — souls visible, army status live, run history and DNA evolution all accessible from one place.

#### Phase 15: Bot Reliability

**Goal**: Bots spawn reliably, fail visibly, and execute tasks end-to-end without operator intervention
**Depends on**: Phase 14 (v2.0 complete)
**Requirements**: BOT-01, BOT-02, BOT-03, BOT-04, BOT-05, BOT-06
**Success Criteria** (what must be TRUE):
  1. A bot VM that successfully starts OpenClaw transitions to `idle` status without manual intervention — verified across cold boot and restart
  2. A bot VM that fails to install OpenClaw or SecureClaw transitions to `error` status with a human-readable failure reason stored in the database
  3. A bot assigned a task sends it to OpenClaw via WebSocket, receives a completion event, and returns to `idle` — the full dispatch round-trip is confirmed working
  4. The UI displays a human-readable error message on any bot card that has entered `error` status — the user knows what went wrong without checking logs
  5. The `/bots/:botId/ready` handler refuses to set a bot to `idle` unless it can confirm the OpenClaw WebSocket connection is live
**Plans**: 4 plans

Plans:
- [ ] 15-01-PLAN.md — GCE startup script hardening + errorMessage DB column (BOT-01, BOT-02, BOT-04 foundation)
- [ ] 15-02-PLAN.md — Ready handler validation + spawn timeout (BOT-03, BOT-04)
- [ ] 15-03-PLAN.md — Dispatch round-trip validation + UI error surface (BOT-05, BOT-06)
- [ ] 15-04-PLAN.md — Fix spawn timeout status overwrite (gap closure)

#### Phase 16: Named Objectives Data Model

**Goal**: Users can save, launch from, list, and archive named objectives — objectives persist across runs and accumulate history
**Depends on**: Phase 15
**Requirements**: OBJ-01, OBJ-02, OBJ-03, OBJ-04
**Success Criteria** (what must be TRUE):
  1. User can create a named objective with name, description, default bot count, budget cap, runtime limit, and tool allowlist — and it persists after page reload
  2. User can launch a new run from a saved objective — the submission form pre-fills with the objective's default settings, all fields remain editable before launch
  3. The objectives list screen shows each saved objective with its last-run status, total run count, cumulative spend, and highest bot class achieved
  4. User can delete an objective (removes it from the list) or archive it (hides it from the list but preserves all run history)
**Plans**: 3 plans

Plans:
- [x] 16-01-PLAN.md — objectives DB table + Drizzle migration + executions FK + shared-types Objective schema
- [x] 16-02-PLAN.md — Objectives REST API: POST, GET (with aggregation), GET/:id, DELETE/:id, PATCH/:id + CORS update
- [x] 16-03-PLAN.md — Link executions to objectives: objectiveId in POST /executions + validation

#### Phase 17: Objective Hub UI

**Goal**: Users navigate the platform through objectives — each objective page shows all runs, aggregate stats, live status (if active), and DNA class progression
**Depends on**: Phase 16
**Requirements**: HUB-01, HUB-02, HUB-03, HUB-04
**Success Criteria** (what must be TRUE):
  1. The `/objectives` list page renders all saved objectives with last-run status, run count, total spend, and best class achieved — clicking any objective navigates to its detail page
  2. The `/objectives/:id` detail page lists every run with date, status, cost, bot count, avg composite score, and a link to the run detail view
  3. The objective detail page shows aggregate stats across all runs: total spend, total tasks completed, total bot-hours, and a readable soul class distribution trend
  4. If a run on this objective is currently active, the objective detail page shows live status inline: active bot count, real-time budget burn, and the last 5 activity events — without navigating away
  5. The objective detail page shows a DNA evolution summary: how many Novice → Understudy → Artisan class transitions have occurred across all runs on this objective
**Plans**: 3 plans

Plans:
- [ ] 17-01-PLAN.md — Backend API extensions: GET /:id/executions + GET /:id/stats endpoints, UI types, API client functions
- [ ] 17-02-PLAN.md — /objectives list page + nav link: objective table with status badges, stats, and navigation
- [ ] 17-03-PLAN.md — /objectives/:id detail page: run history table, aggregate stats, live status panel, DNA evolution summary

#### Phase 18: Soul Inspector

**Goal**: Users can inspect the full soul, lineage, and verdict for any bot in any run — and can see soul tier badges on bot cards throughout the UI
**Depends on**: Phase 17
**Requirements**: SOUL-01, SOUL-02, SOUL-03, SOUL-04
**Success Criteria** (what must be TRUE):
  1. Clicking any bot in any run opens a soul inspector panel showing the full SOUL.md content: all 7 behavioral dimensions and the inviolable constitution directives
  2. The soul inspector shows lineage metadata: generation counter, mutation operations applied, and the parent soul reference (or "seed" if no parent)
  3. If the bot has been evaluated by the council, the soul inspector shows the verdict type, confidence score, and a summary from each judge
  4. Every bot card across the live monitoring view, post-run dashboard, and leaderboard displays the bot's soul tier badge (Novice / Understudy / Artisan)
**Plans**: 2 plans

Plans:
- [x] 18-01-PLAN.md — Soul inspector panel: GET /bots/:botId/soul endpoint + BotSoul type + SoulInspectorPanel drawer + wiring into all 3 bot card contexts (SOUL-01, SOUL-02, SOUL-03)
- [x] 18-02-PLAN.md — Soul tier badge: extend monitoring endpoint with agentClass + SoulTierBadge component + integration into monitoring, leaderboard, bot detail (SOUL-04)

#### Phase 19: Run View Enhancements

**Goal**: The live and post-run views are richer — bot cards show task context and soul tier, the activity feed is accessible from the objective hub, and pending verdicts are highlighted with inline confirmation
**Depends on**: Phase 18
**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04
**Success Criteria** (what must be TRUE):
  1. Bot cards in the live monitoring view show the current task description, tool call count, token burn rate, and soul tier badge — all updating in real time
  2. The activity feed for a run is accessible directly from the objective hub page (embedded or linked inline) without navigating away to the run detail view
  3. The post-run performance dashboard displays a soul tier distribution panel showing the count of Novice, Understudy, and Artisan bots across the completed army
  4. The run detail view highlights any bots with pending council verdicts and shows an inline confirmation panel (reusing the existing CONF-* component) — verdict actions available without navigating to a separate screen
**Plans**: 2 plans

Plans:
- [ ] 19-01-PLAN.md — Bot card enhancements: extend /by-execution with currentTaskDescription, toolCallCount, tokenBurnRate + enriched objective hub activity feed (RUN-01, RUN-02)
- [ ] 19-02-PLAN.md — Soul tier distribution on report + VerdictConfirmPanel extraction + inline verdict highlights in run view (RUN-03, RUN-04)

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
| 15. Bot Reliability | v3.0 | 0/4 | Planned | - |
| 16. Named Objectives Data Model | v3.0 | 3/3 | Complete | 2026-02-22 |
| 17. Objective Hub UI | v3.0 | 3/3 | Complete | 2026-02-22 |
| 18. Soul Inspector | v3.0 | 2/2 | Complete | 2026-02-22 |
| 19. Run View Enhancements | v3.0 | 0/TBD | Not started | - |
