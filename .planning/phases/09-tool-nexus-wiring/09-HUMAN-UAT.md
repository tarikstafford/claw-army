---
status: partial
phase: 09-tool-nexus-wiring
source: [09-VERIFICATION.md]
started: 2026-03-30T11:45:00Z
updated: 2026-03-30T11:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Plugin reaches ready status on server start
expected: GET /api/plugins returns [{pluginKey: 'akasa.tool-nexus', status: 'ready'}] after akasa-server starts
result: [pending]

### 2. Agent can invoke hubspot.create_contact end-to-end
expected: Agent session with Tool Nexus plugin loaded can call hubspot.create_contact and receive a response from HubSpot API
result: [pending]

### 3. Plugin install idempotency at runtime
expected: Second akasa-server startup logs 'Tool Nexus plugin already ready' and does not POST /api/plugins/install again
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
