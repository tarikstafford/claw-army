# Requirements: Claw Bot Army (Akasa)

**Defined:** 2026-03-02
**Core Value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.

## v5.0 Requirements

Requirements for v5.0 Full Spectrum — closing all gaps between PRDs, backend logic, and UI.

### API & Data Integrity

- [ ] **API-01**: Ring Leader UI routes use execution-scoped paths (`/ring-leader/runs/by-execution/:executionId/*`) that match backend route registration
- [ ] **API-02**: `llmProvider` field is stored on executions table, accepted by POST /executions, and sent from the UI form
- [ ] **API-03**: `allowedDomains` field is stored on executions table and forwarded to Tool Gateway for per-execution domain filtering
- [ ] **API-04**: SSE endpoint `GET /executions/:id/events` streams activity feed events to the UI in real time
- [ ] **API-05**: SSE endpoint `GET /events/lifecycle` streams soul lifecycle notifications (promotion, demotion, retirement, pioneer) globally
- [ ] **API-06**: `GET /verdicts/calibration?userId=` endpoint returns confirmation rate and warning flag for anti-rubber-stamp mechanics

### Execution Form

- [ ] **FORM-01**: User can select campaign type (ad hoc or campaign) when creating an execution
- [ ] **FORM-02**: User can configure tool allowlist (multi-select of available tools) when creating an execution
- [ ] **FORM-03**: User can set runtime limit (minutes) when creating an execution
- [x] **FORM-04**: User can review the full population manifest (souls assigned per task, source, rationale) before confirming execution launch

### Objective Management

- [x] **OBJ-01**: User can create a new named objective with default configuration (max bots, budget, tools, runtime)
- [x] **OBJ-02**: User can edit an existing objective's name, description, and default configuration
- [x] **OBJ-03**: User can archive an objective (soft delete) from the objectives list
- [x] **OBJ-04**: Objective detail page shows DNA evolution timeline — which souls promoted/retired across runs

### Soul & DNA Visibility

- [x] **SOUL-01**: User can browse the soul library — view all souls by task category with agent class, generation, fitness score
- [x] **SOUL-02**: User can view decision traces for a specific bot — directive references, attribution confidence, outcomes
- [x] **SOUL-03**: User can view the negative signal register — failed/retired souls with failure type and directive failure summary
- [x] **SOUL-04**: User can view category benchmarks — pioneer progress, baseline scores, benchmark maturity, thin data flags
- [x] **SOUL-05**: Execution report shows Ring Leader fitness detail breakdown — coordination quality (4 dimensions) and soul selection quality (5 dimensions) individually scored

### Landing Page & Polish

- [x] **POLISH-01**: "Request access" form on landing page captures email and stores it (or sends to a collection endpoint)
- [x] **POLISH-02**: Footer links on landing page either point to real targets or are removed
- [x] **POLISH-03**: `GET /admin/health` endpoint returns system health status (GCE, Cloud SQL, Redis, BullMQ)

## v6.0+ Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Soul Operations

- **ADV-01**: Mutation lineage visualization (depth-3 graphical view)
- **ADV-02**: Soul weight sliders (user-configurable fitness dimension weights)
- **ADV-03**: Army composition history (named armies with track record)
- **ADV-04**: Army Composition Recommendation algorithm
- **ADV-05**: Category weight auto-calibration after 10 confirmed runs

### Platform Scale

- **SCALE-01**: Multi-tenant isolation with per-org data boundaries
- **SCALE-02**: Real payment processing (Stripe integration)
- **SCALE-03**: Agent marketplace / soul trading

## Out of Scope

| Feature | Reason |
|---------|--------|
| User-editable raw soul text | Corrupts evolutionary lineage attribution |
| Fine-tuning model weights from soul data | Requires RLHF infrastructure |
| Real-time Council during execution | Council runs post-synthesis per design |
| DAG replanning mid-run | Ring Leader decomposes once, no recursive planning |
| Mobile app | Web-first |
| Per-run soul mutation | Insufficient run count produces noisy signal |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| API-01 | Phase 34 | Pending |
| API-02 | Phase 33 | Pending |
| API-03 | Phase 33 | Pending |
| API-04 | Phase 34 | Pending |
| API-05 | Phase 34 | Pending |
| API-06 | Phase 34 | Pending |
| FORM-01 | Phase 35 | Pending |
| FORM-02 | Phase 35 | Pending |
| FORM-03 | Phase 35 | Pending |
| FORM-04 | Phase 36 | Complete |
| OBJ-01 | Phase 37 | Complete |
| OBJ-02 | Phase 37 | Complete |
| OBJ-03 | Phase 37 | Complete |
| OBJ-04 | Phase 38 | Complete |
| SOUL-01 | Phase 39 | Complete |
| SOUL-02 | Phase 39 | Complete |
| SOUL-03 | Phase 39 | Complete |
| SOUL-04 | Phase 39 | Complete |
| SOUL-05 | Phase 39 | Complete |
| POLISH-01 | Phase 40 | Complete |
| POLISH-02 | Phase 40 | Complete |
| POLISH-03 | Phase 40 | Complete |

**Coverage:**
- v5.0 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after roadmap creation*
