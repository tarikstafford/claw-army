# Requirements: Akasa v6.0 — Paperclip Foundation

**Defined:** 2026-03-23
**Core Value:** Users deploy a crew of AI agents that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat.

## v1 Requirements

Requirements for v6.0 milestone. Each maps to roadmap phases.

### Submodule Integration

- [x] **SUB-01**: claw-paper-clip added as git submodule inside claw-army, pinned to current commit
- [x] **SUB-02**: pnpm workspace configured to span both repos — Akasa code can import @paperclipai/db, @paperclipai/shared, @paperclipai/adapters
- [x] **SUB-03**: Shared Postgres database with unified migration strategy — Paperclip's 55 tables + Akasa's evolution tables coexist
- [x] **SUB-04**: Paperclip's Express server starts as the primary backend process with Akasa evolution routes mounted alongside
- [x] **SUB-05**: Dev environment works with single `pnpm dev` that starts Express backend + SvelteKit frontend

### SvelteKit Frontend

- [ ] **UI-01**: SvelteKit v2 frontend configured to consume Paperclip's Express API directly (no separate Fastify backend)
- [ ] **UI-02**: Auth integrated — SvelteKit uses Paperclip's BetterAuth for session management (Google OAuth preserved)
- [ ] **UI-03**: Agent management views rebuilt in SvelteKit — create, configure, view agents (replaces Paperclip React UI)
- [ ] **UI-04**: Issue/task views rebuilt in SvelteKit — task board, issue detail, comments (replaces Paperclip React UI)
- [ ] **UI-05**: Chat interface rebuilt in SvelteKit — threads, messages, agent responses (replaces Paperclip React UI)
- [ ] **UI-06**: Dashboard rebuilt in SvelteKit — metrics, costs, task status (replaces Paperclip React UI)
- [ ] **UI-07**: Real-time updates via Paperclip's WebSocket live events consumed by SvelteKit

### Design System

