---
phase: 3
slug: design-system-components-and-motion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via SvelteKit) |
| **Config file** | `services/ui/vite.config.ts` |
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
| 03-01-01 | 01 | 1 | DS-08 | visual/grep | `grep -r '--tier-junior' services/ui/src/lib/components/` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | DS-08 | visual/grep | `grep -r 'NavBar' services/ui/src/lib/components/` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | DS-09 | grep | `grep -r 'MechanicCard\|Accordion\|SlidePanel\|Modal' services/ui/src/lib/components/` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | DS-10 | grep | `grep -r 'ChatBubble\|MetricTile\|KarmaCallout' services/ui/src/lib/components/` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | DS-11 | grep | `grep -r 'transform\|will-change' services/ui/src/lib/components/` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | DS-12 | grep | `grep -rn 'Sanctum\|Chronicle\|karma' services/ui/src/lib/components/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Component files created with correct naming conventions
- [ ] All CSS custom properties from Phase 2 tokens available in `app.css`

*Existing infrastructure covers framework requirements — vitest is already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| NavBar 44px height renders correctly | DS-08 | Visual layout verification | Open browser, inspect NavBar element, verify computed height is 44px |
| Mode toggle switches worlds visually | DS-08 | Requires browser interaction | Click mode toggle, verify body class changes and component styles update |
| GPU-composited transitions (no layout thrash) | DS-11 | Requires DevTools Performance panel | Open DevTools → Performance, trigger transitions, verify no "Layout" events |
| Agent identity colours visually distinct | DS-09 | Colour perception check | Render multiple agents side-by-side, verify visual distinction |
| SlidePanel cubic-bezier slide animation | DS-11 | Motion timing verification | Open SlidePanel, verify smooth 0.38s slide-in animation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
