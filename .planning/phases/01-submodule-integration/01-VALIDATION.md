---
phase: 1
slug: submodule-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing in execution-service) |
| **Config file** | `services/execution-service/vitest.config.ts` or "none — Wave 0 installs" |
| **Quick run command** | `pnpm --filter @claw/execution-service exec vitest run` |
| **Full suite command** | `pnpm --filter @claw/execution-service exec vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @claw/execution-service exec vitest run`
- **After every plan wave:** Run full suite + manual `pnpm dev` smoke test
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SUB-01 | integration | `git submodule update --init && ls paperclip/package.json` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | SUB-02 | integration | `pnpm install && pnpm exec tsc --noEmit` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | SUB-03 | integration | `pnpm db:migrate && psql -c "SELECT count(*) FROM information_schema.tables"` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 2 | SUB-04 | integration | `curl http://localhost:3000/api/akasa/health` | ❌ W0 | ⬜ pending |
| 01-05-01 | 05 | 3 | SUB-05 | integration | `pnpm dev & sleep 10 && curl http://localhost:3000/api/health && curl http://localhost:5173` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Verify vitest config exists or create one for integration tests
- [ ] Shell scripts for submodule clone + workspace validation
- [ ] Database migration validation script

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SvelteKit frontend loads in browser | SUB-05 | Requires browser rendering | Start `pnpm dev`, open http://localhost:5173, verify page loads |
| Express + Akasa routes respond | SUB-04 | Requires running server | Start backend, curl `/api/akasa/health` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
