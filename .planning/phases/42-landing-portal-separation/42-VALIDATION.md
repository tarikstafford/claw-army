---
phase: 42
slug: landing-portal-separation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | svelte-check (TypeScript/Svelte validation) |
| **Config file** | services/ui/svelte.config.js |
| **Quick run command** | `pnpm --filter @claw/ui check` |
| **Full suite command** | `pnpm --filter @claw/ui check` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @claw/ui check`
- **After every plan wave:** Run `pnpm --filter @claw/ui check`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 42-01-01 | 01 | 1 | PORTAL-01 | smoke | `pnpm --filter @claw/ui check` | ✅ | ⬜ pending |
| 42-01-02 | 01 | 1 | PORTAL-01 | manual-only | Visual: `/` shows minimal nav | N/A | ⬜ pending |
| 42-01-03 | 01 | 1 | PORTAL-01 | manual-only | Visual: `/objectives` shows full nav | N/A | ⬜ pending |
| 42-01-04 | 01 | 1 | PORTAL-01 | smoke | `pnpm --filter @claw/ui check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Landing page `/` shows only logo + Login/Signup nav | PORTAL-01 | Visual layout rendering — no e2e framework | Navigate to `http://localhost:5173/`, verify nav shows logo + Login/Signup only, no portal links |
| Portal pages show full nav with all management links | PORTAL-01 | Visual layout rendering — no e2e framework | Navigate to `http://localhost:5173/objectives`, verify full nav (Objectives, Guide, Verdicts, Billing, Souls, Benchmarks, Signals) |
| Routes still accessible at same URLs | PORTAL-01 | URL routing — manual navigation | Visit all major routes (`/`, `/objectives`, `/login`, `/new-execution`) and verify no 404s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
