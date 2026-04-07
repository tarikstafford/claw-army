# ADR-0002: Two-World Design System

**Status:** Accepted
**Date:** 2026-03-23
**Context:** v6.0 Phase 2

## Decision

Implement a dual-theme design system using CSS custom properties with `--fo-*` (Front Office) and `--bo-*` (Back Office) token prefixes, toggled via `body.back-office` class.

## Context

Akasa has two distinct UI contexts:
- **Front Office (Screenplay):** User-facing views — onboarding, chat, office management. Light/warm palette.
- **Back Office (Director's Cut):** Technical views — evolution, architecture, integrations. Dark/violet palette.

Options considered:
1. Tailwind CSS with theme variants
2. CSS modules with theme imports
3. Pure CSS custom properties with body class toggle

## Rationale

Pure CSS custom properties were chosen because:
- Existing codebase already uses scoped `<style>` blocks in Svelte — no migration needed
- Two themes is not complex enough to warrant a design token library (Style Dictionary, Theo)
- Tailwind would conflict with the bespoke token system and require migrating all existing CSS
- Body class toggle enables zero-component-remount theme switching with a single 0.4s transition
- localStorage persistence (`akasa-mode` key) with blocking inline script prevents flash

## Consequences

- Front Office is default (no class needed on body)
- Back Office activated by `body.back-office`
- All deprecated v5.0 tokens (`--h-*`, `--d-*`, `--ak-*`) removed atomically
- Self-hosted fonts via `@fontsource` packages (no Google Fonts CDN)
