# Pitfalls Research

**Domain:** API integration layer, generalized tool gateway with OAuth, dashboard redesign on existing platform
**Researched:** 2026-03-23
**Confidence:** HIGH (Fastify/SvelteKit patterns from existing codebase), HIGH (OAuth credential storage), MEDIUM (Paperclip integration specifics — external API not directly inspectable), HIGH (design system migration patterns)

---

## Critical Pitfalls

### Pitfall 1: Paperclip Client Treats Network Errors as Logic Errors — Silent Agent Loss

**What goes wrong:**
The Paperclip HTTP client wraps agent dispatch calls in try/catch. A transient network timeout, a Railway restart, or a Paperclip deploy gets caught as a generic `Error`, logged, and the bot transitions to `failed` state. The user sees a failed execution. The agent was never actually started — or worse, Paperclip did start it and the failure was only in the acknowledgement. When retried, a duplicate agent session is created with no lineage link.

**Why it happens:**
When treating an external service as the agent runtime, the calling service (execution-service) cannot distinguish between "Paperclip never received the request" vs "Paperclip received and started it, but the response was lost." Idempotency is assumed, not designed. The existing codebase has `fire-and-forget .catch()` patterns appropriate for side effects (Pub/Sub, billing events) — but those patterns applied to the Paperclip dispatch call produce silent agent loss.

**How to avoid:**
- Design the Paperclip client with explicit idempotency keys: every `dispatch()` call sends a `claw-idempotency-key` header derived from `${executionId}:${botId}` — Paperclip deduplicates on this key, so retries are safe
- Distinguish error categories in the client: `NetworkError` (safe to retry), `ConflictError` (already dispatched — treat as success), `ValidationError` (do not retry)
- Never transition a bot to `failed` on a network error — transition to `dispatch_pending` and schedule a reconciliation poll that checks Paperclip's session status
- Add a reconciliation job in BullMQ that runs 60s after dispatch: if bot is still `spawning` and Paperclip has no matching session, only then mark as failed

**Warning signs:**
- `paperclip-client.ts` `catch` block sets `bot.status = 'failed'` directly
- No idempotency key on dispatch calls
- No retry distinction between 5xx (transient) and 4xx (permanent) responses from Paperclip
- Bots in `spawning` state for > 5 minutes with no Paperclip session ID recorded

**Phase to address:** Paperclip integration phase (the first phase that wires `paperclip-client.ts`)

---

### Pitfall 2: OAuth Token Storage Without Rotation Breaks Tools Silently After Token Expiry

**What goes wrong:**
Tool connections store OAuth access tokens in `tool-connections` table (encrypted). Access tokens expire — typically 1 hour for Google, 30 days for HubSpot, 60 minutes for Slack. The first tool invocation after expiry fails with 401. The agent logs an error, marks the tool call as failed, and the Karpathy loop attributes the failure to the agent's soul behavior rather than an infrastructure credential expiry. This corrupts the evolution signal: agents get penalized for credential failures they cannot control.

**Why it happens:**
OAuth refresh flow is more complex than initial authorization: it requires storing the refresh token separately, detecting 401 responses, exchanging the refresh token, updating the stored credential, and retrying the original call — all within a single tool invocation. Teams implement the happy path (initial OAuth grant), defer refresh, and discover the problem when production tools start silently failing a month later.

**Consequences beyond the obvious:** The evolution system scores agents against task completion rate. Credential failures that look like agent failures produce negative council verdicts, trigger demotions, and write false negative signals to the negative signal register. Corrupted DNA cannot be easily cleaned up.

**How to avoid:**
- Store `accessToken`, `refreshToken`, `expiresAt`, `scope` — never just the access token
- Implement proactive refresh: before any tool invocation, if `expiresAt - now < 5 minutes`, refresh first
- Implement reactive refresh: on 401 from external API, attempt one refresh and retry before surfacing as error
- Add a `credentialExpired` error category that is distinct from `toolCallFailed` — Council judges must receive the distinction so they do not penalize soul behavior for infrastructure failures
- Tag failed tool invocations with `failureReason: 'credential_expired'` — exclude these from composite score calculation

