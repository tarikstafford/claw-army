---
phase: 10
slug: v6-tech-debt-cleanup
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-30
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `services/akasa-server/vitest.config.ts` (if exists) or inline |
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
| 10-01-01 | 01 | 1 | SC-1 (stale env var) | grep | `grep -r EXECUTION_SERVICE_URL services/ui/` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | SC-2 (pioneer-tracker) | unit | `pnpm --filter @claw/akasa-server exec vitest run` | ✅ | ⬜ pending |
| 10-01-03 | 01 | 1 | SC-3 (webhook secret) | grep | `grep -r 'dev-webhook-secret' services/akasa-server/` | ✅ | ⬜ pending |
| 10-01-04 | 01 | 1 | SC-4 (evolution auth) | grep | `grep 'evolution' services/ui/src/hooks.server.ts` | ✅ | ⬜ pending |
| 10-01-05 | 01 | 1 | SC-5 (.env.example) | file | `test -f services/akasa-server/.env.example` | ❌ W0 | ⬜ pending |
| 10-01-06 | 01 | 1 | SC-6 (AKASA_BASE_URL) | grep | `grep AKASA_BASE_URL services/akasa-server/.env.example` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `services/akasa-server/.env.example` — created inline as part of Task 1 (no separate wave 0 prerequisite needed)

*Existing test infrastructure covers all unit test requirements. SC-5 and SC-6 create a new file verified by existence/grep checks. The file is created as the first action in Task 1, so downstream grep checks within the same task will find it.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Server fails to start without WEBHOOK_URL_SECRET | SC-3 | Requires process startup test | Unset WEBHOOK_URL_SECRET, run `pnpm --filter @claw/akasa-server dev`, confirm exit with error |

*All other behaviors have automated verification via grep or unit tests.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (2 tasks, both with automated verify)
- [x] Wave 0 covers all MISSING references (.env.example created inline in Task 1)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-30
