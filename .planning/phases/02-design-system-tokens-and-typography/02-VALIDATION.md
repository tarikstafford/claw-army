---
phase: 2
slug: design-system-tokens-and-typography
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-23
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | grep-based lint script + Vite build verification |
| **Config file** | `services/ui/vite.config.ts` |
| **Quick run command** | `pnpm lint:tokens` |
| **Full suite command** | `pnpm lint:tokens && pnpm --filter @claw/ui build` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm lint:tokens` (once lint script exists after Plan 02 Task 3)
- **After every plan wave:** Run `pnpm lint:tokens && pnpm --filter @claw/ui build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 02-01-01 | 01 | 1 | DS-01, DS-02, DS-05, DS-07 | grep | `grep -c '\-\-fo-bg' services/ui/src/app.css && grep -c '\-\-bo-bg' services/ui/src/app.css && grep -c '\-\-space-xs' services/ui/src/app.css` | ⬜ pending |
| 02-01-02 | 01 | 1 | DS-03, DS-04, DS-06 | grep | `grep 'akasa-mode' services/ui/src/app.html && grep '@fontsource' services/ui/src/routes/+layout.svelte && grep 'export function setMode' services/ui/src/lib/mode.ts` | ⬜ pending |
| 02-02-01 | 02 | 2 | DS-01, DS-02 | grep | `! grep -rn --include='*.svelte' -e 'var(--bg-card)' -e 'var(--bg-2)' -e 'var(--violet-bright)' -e 'var(--s-' services/ui/src/routes/(app)/dashboard/ services/ui/src/routes/(app)/executions/` | ⬜ pending |
| 02-02-02 | 02 | 2 | DS-01, DS-02 | grep | `! grep -rn --include='*.svelte' -e 'var(--bg-card)' -e 'var(--bg-2)' -e 'var(--violet-bright)' -e 'var(--s-' services/ui/src/` | ⬜ pending |
| 02-02-03 | 02 | 2 | DS-04, DS-07 | script | `pnpm lint:tokens && pnpm --filter @claw/ui build` | ⬜ pending |

*Status: ⬜ pending / ✅ green / ❌ red / ⚠️ flaky*

---

## Requirement Traceability

| Requirement | Description | Covered By |
|-------------|-------------|------------|
| DS-01 | Front Office token system | Plan 01 Task 1 (defines tokens), Plan 02 Tasks 1-2 (migrates consumers) |
| DS-02 | Back Office token system | Plan 01 Task 1 (defines tokens), Plan 02 Tasks 1-2 (migrates consumers) |
| DS-03 | Mode toggle persistence | Plan 01 Task 2 (blocking script read + setMode() write utility) |
| DS-04 | Three typefaces loaded | Plan 01 Task 1 (installs packages), Plan 01 Task 2 (font imports in layout) |
| DS-05 | Back Office opacity scale | Plan 01 Task 1 (--bo-muted, --bo-caption, --bo-faint, --bo-ghost tokens) |
| DS-06 | Semantic colour constants | Plan 01 Task 1 (semantic aliases in :root + body.back-office) |
| DS-07 | Spacing + radius scales | Plan 01 Task 1 (--space-*, --radius-*), Plan 02 Tasks 1-2 (migrates --s-* refs) |

---

## Wave 0 Requirements

- [x] No new test framework needed — grep-based verification is sufficient for CSS token work
- [x] Vitest config already exists — available for future use but not required for this phase
- [x] lint:tokens script will be created as Plan 02 Task 3 (final task in phase)

*All verification commands use built-in grep — no Wave 0 scaffolding needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No flash of wrong theme on reload | DS-03 | Requires visual check in browser | 1. Set Back Office mode via toggleMode() 2. Hard refresh 3. Verify no flash of Front Office palette |
| Font rendering | DS-04 | Visual font check | Open app, verify Cormorant Garamond headlines, DM Sans body, Press Start 2P labels render correctly |
| No Google Fonts CDN requests | DS-04 | Network check | Open DevTools > Network, reload page, filter for fonts.googleapis.com — must show zero requests |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (no MISSING — all verification is grep-based)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
