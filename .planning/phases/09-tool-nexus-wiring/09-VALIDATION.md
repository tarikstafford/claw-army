---
phase: 9
slug: tool-nexus-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.1.1 |
| **Config file** | `services/akasa-server/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/webhooks.test.ts` |
| **Full suite command** | `pnpm --filter @claw/akasa-server exec vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/webhooks.test.ts`
- **After every plan wave:** Run `pnpm --filter @claw/akasa-server exec vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | TOOL-01 | integration (smoke) | Manual — requires running server | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | TOOL-06 | integration | Manual — requires live credentials | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | TOOL-07 | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/webhooks.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 1 | TOOL-07 | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/webhooks.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/akasa-server/src/__tests__/webhooks.test.ts` — stubs for TOOL-07 routing evaluation (no_match, match + dispatch log)
- [ ] `pnpm --filter @claw/plugin-tool-nexus build` — produces `dist/worker.js` required before plugin install

*Existing `webhook-verifier.test.ts` covers signature verification only — routing tests are net new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Plugin installed and `ready` — 7 tools visible | TOOL-01 | Requires running Paperclip server with live plugin loader | Start server, check `GET /api/plugins` for `akasa.tool-nexus` status `ready` |
| HubSpot create-contact invocation succeeds | TOOL-06 | Requires live OAuth credentials | Connect HubSpot in Tool Belt UI, invoke via agent session |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