**Warning signs:**
- `tool-connections` schema has `accessToken` but no `refreshToken` or `expiresAt`
- Tool invocation handler catches 401 and maps it to `ToolCallError` without attempting refresh
- No distinction in council-worker between `toolError` (agent behavior) and `credentialError` (infrastructure)

**Phase to address:** Tool Nexus OAuth connection phase, before any live tool is exercised by an agent

---

### Pitfall 3: Design System Token Migration Leaves Zombie Tokens — Two Incompatible Worlds Running in Parallel

**What goes wrong:**
The v3.0 dark violet design system established 28 CSS tokens in `app.css`. The v6.0 migration introduces Screenplay (light) and Director's Cut (dark) with a new token set (Cormorant Garamond/DM Sans/Press Start 2P, different palette). The migration is done incrementally — new routes use the new tokens, old routes are "updated later." Six months later, `--d-bg: #06050E` tokens coexist with the old `--bg-primary: #0f0e1a` tokens. Body class toggling breaks on mixed pages. New components reference tokens that don't exist in one world. The design system audit from v3.0 (zero hardcoded hex) becomes impossible to maintain.

**Why it happens:**
Incremental migration feels safe but creates an ambiguous contract: developers adding new components don't know which token system to use. The old system has no deprecation signal. The `body.system` class toggle applies new tokens but old components still read old tokens, so they partially re-render with incorrect values.

**How to avoid:**
- Remove all old tokens at the start of the design system phase — do not attempt backward compatibility
- Add a `/* DEPRECATED */` comment to any old token that must temporarily survive, and run a grep CI check that fails if deprecated tokens appear in new component files
- Establish a one-page canonical token reference (the design guide already exists in `tasks/akasa-design-guide.md`) — link it from `app.css`
- Run a full existing-routes audit at the end of the design system phase: `grep -r 'var(--' services/ui/src` and validate every token reference exists in the new system

**Warning signs:**
- `app.css` contains both `--d-bg` (new) and `--bg-primary` (old) tokens simultaneously
- New Svelte components importing styles that reference `--violet-*` or `--bg-*` patterns from the old system
- `body.system` toggle causing flash of incorrect colors on any existing page

**Phase to address:** Design system foundation phase — must be the first UI phase in the milestone, completed before any other UI work begins

---

### Pitfall 4: OpenAPI Import Produces Contracts That Pass Validation but Fail at Runtime

**What goes wrong:**
The OpenAPI importer parses a Swagger spec and generates tool contracts (Zod schemas). The generated schemas validate against the spec. But the actual external API uses undocumented fields, optional-in-spec but required-in-practice fields, or enum values not listed in the spec. The tool invocation passes Akasa's validation, hits the real API, and gets a 422 or a garbled response. The spec was written for documentation, not for machine consumption.

**Secondary problem:** OpenAPI specs for popular services (HubSpot, Salesforce, Stripe) are large (100k+ lines). Parsing them fully at import time exhausts memory or takes minutes. Naive full-parse implementations silently truncate or crash.

**How to avoid:**
- Treat OpenAPI import as "first draft" only — present the generated contract to the user for review before saving, never auto-activate
- Add a "test this tool" dry-run invocation against the real API at connection time — surface any 4xx/5xx before the contract is saved
- For large specs, implement streaming parse with path filtering: user selects which endpoints to import, only those paths are fully parsed
- Mark imported contracts with `source: 'openapi-import'` and `verified: false` — flip to `verified: true` only after a successful live invocation
- Validate against the actual response schema, not just the request schema

**Warning signs:**
- `openapi-importer.ts` does a synchronous full file parse without a file size guard
- Generated contracts are saved directly to `tool-definitions` without a user review step
- No "test connection" step in the tool registration UI flow
- Import used with external specs > 50KB without streaming

**Phase to address:** Tool Nexus — OpenAPI import sub-feature

---

### Pitfall 5: Webhook Receiver URL Collision and Replay Attacks When Switching Tool Connections

**What goes wrong:**
Webhook URLs are generated as `https://akasa.io/webhooks/{userId}/{toolSlug}`. A user deletes a tool connection and re-creates it (common during OAuth re-auth). The old webhook URL is still registered with the external service (HubSpot, Stripe, Twilio). Incoming webhooks hit the new connection but fail HMAC verification because the secret rotated. Worse: the old URL stays registered and an attacker replays a captured webhook after the connection is deleted.

