---
phase: 06-tool-nexus-backend
plan: "03"
subsystem: akasa-server
tags: [webhooks, signature-verification, hubspot, slack, tool-nexus]
dependency_graph:
  requires: ["06-01"]
  provides: ["webhook-receiver", "hubspot-verification", "slack-verification"]
  affects: ["tool-invocation-logs"]
tech_stack:
  added: []
  patterns:
    - "HMAC-SHA256 webhook signature verification with timingSafeEqual"
    - "Deterministic webhook URL token derivation via SHA-256 hash"
    - "Express raw body capture for signature verification"
    - "TDD: RED (failing tests) → GREEN (implementation) → passing"
key_files:
  created:
    - services/akasa-server/src/services/webhook-verifier.ts
    - services/akasa-server/src/routes/webhooks.ts
    - services/akasa-server/src/__tests__/webhook-verifier.test.ts
  modified:
    - services/akasa-server/src/routes/index.ts
decisions:
  - "Deterministic token derivation (SHA-256 of connectionId + WEBHOOK_URL_SECRET) instead of storing tokens in DB — avoids schema migration and tokens remain stable across restarts"
  - "Express dynamic import for raw() middleware — avoids global body parser override while preserving existing JSON parsing for other routes"
  - "Unknown tool IDs accepted with console.warn — fail-open for extensibility; new tools can be added without code changes"
metrics:
  duration: "161s"
  completed_date: "2026-03-24"
  tasks: 2
  files: 4
---

# Phase 06 Plan 03: Webhook Receiver System Summary

Webhook receiver system built: HMAC-SHA256 signature verification for HubSpot (v3, base64) and Slack (v0, hex with 5-minute replay protection), unique per-connection URL tokens derived deterministically, and incoming payloads logged to the audit trail.

## What Was Built

**Task 1: Webhook signature verification service** (`webhook-verifier.ts`)
- `verifyHubSpotSignature`: validates X-HubSpot-Signature-v3 header — HMAC-SHA256 over `method+url+body+timestamp`, base64-encoded, timing-safe comparison
- `verifySlackSignature`: validates X-Slack-Signature header — `v0=HMAC-SHA256(v0:timestamp:body)`, hex-encoded, rejects timestamps older than 5 minutes to prevent replay attacks
- Both functions use `node:crypto` `timingSafeEqual` to prevent timing side-channel attacks
- 6/6 tests passing (TDD: RED → GREEN flow)

**Task 2: Webhook receiver routes** (`webhooks.ts`)
- `POST /akasa/webhooks/generate-url` — generates unique webhook URL for a tool connection using deterministic SHA-256 token derivation (connectionId + WEBHOOK_URL_SECRET)
- `POST /akasa/webhooks/:toolId/:token` — receives incoming webhooks, validates token, verifies signature per tool type, logs to `tool_invocation_logs`, handles Slack URL verification challenge
- Mounted on `akasaRouter` at `/akasa/webhooks`

## Decisions Made

- **Deterministic token derivation**: SHA-256 of `connectionId + WEBHOOK_URL_SECRET` instead of storing random tokens in DB. Avoids adding a column to `tool_connections` and keeps tokens stable across service restarts.
- **Express raw body capture**: Used dynamic import of `express.raw()` as route-level middleware to capture raw Buffer for HMAC verification without breaking the global JSON body parser used by all other routes.
- **Fail-open for unknown tools**: Unknown `toolId` values accept the payload with a `console.warn` — new tools can be onboarded without code changes.

## Test Results

```
Test Files  8 passed (8)
Tests       64 passed (64)
```

All 64 tests pass (6 new webhook verifier tests + 58 pre-existing).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all webhook receiver paths are wired end-to-end.

## Self-Check: PASSED

- [x] `services/akasa-server/src/services/webhook-verifier.ts` exists
- [x] `services/akasa-server/src/routes/webhooks.ts` exists
- [x] `services/akasa-server/src/__tests__/webhook-verifier.test.ts` exists
- [x] `services/akasa-server/src/routes/index.ts` updated with `webhooksRouter`
- [x] Commits `63bb5fc` and `e7ede70` exist
- [x] 64/64 tests pass
