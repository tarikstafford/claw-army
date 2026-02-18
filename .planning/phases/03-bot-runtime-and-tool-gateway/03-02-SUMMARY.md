---
phase: 03-bot-runtime-and-tool-gateway
plan: 02
subsystem: api
tags: [ai-sdk, openai, anthropic, google, llm, fetch, file-io, rate-limiting, tool-gateway]

# Dependency graph
requires:
  - phase: 03-01
    provides: POST /tool.invoke with JWT auth, allowlist, rate limiting, Zod validation, audit log, and 501 stubs awaiting real tool implementations

provides:
  - executeLlmCall: routes to OpenAI/Anthropic/Google via Vercel AI SDK 6, returns content + token counts
  - executeFetchUrl: enforces FETCH_URL_DOMAIN_ALLOWLIST by URL hostname, truncates at 1MB with 30s timeout
  - executeWriteFile: path traversal protection via path.basename(), writes to ARTIFACT_ROOT/<uuid>/<filename>
  - POST /tool.invoke: dispatches to real tool implementations, consume-after-return token accounting

affects: [03-03, bot-runtime, tool-gateway, llm-routing, artifact-storage]

# Tech tracking
tech-stack:
  added:
    - ai@6.0.90 (Vercel AI SDK core generateText)
    - "@ai-sdk/openai (OpenAI provider for gpt-*, o1*, o3* models)"
    - "@ai-sdk/anthropic (Anthropic provider for claude-* models)"
    - "@ai-sdk/google (Google provider for gemini-* models)"
  patterns:
    - Model prefix routing: gpt-/o1/o3 -> OpenAI, claude- -> Anthropic, gemini- -> Google, default -> OpenAI
    - AI SDK 6 field mapping: inputTokens/outputTokens -> contract promptTokens/completionTokens
    - consume-after-return: token credits consumed after LLM call; current call succeeds, next blocked
    - path.basename() sanitization: strips all directory components from user-supplied file paths
    - URL.hostname comparison (not .host) for allowlist: prevents port-confusion attacks

key-files:
  created:
    - services/tool-gateway/src/tools/llm-call.ts
    - services/tool-gateway/src/tools/fetch-url.ts
    - services/tool-gateway/src/tools/write-file.ts
  modified:
    - services/tool-gateway/src/routes/tool-invoke.ts
    - services/tool-gateway/package.json

key-decisions:
  - "AI SDK 6 usage fields are inputTokens/outputTokens (not promptTokens/completionTokens) - mapped to contract names at the tool handler boundary"
  - "path.basename() for path sanitization - strips all directory components regardless of OS separator, preventing path traversal attacks"
  - "URL.hostname (not .host) for allowlist comparison - .host includes port, enabling bypass with credentialed URLs"
  - "consume-after-return token pattern: TOKEN_RATE_LIMIT error from consumeTokens is swallowed post-dispatch; current call already returned; next call blocked by pre-check"

patterns-established:
  - "Tool handler signature: execute{ToolName}(req: {ToolName}Request): Promise<{ToolName}Result>"
  - "Tool errors bubble up to route handler try/catch, which returns 500 + audit log"
  - "Token fields included in audit log only for llm_call invocations (undefined for other tools)"

# Metrics
duration: 4min
completed: 2026-02-18
---

# Phase 3 Plan 02: Tool Handler Implementations Summary

**Three real tool handlers (llm_call via Vercel AI SDK multi-provider routing, fetch_url with hostname-based allowlist, write_file with path traversal protection) wired into POST /tool.invoke replacing 501 stubs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-18T12:02:50Z
- **Completed:** 2026-02-18T12:06:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- llm_call routes to OpenAI, Anthropic, or Google based on model prefix using Vercel AI SDK 6, with AI SDK 6 field name mapping (inputTokens/outputTokens) to contract names (promptTokens/completionTokens)
- fetch_url enforces domain allowlist via URL.hostname comparison, reads response as ArrayBuffer and truncates at 1MB with a 30-second timeout
- write_file uses path.basename() to sanitize user-supplied paths (prevents ../../etc/passwd traversal), writes to ARTIFACT_ROOT/<uuid>/<filename>
- POST /tool.invoke now dispatches to real implementations with consume-after-return token rate limiting and full audit log entries including token counts

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement llm_call, fetch_url, and write_file tool handlers** - `be8c2ef` (feat)
2. **Task 2: Wire tool implementations into route dispatch and integrate token rate limiting** - `5dfa35c` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `services/tool-gateway/src/tools/llm-call.ts` - LLM call tool: model prefix routing to openai/anthropic/google providers, AI SDK 6 field mapping, returns content + token counts
- `services/tool-gateway/src/tools/fetch-url.ts` - URL fetch tool: FETCH_URL_DOMAIN_ALLOWLIST enforcement by hostname, 1MB truncation, 30s AbortSignal timeout
- `services/tool-gateway/src/tools/write-file.ts` - File write tool: path.basename() traversal protection, ARTIFACT_ROOT/<uuid>/<filename> layout, utf-8 and base64 encoding
- `services/tool-gateway/src/routes/tool-invoke.ts` - Route dispatch updated: 501 stubs replaced with real tool calls, consume-after-return token accounting, success audit log with token counts
- `services/tool-gateway/package.json` - Added ai@6, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google dependencies

## Decisions Made

- **AI SDK 6 field names:** `result.usage.inputTokens` / `result.usage.outputTokens` (not promptTokens/completionTokens as in older SDKs). The mapping to contract field names happens inside `executeLlmCall`.
- **URL.hostname for allowlist:** Using `.hostname` (not `.host` which includes port) prevents bypass via `attacker.com:80@allowedhost.com` styled URL credential injection.
- **path.basename() for sanitization:** Handles both `/` and `\` separators and is idiomatic Node.js — avoids bespoke regex that might miss edge cases.
- **consume-after-return swallows TOKEN_RATE_LIMIT:** The current llm_call already returned successfully. Throwing here would be incoherent. Logged at console.error level so it's visible. The pre-check blocks the next call.

## Deviations from Plan

None - plan executed exactly as written. Tool handler signatures, field names, and routing logic all matched plan specifications. AI SDK 6 field names (inputTokens/outputTokens) were pre-validated against installed TypeScript types before implementation.

## Issues Encountered

None.

## User Setup Required

Environment variables needed for full functionality (not blocking TypeScript compilation or server startup):

- `OPENAI_API_KEY` — required for gpt-*, o1*, o3* model calls via llm_call
- `ANTHROPIC_API_KEY` — required for claude-* model calls via llm_call
- `GOOGLE_GENERATIVE_AI_API_KEY` — required for gemini-* model calls via llm_call
- `FETCH_URL_DOMAIN_ALLOWLIST` — comma-separated hostnames (e.g., `api.openai.com,api.anthropic.com`). If unset, all domains are allowed.
- `ARTIFACT_ROOT` — directory for write_file artifacts. Defaults to `/tmp/claw-artifacts`.

## Next Phase Readiness

- POST /tool.invoke is fully functional end-to-end with real implementations replacing all stubs
- llm_call is production-ready pending valid API keys
- fetch_url and write_file are fully functional with no external dependencies
- Phase 3 Plan 3 (bot runtime integration, execution lifecycle wiring) can proceed

---
*Phase: 03-bot-runtime-and-tool-gateway*
*Completed: 2026-02-18*

## Self-Check: PASSED

All files verified present, all commits verified in git history.
