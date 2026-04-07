# ADR-0003: Tool Nexus as Paperclip Plugins

**Status:** Accepted
**Date:** 2026-03-25
**Context:** v6.0 Phase 6

## Decision

Build Tool Nexus connectors (HubSpot, Slack, Google Sheets) as Paperclip plugins rather than standalone services.

## Context

Agents need to invoke external SaaS tools. The question was where the invocation gateway lives:
1. Standalone tool-gateway service (existing v5 approach)
2. Paperclip plugins (agents discover tools via plugin dispatcher)
3. Akasa backend routes with direct HTTP calls

## Rationale

Paperclip plugins were chosen because:
- Agents already interact with Paperclip's plugin system — tools appear as native capabilities
- Plugin SDK handles discovery, dispatch, and lifecycle management
- Credentials stored encrypted (AES-256-GCM via `node:crypto`) in Akasa DB, resolved at invocation time
- OAuth with key versioning mandatory before first credential is persisted
- esbuild for plugin build (tsc rootDir violations with cross-package paths are unfixable)

## Consequences

- Plugin installed via Paperclip HTTP API (`POST /api/plugins/install`) in `local_trusted` mode
- Credential bridge uses HTTP (not direct DB import) to keep `@claw/db` out of plugin bundle
- Deterministic webhook token derivation (SHA-256 of connectionId + WEBHOOK_URL_SECRET) avoids DB schema change
- OAuth redirectUri must point to Express callback handler, not SvelteKit page
