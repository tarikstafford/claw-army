---
phase: 12
slug: evolution-routes-verification
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-31
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `services/akasa-server/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @claw/akasa-server exec vitest run` |
| **Full suite command** | `pnpm --filter @claw/akasa-server exec vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @claw/akasa-server exec vitest run`
- **After every plan wave:** Run `pnpm --filter @claw/akasa-server exec vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | EVO-01 | artifact | `test -f .planning/phases/12-evolution-routes-verification/12-VERIFICATION.md` | N/A | ⬜ pending |
| 12-01-02 | 01 | 1 | EVO-02 | artifact | `grep 'EVO-02' .planning/phases/12-evolution-routes-verification/12-VERIFICATION.md` | N/A | ⬜ pending |
| 12-01-03 | 01 | 1 | EVO-03 | artifact | `grep 'EVO-03' .planning/phases/12-evolution-routes-verification/12-VERIFICATION.md` | N/A | ⬜ pending |
| 12-01-04 | 01 | 1 | EVO-04 | artifact | `grep 'EVO-04' .planning/phases/12-evolution-routes-verification/12-VERIFICATION.md` | N/A | ⬜ pending |
| 12-01-05 | 01 | 1 | EVO-05 | artifact | `grep 'EVO-05' .planning/phases/12-evolution-routes-verification/12-VERIFICATION.md` | N/A | ⬜ pending |
| 12-01-06 | 01 | 1 | EVO-06 | artifact | `grep 'EVO-06' .planning/phases/12-evolution-routes-verification/12-VERIFICATION.md` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This phase produces documentation artifacts only — no new test files needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| EVO-06 polling vs push | EVO-06 | Implementation uses polling (not push events); reviewer must confirm polling satisfies the requirement intent | Read `evolution-trigger.ts`, verify `startEvolutionPolling()` checks heartbeat_runs and triggers council |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