**Secondary problem:** If the URL is deterministic and guessable (`userId` + `toolSlug`), any attacker who knows your userId can target your webhook endpoint with forged payloads.

**How to avoid:**
- Include a non-guessable token in the webhook URL: `https://akasa.io/webhooks/{webhookSecret}` where `webhookSecret` is a cryptographically random UUID per connection — when the connection is deleted, the webhook secret is revoked
- On connection deletion, do not just soft-delete — immediately invalidate the webhook secret in Redis so any in-flight webhooks are rejected
- Implement replay attack prevention: store webhook event IDs in Redis with TTL matching the external service's retry window (typically 24-72h); reject duplicates
- Add a `connectedAt` timestamp check: reject webhooks with event timestamps older than the connection's `connectedAt`
- Store the HMAC secret in the encrypted `tool-connections.credentialData` blob — never generate it from deterministic inputs

**Warning signs:**
- Webhook URL contains predictable components (userId, toolSlug) without a random token
- `tool-connections` soft-delete without invalidating webhook secret in Redis
- No `X-Webhook-Event-Id` deduplication store
- Webhook handler accepts any payload that passes HMAC without checking event age

**Phase to address:** Tool Nexus — webhook receiver sub-feature

---

### Pitfall 6: Paperclip API Contract Drift Breaks Agent Sessions Silently in Production

**What goes wrong:**
Paperclip is an upstream open-source dependency. Its API evolves. The `paperclip-client.ts` types are written against the API at a point in time. When Paperclip adds a required field, renames a response property, or changes an endpoint path, the TypeScript types do not catch it — they validate at compile time against the Akasa-defined types, not against the live Paperclip server. Agent dispatch silently starts sending malformed requests. Agents never start. Execution dashboard shows mysterious failures with no clear cause.

**Why it happens:**
TypeScript types for external HTTP APIs are maintained by hand or generated from a spec that can fall out of sync. The check-in frequency for Paperclip updates is low. The failure mode is silent: fetch() doesn't throw on a mismatched request body, it returns a 400 or 422 that gets mapped to "agent failed to start."

**How to avoid:**
- Generate `paperclip-client.ts` types from Paperclip's actual OpenAPI spec (not hand-written) — add a `pnpm generate:paperclip-types` script that pulls the spec and regenerates on each Paperclip dependency update
- Add a startup health check that calls Paperclip's `/api/healthz` (or equivalent) and asserts the API version matches the expected version semver range
- Write integration tests for the Paperclip client that run against a real Paperclip instance (or Docker Compose dev setup) — not just unit tests with mocked responses
- Pin the Paperclip service version in Railway and only upgrade deliberately, not on auto-deploy

**Warning signs:**
- `paperclip-client.ts` types are hand-authored, not generated
- No version assertion on the Paperclip API at startup
- Paperclip deployed to Railway with auto-deploy on push to main
- No integration test suite for the Paperclip client

**Phase to address:** Paperclip integration phase — type generation must be set up before the client is used

---

### Pitfall 7: Credential Encryption Key Rotation Is Not Planned, Making Tool Connections Permanently Fragile

**What goes wrong:**
OAuth tokens and API keys for tool connections are encrypted at rest using a `CREDENTIAL_ENCRYPTION_KEY` env var. If this key is rotated (for any reason: security incident, env var misconfiguration, Railway environment re-creation), all existing `tool-connections.credentialData` blobs become undecryptable. Every user's tool connections break simultaneously with no recovery path other than asking every user to re-authenticate every tool.

**Why it happens:**
Encryption at rest is implemented once and assumed to be permanent. Key rotation is not treated as an operational requirement. The encryption key lives only in environment variables with no backup or version tracking. When Railway rotates secrets or a new environment is spun up, the old key is gone.

**How to avoid:**
- Implement envelope encryption: data is encrypted with a per-record data encryption key (DEK); the DEK is itself encrypted with a key encryption key (KEK). Key rotation only requires re-encrypting DEKs, not re-decrypting all credential blobs
- Store a `keyVersion` integer alongside each encrypted credential — the decryption function selects the correct key by version
- Maintain at least two active key versions during any rotation period: new writes use the new key, old records remain readable with the old key until a background migration completes
- Document the key rotation procedure before any production credential is written — not after

