---
phase: 4
slug: sveltekit-frontend-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `services/ui/vitest.config.ts` or "none — Wave 0 installs" |
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
| 04-01-01 | 01 | 1 | UI-01 | integration | `pnpm --filter @claw/ui exec vitest run` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | UI-02 | integration | `pnpm --filter @claw/ui exec vitest run` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | UI-03 | integration | `pnpm --filter @claw/ui exec vitest run` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | UI-04, UI-05 | integration | `pnpm --filter @claw/ui exec vitest run` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | UI-06, UI-07 | integration | `pnpm --filter @claw/ui exec vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/ui/vitest.config.ts` — vitest config for SvelteKit
- [ ] `services/ui/src/__tests__/` — test directory structure
- [ ] `vitest` + `@testing-library/svelte` — install if not present

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth login flow | UI-01 | Requires real Google OAuth redirect | 1. Click "Sign in with Google" 2. Complete OAuth flow 3. Verify redirect to /indra 4. Refresh — session persists |
| WebSocket real-time events | UI-07 | Requires running Paperclip server with live agents | 1. Open chat page 2. Trigger agent response 3. Verify message appears without refresh |
| Session persistence across refreshes | UI-01 | Requires browser with cookies | 1. Log in 2. Close tab 3. Reopen — still authenticated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
