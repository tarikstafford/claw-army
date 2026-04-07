# ADR-0004: Direct DB Access for Paperclip Runtime State

**Status:** Accepted
**Date:** 2026-04-07
**Context:** v6.0 Phase 13

## Decision

Query Paperclip's `agentRuntimeState` table directly via `@paperclipai/db` instead of proxying through Paperclip's HTTP API.

## Context

Phase 13 (Agent Intelligence Views) needed to display live agent runtime status. Two options:
1. Proxy through Paperclip's `GET /agents/:id/runtime-state` HTTP endpoint
2. Query the shared database directly since both services run in the same process

## Rationale

Direct DB access was chosen because:
- Akasa and Paperclip share the same PostgreSQL database and run in the same Node.js process
- HTTP proxy adds unnecessary network overhead for same-process communication
- Avoids Paperclip's `assertBoard` auth check (Akasa authenticates its own users differently)
- Lazy initialization (`getPaperclipDb()`) prevents import-time side effects
- `bots.paperclipAgentId` already provides the bridge between Akasa bots and Paperclip agents

## Consequences

- Runtime endpoint queries `agentRuntimeState` + `agents` tables via Paperclip's Drizzle schema
- Budget utilization computed from `agents.spentMonthlyCents / agents.budgetMonthlyCents`
- Returns `null` gracefully when `paperclipAgentId` is absent (bot not linked to Paperclip agent)
- 30s client-side polling interval with cleanup on unmount