**Warning signs:**
- `tool-connections` schema has no `keyVersion` column
- `CREDENTIAL_ENCRYPTION_KEY` is a single env var with no versioning
- No documented runbook for "what happens if the encryption key changes"

**Phase to address:** Tool Nexus — credential storage sub-feature, before any OAuth credentials are persisted

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hand-write Paperclip API types | Faster initial setup, no tooling needed | Types drift from reality, silent API failures, full rewrite when Paperclip's API changes | Never — generate from spec from day one |
| Store only OAuth access token (no refresh token) | Simpler initial schema | Tool connections expire and break evolution signal — requires user re-auth and corrupts agent scoring | Never in production paths |
| Use `userId + toolSlug` as webhook URL | Deterministic, easy to debug | Guessable URLs enable targeted webhook forgery attacks | Never — always include a random secret |
| Migrate design system incrementally (old + new tokens coexist) | Reduced risk per PR | Ambiguous token ownership, mixed-world rendering bugs, impossible to maintain zero-hardcoded-hex rule | Only if a single-pass migration genuinely cannot be done; add CI enforcement of deprecated token usage |
| Mock Paperclip responses in all tests | Fast test suite, no external dependency | Masks API drift until production; mocks can model incorrect behavior for months | Acceptable for unit tests; unacceptable as the only test layer — always add at least one integration test against real Paperclip |
| Single static encryption key for credentials | Zero operational complexity | Unrecoverable if key is lost or rotated | Never for user credentials — key versioning must be designed in from the start |
| Flat `tool-invoke` route handles all tools | Faster to build, single code path | Cannot enforce per-tool rate limits, auth injection, or contract validation without messy conditional logic | Acceptable for internal dev stub; requires proper contract-driven dispatch before any third-party tool is connected |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Paperclip agent dispatch | Treating all errors as permanent failures | Categorize: network error (retry with backoff), 409 conflict (already dispatched — treat as success), 422 validation (do not retry) |
| Paperclip WebSocket events | Assuming WebSocket reconnection preserves session state | Re-subscribe to event streams after reconnection; WebSocket is transport, not session — session continuity is Paperclip's API concern |
| HubSpot OAuth | Using implicit grant (token in URL) | Always use authorization code grant with PKCE; token must reach only the server, never the browser |
| Slack OAuth | Scopes requested at install vs. scopes used by agents | Request minimum scopes at install; Slack rejects calls for scopes not granted — agents must declare which Slack scopes their skills require |
| OpenAPI import with large specs | Synchronous full parse | Stream + filter: user selects paths, parse only selected sections; guard with a 2MB file size hard limit |
| Webhook HMAC verification | Verifying HMAC after JSON.parse() | Verify HMAC against the raw request body bytes before any parsing — JSON normalization can alter whitespace and invalidate the signature |
| Stripe webhooks | Using request body parsed by Fastify | Fastify's body parser consumes the raw buffer; use `addContentTypeParser` to preserve the raw body for HMAC verification |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Tool invocation audit log written synchronously in request path | Slow tool calls, timeouts on high-frequency invocations | Write audit records to a BullMQ queue, not synchronously in the request handler | At ~100 concurrent agent tool calls |
| Webhook payload stored in PostgreSQL as JSONB with no size limit | DB bloat from large Stripe/HubSpot payloads; slow queries on `tool-invocations` table | Add a `maxPayloadBytes: 64KB` hard limit at the webhook receiver; larger payloads go to GCS with a reference URL | First time a multi-MB webhook arrives (e.g., Stripe batch payouts) |
| SSE subscribers for evolution dashboard all fan out from a single Pub/Sub subscription | SSE message backlog when many users are watching the dashboard | Per-connection subscription works at MVP scale; add a Redis pub/sub fan-out layer before multi-user scale | At ~50 concurrent dashboard viewers |
| Paperclip API called synchronously in every agent spawn | Spawn time grows linearly with concurrency; executions with 20 bots block for 20 serial Paperclip calls | Dispatch all bots in `Promise.all()` — Paperclip dispatches are independent and should run in parallel | At max_bots=20 with 500ms avg Paperclip latency (= 10 seconds sequential vs 0.5 seconds parallel) |
| `tool-definitions` fetched on every tool invocation for contract validation | Extra DB round-trip per tool call, compounds for agents making 10+ tool calls per task | Cache tool definitions in-memory with a TTL (contracts rarely change); invalidate on user update | Not a problem at MVP; becomes visible at 500+ concurrent tool invocations |
| Evolution dashboard fetches full agent lineage trees on load | Dashboard cold-load takes 5+ seconds for Artisan agents with deep lineage | Paginate lineage depth: show 3 generations by default, load deeper on demand | When any agent reaches generation 10+ (will happen within weeks of production) |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Injecting OAuth access tokens into agent session JWTs | Token exfiltration if agent is compromised — agent can call external APIs directly, bypassing Tool Gateway logging | Agents never receive credentials; Tool Gateway injects credentials server-side at invocation time only |
| Webhook receiver with no rate limiting | Any external service or attacker can flood the endpoint, exhausting BullMQ processing capacity | Per-source-IP rate limit at the Fastify middleware level; additionally rate-limit per tool connection (e.g., 1000 events/hour) |
| Custom tool contracts allow arbitrary HTTP targets | User registers a custom tool that proxies to an internal service (e.g., `http://10.0.0.3/admin`) — SSRF | Validate tool contract `baseUrl` against a blocklist of private IP ranges (RFC 1918) before saving |
| Paperclip session tokens logged in execution-service logs | Session tokens appear in Railway logs, accessible to anyone with log access | Redact all `Authorization: Bearer ...` headers and `sessionToken` fields before logging in paperclip-client.ts |
| Tool webhook HMAC secret stored unencrypted in env vars alongside the connection record | If a Railway environment export or log exposes the env var, all webhook secrets are compromised | Store HMAC secrets in `tool-connections.credentialData` using the same envelope encryption as OAuth tokens — never as plaintext env vars |
| Rate limit bypass via multiple tool connections to same service | User creates 5 HubSpot connections to get 5× the rate limit | Rate limits apply per external API domain, not per connection — aggregate rate tracking across all connections to the same service |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| OAuth connection flow opens in same tab | Back-button breaks the connection state; OAuth callback URL becomes unreachable if tab navigates away | Always open OAuth flow in a popup window or a new tab with `postMessage` back to parent on completion |
| Tool connection error shown only as "Connection failed" | User cannot diagnose whether it's a wrong API key, wrong scope, or network error | Show OAuth error codes and descriptions from the provider; for API key failures, show the HTTP status and the first line of the error body |
| Design system world toggle changes page state | User switches to Director's Cut mid-flow (e.g., while viewing evolution), page re-renders and loses their scroll position or open drawer | World toggle must be purely visual (CSS class swap) — no state is destroyed, no component is remounted |
| Evolution dashboard shows raw soul dimension text | Behavioral dimensions (e.g., "riskTolerance: I aggressively pursue novel approaches...") are internal language that means nothing to non-technical users | Always render soul summaries via the LLM-generated plain-language descriptions (FR-14), with raw SOUL.md accessible on demand only |
| Press Start 2P font used on tool connection status labels at 10px+ | Font is hard to read above 8px, contradicts design guide rule | Enforce the 8px maximum with a `font-size: clamp(6px, 0.5rem, 8px)` CSS rule in the design token system — making it impossible to misuse accidentally |
| Tool Belt shows all available tools, not the agent's active loadout | User confused about which tools the agent actually has access to in the current execution | Tool Belt has two modes: "Available" (browsable catalog) and "Active" (agent's current session grants) — always default to Active when viewed in agent context |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Paperclip client:** OAuth flow implemented but no token refresh — verify `refreshToken` is stored and `expiresAt` is checked before every call
- [ ] **Tool connection:** "Connected" badge shows but no dry-run test was performed — verify a real API call was made at connection time and succeeded
- [ ] **OpenAPI import:** Tool contract appears in catalog but was never live-tested — verify `verified: false` is set until a successful invocation flips it
- [ ] **Webhook receiver:** URL generated and shown to user but no HMAC verification implemented — verify signature validation is in place before any webhook is processed
- [ ] **Design system migration:** All routes render correctly in both Screenplay and Director's Cut worlds — verify `body.system` toggle on every route, not just new ones
- [ ] **Evolution dashboard:** Lineage tree renders for shallow agents but crashes for Artisan-class agents with deep lineage — verify pagination or depth limit is in place
- [ ] **Credential encryption:** `tool-connections.credentialData` is encrypted — verify decryption works after a Railway service restart (key loaded from env, not cached in memory from boot)
- [ ] **Agent dispatch to Paperclip:** Dispatch appears to succeed in unit tests (mocked) — verify against a real Paperclip instance in a staging environment
- [ ] **Bit rate metrics:** `effectiveBitRate` formula is wired to real agent composite scores — verify that agents with no completed runs don't distort the average (exclude from denominator)

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Paperclip dispatch idempotency not implemented, duplicate agents created | MEDIUM | Query Paperclip for duplicate sessions by idempotency key; terminate duplicates via Paperclip API; mark bot records with correct session ID; add idempotency keys going forward |
| OAuth tokens expired, tool connections broken | MEDIUM | Expose a `/tool-connections/:id/reconnect` endpoint that triggers fresh OAuth flow; send a fleet notification so user knows which connections need renewal |
| Design system tokens mixed (old + new coexist), visual regressions across routes | MEDIUM | Enumerate all token references with grep; map old-to-new; do a single-commit full replacement — do not attempt incremental cleanup under production traffic |
| Encryption key rotated, credential blobs undecryptable | HIGH | Notify affected users; trigger re-authentication flow for all tool connections; there is no automated recovery without the original key — document key backup procedure now |
| OpenAPI import stored invalid contracts that are now failing tool calls | LOW | Add `verified` flag check in tool invocation path — unverified contracts return a user-visible "Test your connection" prompt; reparse and re-verify the affected contracts |
| Webhook replay attacks flood BullMQ processing queue | LOW | Add Redis event-ID deduplication cache; clear the queue of duplicate jobs; rate-limit the affected webhook endpoint |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Paperclip client network error as agent loss | Paperclip integration phase (first phase) | Integration test: kill Paperclip mid-dispatch; verify bot transitions to `dispatch_pending` not `failed` |
| OAuth token expiry corrupts evolution signal | Tool Nexus — OAuth connection phase | Test with a manually-expired token; verify `credentialError` not `toolCallFailed` in invocation log |
| Design system zombie tokens | Design system foundation phase (must be first UI phase) | CI grep check: zero references to old token names in any file |
| OpenAPI import runtime failures | Tool Nexus — OpenAPI import phase | Import a known-bad spec; verify "test connection" gate rejects before saving |
| Webhook URL collision and replay attacks | Tool Nexus — webhook receiver phase | Delete and re-create a connection; verify old webhook URL is immediately rejected |
| Paperclip API contract drift | Paperclip integration phase | Add a type-generation script; run it against the live Paperclip spec; assert zero type diffs |
| Credential key rotation breaks all connections | Tool Nexus — credential storage phase (before any credential is written) | Simulate key version bump in dev; verify old credentials decrypt with version 1 key, new writes use version 2 |

---

## Sources

- Project tech debt backlog: `.planning/TECH-DEBT.md` — TD-01 (per-execution domain filtering) and TD-02–05 (type safety gaps) document the failure patterns that emerge when integration work is done incrementally
- `tasks/prd-akasa-mvp.md` FR-19 (credential injection pattern), FR-22 (webhook HMAC), FR-27 (OpenAPI import), FR-16 (Paperclip as runtime)
- `.planning/PROJECT.md` Known Issues section — OpenClaw WebSocket protocol unverified, composite score weights unvalidated (same class of "looks done but isn't" pattern applies to Paperclip integration)
- Existing codebase: `services/tool-gateway/src/routes/proxy.ts` — current CONNECT tunnel + domain allowlist implementation; the domain-filtering gap (TD-01) demonstrates the exact pattern of "feature looks complete but a critical wire was never connected"
- Design system precedent: v3.0 audit confirmed zero hardcoded hex across 13 routes — this must be the baseline, not the goal, for v6.0 migration

---
*Pitfalls research for: Akasa v6.0 — Paperclip integration, Tool Nexus with OAuth, Evolution Dashboard redesign*
*Researched: 2026-03-23*
