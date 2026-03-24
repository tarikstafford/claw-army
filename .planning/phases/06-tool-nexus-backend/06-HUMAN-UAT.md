---
status: partial
phase: 06-tool-nexus-backend
source: [06-VERIFICATION.md]
started: 2026-03-24T19:00:00Z
updated: 2026-03-24T19:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. OAuth browser flow end-to-end
expected: Starting from /oauth/:toolId/start, browser is redirected to provider, user grants access, callback exchanges code for tokens, encrypted connection row appears in DB
result: [pending]

### 2. API key test-connection live provider call
expected: POST /:id/test against a connection with a revoked API key returns an error (not success)
result: [pending]

### 3. Webhook signature rejection
expected: Sending a webhook payload with an invalid/missing signature to /webhooks/:token returns 401, while a valid signature returns 200
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