- [ ] **DS-01**: CSS token system for Front Office — `--fo-bg`, `--fo-card`, `--fo-plum`, `--fo-gold`, `--ink`, `--muted` and all variants per akasa-design-guide-v2.md
- [ ] **DS-02**: CSS token system for Back Office — `--bo-bg`, `--bo-card`, `--bo-violet`, `--bo-amber`, `--bo-teal`, `--bo-rose`, `--bo-text/muted/faint` per v2 guide
- [ ] **DS-03**: `body.back-office` class toggle switches between modes, persisted in user preferences. Front Office is default (no class needed)
- [ ] **DS-04**: Three typefaces loaded — Cormorant Garamond (display, 16px min), DM Sans (body/default), Press Start 2P (labels/tags, 6-8px max). Font vars: `--font-display`, `--font-body`, `--font-label`
- [ ] **DS-05**: Opacity scale for Back Office text hierarchy — rgba(236, 232, 255, 0.52/0.42/0.24/0.14), never arbitrary grey hex values
- [ ] **DS-06**: Semantic colour constants enforced — violet=coordination, amber=karma/compounding, teal=execution, rose=contractors/tools. Near-black (#06050E), #000000 banned
- [ ] **DS-07**: Spacing scale (`--space-xs` through `--space-3xl`), border radius scale (`--radius-sm/md/lg`), section/card/grid padding per v2 guide
- [ ] **DS-08**: Core component patterns implemented — nav bar (44px fixed, mode toggle), mechanic cards, accordion, slide panel, modal, chat bubbles, metric tiles, karma callout
- [ ] **DS-09**: Model tier colours shared across modes — `--tier-junior` (Haiku/blue), `--tier-mid` (Sonnet/violet), `--tier-senior` (Opus/amber)
- [ ] **DS-10**: Agent identity colours — `--agent-indra`, `--agent-contr` + per-named-agent colours for office/chat/dashboard
- [ ] **DS-11**: Motion system — purposeful only, GPU-composited transforms, mode switch (0.4s), card hover (0.15s), slide panel (0.38s cubic-bezier), gem-spin logo animation
- [ ] **DS-12**: Product naming in UI — Sanctum (dashboard), The Chronicle (audit trail), The Record (soul storage). "Karma" not "score". Agents "work" not "run"

### Evolution Routes

- [ ] **EVO-01**: Soul system routes mounted on Paperclip's Express server — CRUD for bot_souls, soul generation, mutation engine
- [ ] **EVO-02**: Council evaluation routes — trigger 3-judge evaluation after heartbeat run completes, store verdicts
- [ ] **EVO-03**: God Layer routes — class transitions, DNA capture, negative signal updates, triggered by confirmed verdicts
- [ ] **EVO-04**: Karpathy loop wired to Paperclip's heartbeat lifecycle — after each agent run: score → council → verdict → mutate/keep/discard → DNA capture
- [ ] **EVO-05**: Soul injection into Paperclip agent sessions — SOUL.md content injected as system prompt when heartbeat dispatches an agent
- [ ] **EVO-06**: Evolution event hooks — Paperclip emits events on heartbeat completion that trigger council evaluation pipeline

### Evolution Dashboard

- [ ] **DASH-01**: Fleet overview showing agent count by class (Novice/Understudy/Artisan/Retired), composite score trends over time
- [ ] **DASH-02**: Per-agent evolution timeline — every council verdict, class transition, mutation event, DNA capture shown chronologically
- [ ] **DASH-03**: Lineage tree visualization (depth-1) — archetype origin → mutations → current soul form, clickable nodes to inspect soul versions
- [ ] **DASH-04**: Experiment ledger per agent — run-by-run log showing composite score, score delta, mutation applied, verdict, keep/discard outcome
- [ ] **DASH-05**: Category benchmarks view — pioneer baselines, benchmark maturity (3+ confirmed runs), thin-data flags, current best score per category
- [ ] **DASH-06**: Pending confirmation notifications — Promote/Retire verdicts surfaced with evidence, approve/reject inline
- [ ] **DASH-07**: Pioneer designation visual treatment — amber/gold, permanent badge, "First in [category]" with date
- [ ] **DASH-08**: Evolution Dashboard defaults to Director's Cut world. Toggle to Screenplay available in nav

### Tool Nexus

- [ ] **TOOL-01**: Tool Nexus connectors built as Paperclip plugins — each connector registers tools (actions + schemas) with the plugin tool dispatcher
- [ ] **TOOL-02**: OAuth connection flow for SaaS integrations — redirect to provider, callback, encrypted token storage via Paperclip's secret system, auto-refresh on expiry
- [ ] **TOOL-03**: API key connection flow as fallback — masked input, test-connection button, clear error on bad credential
- [ ] **TOOL-04**: Tool catalog UI in SvelteKit — browsable by category (CRM, Communication, Payments, Data), shows connection status per tool
- [ ] **TOOL-05**: Tool Belt view — user's connected tools with status badges (connected/expired/rate_limited/errored), last used, re-auth button on expired
- [ ] **TOOL-06**: Starter connectors shipped — minimum 3 integrations (e.g., HubSpot, Slack, Google Sheets) as working Paperclip plugins
- [ ] **TOOL-07**: Webhook receiver — unique URL per user per tool, signature verification where supported, incoming payloads routed to appropriate agent/objective
- [ ] **TOOL-08**: Webhook routing rules configurable — "when [event] matches [condition] → assign to [agent]"
- [ ] **TOOL-09**: Webhook event log — all received webhooks with payload, routing decision, resulting action
- [ ] **TOOL-10**: Invocation logging — per-invocation audit trail: toolId, action, agentId, timestamp, latency, success/failure

## Future Requirements

Deferred to v6.1+ milestones.

### Tool Nexus Advanced
- **TOOL-F01**: Custom tool registration — user defines any HTTP API with auth config + action schemas
- **TOOL-F02**: OpenAPI/Swagger import — paste URL or upload file, auto-generate tool actions from spec
- **TOOL-F03**: Dead letter queue for failed webhook routing
- **TOOL-F04**: Tool performance factored into composite fitness score (Council extension)
- **TOOL-F05**: Agent-authored tools — Artisan agents propose + deploy sandboxed tools (requires container runtime infra)

### Evolution Advanced
- **EVO-F01**: Lineage tree depth-3 graphical view
- **EVO-F02**: Mutation weight sliders (user-configurable evolution pressure)
- **EVO-F03**: Army composition history and named armies

### Design System
- **DS-F01**: Full execution monitoring UI rebuilt with new design system
- **DS-F02**: Onboarding flow (Start Mode / Connect Mode) — separate milestone

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bit rate / effective bit rate metrics | Internal concept, not user-facing. Evolution shown through score trends and class progression |
| Merging repos (Path B) | Path C (submodule) chosen — preserves repo independence |
| Keeping Paperclip's React UI | Replaced entirely by SvelteKit with two-world design system |
| Direct GCE/OpenClaw agent spawn | Preserved as legacy code, not the primary path. Paperclip heartbeat handles agent dispatch |
| Stripe billing integration | Deferred — layer on Paperclip's cost tracking in future milestone |
| Command Channel | Requires Paperclip chat integration stable first — separate milestone |
| Skill System / Skill Bazaar | Full dedicated milestone per PRD |
| Akashic Library marketplace | Requires DNA Library depth first |
| Real-time Council during execution | Council runs post-synthesis by design |
| User-editable soul dimensions | Corrupts evolutionary lineage attribution |
| 50+ integrations at launch | Curated 3 connectors. Custom tool registration covers the rest in v6.1 |
| Mobile app | Web-first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SUB-01 | Phase 1 | Complete |
| SUB-02 | Phase 1 | Complete |
| SUB-03 | Phase 1 | Complete |
| SUB-04 | Phase 1 | Complete |
| SUB-05 | Phase 1 | Complete |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |
| UI-04 | Phase 4 | Pending |
| UI-05 | Phase 4 | Pending |
| UI-06 | Phase 4 | Pending |
| UI-07 | Phase 4 | Pending |
| DS-01 | Phase 2 | Pending |
| DS-02 | Phase 2 | Pending |
| DS-03 | Phase 2 | Pending |
| DS-04 | Phase 2 | Pending |
| DS-05 | Phase 2 | Pending |
| DS-06 | Phase 2 | Pending |
| DS-07 | Phase 2 | Pending |
| DS-08 | Phase 3 | Pending |
| DS-09 | Phase 3 | Pending |
| DS-10 | Phase 3 | Pending |
| DS-11 | Phase 3 | Pending |
| DS-12 | Phase 3 | Pending |
| EVO-01 | Phase 5 | Pending |
| EVO-02 | Phase 5 | Pending |
| EVO-03 | Phase 5 | Pending |
| EVO-04 | Phase 5 | Pending |
| EVO-05 | Phase 5 | Pending |
| EVO-06 | Phase 5 | Pending |
| DASH-01 | Phase 8 | Pending |
| DASH-02 | Phase 8 | Pending |
| DASH-03 | Phase 8 | Pending |
| DASH-04 | Phase 8 | Pending |
| DASH-05 | Phase 8 | Pending |
| DASH-06 | Phase 8 | Pending |
| DASH-07 | Phase 8 | Pending |
| DASH-08 | Phase 8 | Pending |
| TOOL-01 | Phase 6 | Pending |
| TOOL-02 | Phase 6 | Pending |
| TOOL-03 | Phase 6 | Pending |
| TOOL-04 | Phase 7 | Pending |
| TOOL-05 | Phase 7 | Pending |
| TOOL-06 | Phase 6 | Pending |
| TOOL-07 | Phase 6 | Pending |
| TOOL-08 | Phase 7 | Pending |
| TOOL-09 | Phase 7 | Pending |
| TOOL-10 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 46 total
- Mapped to phases: 46
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 — traceability filled during roadmap creation*
