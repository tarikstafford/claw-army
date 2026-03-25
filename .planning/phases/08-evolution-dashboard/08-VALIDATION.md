---
phase: 08
slug: evolution-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | services/ui/vite.config.ts |
| **Quick run command** | `pnpm --filter @claw/ui exec vitest run --reporter=verbose` |
| **Full suite command** | `pnpm --filter @claw/ui exec vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @claw/ui exec vitest run --reporter=verbose`
- **After every plan wave:** Run `pnpm --filter @claw/ui exec vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | DASH-08 | integration | `grep 'back-office' services/ui/src/routes/(app)/evolution/+layout.svelte` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | DASH-01 | visual | Manual — verify fleet overview renders | ❌ | ⬜ pending |
| 08-02-01 | 02 | 2 | DASH-02 | integration | `grep 'timeline' services/ui/src/lib/components/evolution/` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | DASH-03 | visual | Manual — verify lineage tree SVG renders | ❌ | ⬜ pending |
| 08-03-01 | 03 | 2 | DASH-04 | integration | `grep 'experiment' services/ui/src/lib/components/evolution/` | ❌ W0 | ⬜ pending |
| 08-03-02 | 03 | 2 | DASH-05, DASH-06, DASH-07 | visual+integration | Manual — verify benchmarks, verdicts, pioneers | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements. This is a UI-only phase — components are verified through file existence and pattern grep checks.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fleet overview class grouping | DASH-01 | Visual layout verification | Load /evolution, verify agent counts by class |
| Lineage tree SVG interaction | DASH-03 | D3 SVG click events | Click nodes in lineage tree, verify soul version display |
| Pioneer amber treatment | DASH-07 | Visual styling verification | Find pioneer agent, verify amber "First in [category]" label |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
