---
phase: 2
slug: design-system-tokens-and-typography
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via `pnpm --filter @claw/ui exec vitest`) + grep-based lint script |
| **Config file** | `services/ui/vite.config.ts` |
| **Quick run command** | `pnpm --filter @claw/ui lint:tokens` |
| **Full suite command** | `pnpm --filter @claw/ui lint:tokens && pnpm --filter @claw/ui exec vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @claw/ui lint:tokens`
- **After every plan wave:** Run `pnpm --filter @claw/ui lint:tokens && pnpm --filter @claw/ui exec vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | DS-01 | grep | `grep -r '\-\-fo-bg' services/ui/src/app.css` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | DS-02 | grep | `grep -r '\-\-bo-bg' services/ui/src/app.css` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | DS-03 | grep | `grep -r '\-\-bg:' services/ui/src/app.css` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | DS-05 | grep | `grep -r '@fontsource' services/ui/src/routes/+layout.svelte` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | DS-06 | grep | `grep -r '\-\-font-display' services/ui/src/app.css` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | DS-04 | grep | `grep -r 'body.back-office' services/ui/src/app.css` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | DS-04 | grep | `grep -r 'localStorage' services/ui/src/app.html` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | DS-07 | script | `pnpm --filter @claw/ui lint:tokens` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lint:tokens` script in root `package.json` — grep for banned patterns (`--h-*`, `--d-*`, `--ak-*`)
- [ ] Vitest config already exists — no new framework install needed

*Existing infrastructure partially covers phase requirements. Lint script is new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No flash of wrong theme on reload | DS-04 | Requires visual check in browser | 1. Set Back Office mode 2. Hard refresh 3. Verify no flash of Front Office palette |
| Font rendering | DS-05, DS-06 | Visual font check | Open app, verify Cormorant Garamond headlines, DM Sans body, Press Start 2P labels render correctly |
| No Google Fonts CDN requests | DS-05 | Network check | Open DevTools > Network, reload page, filter for fonts.googleapis.com — must show zero requests |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
