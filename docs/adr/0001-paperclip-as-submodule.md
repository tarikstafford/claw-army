# ADR-0001: Paperclip as Git Submodule

**Status:** Accepted
**Date:** 2026-03-23
**Context:** v6.0 Phase 1

## Decision

Import claw-paper-clip as a git submodule rather than merging repos or consuming as an npm package.

## Context

Three integration paths were evaluated for unifying Akasa and Paperclip:

- **Path A (merge):** Merge claw-paper-clip into claw-army monorepo. Loses upstream independence.
- **Path B (npm package):** Publish Paperclip packages to npm. Adds build/publish overhead for every change.
- **Path C (submodule):** Import as git submodule with shared pnpm workspace and database.

## Rationale

Path C preserves repo independence while enabling tight integration:
- Paperclip can still be developed and released independently
- Akasa can pin to specific Paperclip commits
- Shared pnpm workspace allows direct TypeScript imports (`@paperclipai/db`, `@paperclipai/shared`)
- Single database instance with unified migration strategy (separate journals)
- `pnpm dev` starts the full stack from one command

## Consequences

- Must run `git submodule update --init` after clone
- Paperclip updates require explicit pin advancement
- `strictPeerDependencies: false` needed for zod v3/v4 and drizzle-orm version mismatches
- Akasa migration journal renamed to `__akasa_migrations` to avoid conflicts
