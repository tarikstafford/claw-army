---
phase: 08
slug: evolution-dashboard
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-25
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | services/akasa-server/vitest.config.ts |
| **Quick run command** | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/evolution-dashboard.test.ts` |
| **Full suite command** | `pnpm --filter @claw/akasa-server exec vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/evolution-dashboard.test.ts`
- **After every plan wave:** Run `pnpm --filter @claw/akasa-server exec vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Wave 0 Test File

| File | Covers | Created By |
|------|--------|------------|
| `services/akasa-server/src/__tests__/evolution-dashboard.test.ts` | DASH-01 through DASH-06 route handlers with mocked DB | Plan 08-01, Task 0 |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-00 | 01 | 1 | DASH-01..06 | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/evolution-dashboard.test.ts` | Created by Task 0 | pending |
| 08-01-01 | 01 | 1 | DASH-01,06 | unit+integration | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/evolution-dashboard.test.ts` | yes (W0) | pending |
| 08-01-02 | 01 | 1 | DASH-08 | integration | `grep 'setMode.*back-office' services/ui/src/routes/(app)/evolution/+layout.svelte` | yes | pending |
| 08-01-03 | 01 | 1 | DASH-08 | integration | `ls services/ui/src/routes/(app)/evolution/agents/+page.svelte` | yes | pending |
| 08-02-01 | 02 | 2 | DASH-01 | integration | `grep 'sparkline' services/ui/src/lib/components/evolution/FleetOverview.svelte` | yes | pending |
| 08-02-02 | 02 | 2 | DASH-06 | integration | `grep 'verdicts.*confirm' services/ui/src/lib/components/evolution/VerdictConfirm.svelte` | yes | pending |
| 08-03-01 | 03 | 2 | DASH-02,03,04 | integration | `grep 'd3-hierarchy' services/ui/src/lib/components/evolution/LineageTree.svelte` | yes | pending |
| 08-03-02 | 03 | 2 | DASH-05,07 | integration | `grep 'PIONEER' services/ui/src/lib/components/evolution/BenchmarkCard.svelte` | yes | pending |

*Status: pending / green / red / flaky*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fleet overview class grouping + sparkline | DASH-01 | Visual layout verification | Load /evolution, verify agent counts by class and score trend sparkline |
| Lineage tree SVG interaction | DASH-03 | D3 SVG click events | Click nodes in lineage tree, verify soul version display |
| Pioneer amber treatment | DASH-07 | Visual styling verification | Find pioneer agent, verify amber "First in [category]" label |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
