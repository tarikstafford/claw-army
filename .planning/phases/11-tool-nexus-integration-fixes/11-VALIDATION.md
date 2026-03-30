---
phase: 11
slug: tool-nexus-integration-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 11 — Validation Strategy

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
| 11-01-01 | 01 | 1 | TOOL-01 | integration | `curl -s OAuth redirect check` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | TOOL-03 | unit | `grep '../../../packages' plugin path` | ✅ | ⬜ pending |
| 11-01-03 | 01 | 1 | TOOL-07 | integration | `grep wakeup webhook dispatch` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 2 | TOOL-02, TOOL-05 | integration | `vitest run credential-bridge` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 2 | TOOL-06 | integration | `vitest run tool-invocation` | ❌ W0 | ⬜ pending |
| 11-02-03 | 02 | 2 | TOOL-08 | e2e | Manual webhook→agent flow | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing test infrastructure covers basic plugin tests
- [ ] Credential-bridge test stubs needed for TOOL-02/TOOL-05

*Existing infrastructure covers most phase requirements. New tests needed for credential-bridge flow.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth flow completes with real provider | TOOL-01 | Requires live OAuth provider (HubSpot/Slack) | 1. Click "Connect" on Tool Catalog 2. Verify redirect to provider 3. Verify callback reaches handler 4. Verify token stored |
| Webhook dispatches to agent | TOOL-08 | Requires running Paperclip agent | 1. POST webhook payload to `/api/akasa/webhooks/:toolId/:userId` 2. Verify agent receives heartbeat/wakeup |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
