---
phase: 13
slug: agent-intelligence-views
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `services/akasa-server/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @claw/akasa-server exec vitest run --reporter=verbose` |
| **Full suite command** | `pnpm --filter @claw/akasa-server exec vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @claw/akasa-server exec vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm --filter @claw/akasa-server exec vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | AGENT-01 | integration | `vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | AGENT-03 | integration | `vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | AGENT-04 | integration | `vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | AGENT-01 | manual | Browser check | N/A | ⬜ pending |
| 13-02-02 | 02 | 1 | AGENT-02 | manual | Browser check | N/A | ⬜ pending |
| 13-02-03 | 02 | 1 | AGENT-03 | manual | Browser check | N/A | ⬜ pending |
| 13-02-04 | 02 | 1 | AGENT-04 | manual | Browser check | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Backend route tests for `/api/akasa/evolution/bots/:botId/profile` endpoint
- [ ] Backend route tests for `/api/akasa/evolution/org` endpoint
- [ ] Backend route tests for extended timeline with judge outputs

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Radar chart renders 7 axes | AGENT-01 | SVG visual output | Open bot detail, check Profile tab renders spider chart with 7 labeled axes |
| Org map tree interactive | AGENT-02 | d3-hierarchy visual | Open /evolution/org, verify tree renders with category→class→agent hierarchy, click navigates |
| Accordion expands judge outputs | AGENT-03 | UI interaction | Open bot timeline, click verdict event, verify 3 accordion sections expand |
| Runtime status auto-refreshes | AGENT-04 | Polling behavior | Open bot detail, verify runtime bar updates within 30s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
