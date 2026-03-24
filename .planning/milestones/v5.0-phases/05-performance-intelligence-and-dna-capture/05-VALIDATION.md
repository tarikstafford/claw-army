---
phase: 05
slug: performance-intelligence-and-dna-capture
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `services/akasa-server/vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `pnpm --filter @claw/akasa-server exec vitest run` |
| **Full suite command** | `pnpm --filter @claw/akasa-server exec vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @claw/akasa-server exec vitest run`
- **After every plan wave:** Run `pnpm --filter @claw/akasa-server exec vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | EVO-01 | unit | `vitest run src/__tests__/souls.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | EVO-05 | unit | `vitest run src/__tests__/soul-injection.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | EVO-02 | integration (mock LLM) | `vitest run src/__tests__/council.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | EVO-04, EVO-06 | unit (mock DB) | `vitest run src/__tests__/evolution-trigger.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 3 | EVO-03 | unit | `vitest run src/__tests__/god-layer.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `services/akasa-server/vitest.config.ts` — test configuration
- [ ] `services/akasa-server/src/__tests__/souls.test.ts` — REQ EVO-01
- [ ] `services/akasa-server/src/__tests__/soul-injection.test.ts` — REQ EVO-05
- [ ] `services/akasa-server/src/__tests__/council.test.ts` — REQ EVO-02
- [ ] `services/akasa-server/src/__tests__/evolution-trigger.test.ts` — REQ EVO-04, EVO-06
- [ ] `services/akasa-server/src/__tests__/god-layer.test.ts` — REQ EVO-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Heartbeat completion triggers council pipeline end-to-end | EVO-04 | Requires running Paperclip heartbeat service + real LLM calls | Start akasa-server, trigger a heartbeat run via Paperclip UI, wait for polling cycle, check `council_verdicts` table |
| Soul content observable in Paperclip session payload | EVO-05 | Requires running Paperclip agent adapter + inspecting session | Create bot with soul, dispatch agent via Paperclip, inspect `adapterConfig.instructionsFilePath` in agents table |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
