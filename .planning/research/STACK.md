# Technology Stack — v6.0 Paperclip Foundation

**Project:** Akasa — v6.0 Paperclip Foundation milestone
**Researched:** 2026-03-23
**Confidence:** MEDIUM (Paperclip API internals unverified; all other areas HIGH)
**Scope:** Stack ADDITIONS and changes only for v6.0. The validated existing stack is not re-evaluated.

---

## Existing Validated Stack (Do Not Re-Research)

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend framework | Fastify v5 + TypeBox | ^5.7.4 |
| Frontend | SvelteKit v2 + Svelte 5 runes | ^2.52.0 / ^5.51.3 |
| ORM | Drizzle ORM + node-postgres | ^0.45.1 |
| Database | PostgreSQL + pgvector | Cloud SQL at 10.101.0.3 |
| Queue | BullMQ + IORedis | ^5.69.3 / ^5.9.3 |
| LLM routing | Vercel AI SDK | ai ^6.0.90 |
| Events | GCP Pub/Sub + SSE | @google-cloud/pubsub ^5.2.3 |
| Auth | Auth.js v5 (@auth/sveltekit) | ^1.11.1 |
| Embeddings | text-embedding-3-small via @ai-sdk/openai | ^3.0.29 |
| Token auth | jose (JWE/JWT) | ^6.1.3 |

---

## Summary: Net New for v6.0

Three new capability domains:

1. **Paperclip HTTP API client** — typed fetch client for agent dispatch, session management, adapter selection, issue-backed communication, and WebSocket streaming
2. **Tool Nexus generalization** — OAuth 2.0 connection flows, encrypted credential storage, OpenAPI/Swagger import, webhook signature verification
3. **Evolution Dashboard** — self-hosted fonts, D3.js lineage trees, two-world CSS token system

**Net new packages:** 6–8 packages across execution-service, tool-gateway, and ui services.

---

## Domain 1: Paperclip API Client

### Recommendation: `got` ^14 for the HTTP client, native `ws` for WebSocket streaming

**Rationale for `got` over alternatives:**

Paperclip's API (Express, runs at `http://localhost:3100` in dev, Railway URL in production) is called from Node.js services only — never from the browser. `got` is the right choice for pure Node.js HTTP:

- Retry with exponential backoff built-in (critical: Paperclip agent dispatch may take several seconds to respond; retries prevent cascading failures)
- TypeScript-first with proper generic support for typed response bodies
- Streams first-class (supports Paperclip's streaming agent output)
- Actively maintained: ^14.x released 2024, widely used in Node.js backends
- `ky` is browser-oriented (wraps Fetch API); `got` is Node.js-native

`axios` is acceptable but adds no advantage over `got` for server-to-server calls and has known streaming quirks.

**Do NOT use native `fetch` for the Paperclip client.** Fetch in Node.js 22 is stable but lacks retry semantics and stream handling that are critical for Paperclip's agent execution endpoints. Building retry logic manually on top of fetch recreates `got`.

```bash
pnpm --filter @claw/execution-service add got
```

**WebSocket for Paperclip streaming events:** `ws ^8.18.0` is already installed. The Paperclip platform exposes a WebSocket endpoint (`/api/companies/{companyId}/events/ws`) for real-time agent output streaming. The existing `ws` package handles this without any addition. The pattern mirrors the existing `openclaw-client.ts`.

**Paperclip API surface (MEDIUM confidence — inferred from public docs and product description; exact endpoint paths need verification against a live instance):**

The Paperclip API runs at `http://localhost:3100/api/v1` (dev) or the Railway deployment URL (production). Based on the PRD's FR-38 through FR-43 and the Paperclip repo's README:

| Concern | Likely endpoint pattern | Notes |
|---------|------------------------|-------|
| Agent dispatch | `POST /api/v1/companies/:id/agents` | Creates an agent session |
| Session management | `GET/POST /api/v1/companies/:id/agents/:agentId/sessions` | Task-key continuity |
| Issue comments (Command Channel) | `POST /api/v1/companies/:id/issues/:issueId/comments` | Durable conversation record |
| WebSocket stream | `ws://.../api/companies/:id/events/ws` | Real-time agent output |
| Heartbeat/wakeup | `POST /api/v1/companies/:id/agents/:agentId/heartbeat` | Wakes agent with context |
| Adapter selection | Part of agent creation payload | `adapter: 'claude' | 'openclaw' | 'codex'` |

**BLOCKER: Verify actual endpoint paths before writing the client.** The `paperclip-client.ts` service must be built against a live Paperclip instance. The paths above are informed guesses from the README and PRD. The DEVELOPING.md was not accessible at research time.

**Pattern for `paperclip-client.ts`:**

```typescript
// services/execution-service/src/services/paperclip-client.ts
import got from 'got';

const paperclipHttp = got.extend({
  prefixUrl: process.env.PAPERCLIP_API_URL ?? 'http://localhost:3100',
  headers: { 'x-api-key': process.env.PAPERCLIP_API_KEY },
  retry: { limit: 3, methods: ['GET', 'POST'], statusCodes: [429, 503] },
  timeout: { request: 30_000 },
});

export async function dispatchAgent(
  companyId: string,
  payload: AgentDispatchPayload
): Promise<AgentSession> {
  return paperclipHttp
    .post(`api/v1/companies/${companyId}/agents`, { json: payload })
    .json<AgentSession>();
}
```

---

## Domain 2: Tool Nexus Generalization

### 2a. OAuth Connection Flows

**Recommendation: `simple-oauth2` ^5 for the OAuth client flows**

The Tool Nexus needs to handle OAuth 2.0 authorization code flows for services like HubSpot, Slack, Google Sheets, Stripe. `simple-oauth2` is a Node.js OAuth 2.0 client that wraps the auth code exchange, token refresh, and token persistence pattern without opinionated server framework coupling.

Why `simple-oauth2` over `@fastify/oauth2`:
- `@fastify/oauth2` is designed for authenticating your users into Akasa (which Auth.js already handles). The Tool Nexus needs to authenticate Akasa's services as OAuth clients to third-party APIs — a different concern.
- `simple-oauth2` ^5 provides `AuthorizationCode`, `ClientCredentials`, and `ResourceOwnerPassword` grant types. The authorization code flow is what HubSpot, Slack, etc. require.
- Actively maintained: ^5.1.0 published in 2024, 672 dependent packages

```bash
pnpm --filter @claw/execution-service add simple-oauth2
```

**Token storage pattern:** OAuth tokens (access + refresh) must be stored encrypted in the `tool_connections` table. Do NOT store plaintext tokens in the database. Use the AES-256-GCM pattern with `node:crypto` (see Domain 2b below).

**Token refresh pattern:** On every tool invocation, check token expiry before calling the external API. `simple-oauth2` provides `accessToken.expired()` and `accessToken.refresh()` for this. Implement a shared `getValidToken(connectionId)` helper that handles the refresh transparently.

### 2b. Credential Encryption

**Recommendation: `node:crypto` built-in — no external package**

OAuth tokens and API keys in `tool_connections` must be stored encrypted at rest. AES-256-GCM via `node:crypto` is the correct approach:

- Built into Node.js — no package dependency, no supply chain risk
- AES-256-GCM provides authenticated encryption (prevents undetected tampering)
- OWASP recommended for database column encryption in Node.js (2025)
- The encryption key comes from a `TOOL_ENCRYPTION_KEY` environment variable (32 bytes, base64-encoded)

**Do NOT use a third-party encryption package** (`aes-encryption`, `secrets-encrypt`, etc.) for this. The `node:crypto` module provides everything needed, and external packages introduce supply chain risk for a security-critical path.

```typescript
// packages/shared-types/src/utils/credential-crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.TOOL_ENCRYPTION_KEY!, 'base64');

export function encryptCredential(plaintext: string): string {
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store: iv (12B) + tag (16B) + ciphertext, all base64-encoded together
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptCredential(stored: string): string {
  const buf = Buffer.from(stored, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
```

### 2c. OpenAPI/Swagger Import

**Recommendation: `@apidevtools/swagger-parser` ^10 for spec parsing**

The Tool Nexus feature (US-016, FR-27) requires parsing an OpenAPI 3.0/3.1 or Swagger 2.0 spec URL or file to auto-generate tool contracts. `@apidevtools/swagger-parser` is the correct choice:

- Validates and dereferences `$ref` pointers (critical — most real OpenAPI specs use `$ref` extensively)
- Supports Swagger 2.0 and OpenAPI 3.0/3.1
- 672 dependent npm packages — battle-tested
- TypeScript types included

`@scalar/openapi-parser` is the modern successor but has fewer downloads and less ecosystem testing. Use `@apidevtools/swagger-parser` for reliability.

`openapi-typescript` is for code generation (TypeScript types from spec), not for runtime spec parsing. Do not use it here.

```bash
pnpm --filter @claw/tool-gateway add @apidevtools/swagger-parser
pnpm --filter @claw/tool-gateway add -D @types/swagger-parser
```

**Parsing pattern for tool contract generation:**

```typescript
import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPI } from 'openapi-types';

export async function importOpenApiSpec(specUrl: string): Promise<ToolContract[]> {
  // Validates + dereferences all $ref pointers
  const api = await SwaggerParser.dereference(specUrl) as OpenAPI.Document;
  return extractToolContracts(api); // maps paths → ToolContract[]
}
```

### 2d. Webhook Signature Verification

**Recommendation: `node:crypto` built-in — no external package**

Webhook signature verification (US-015, FR-22) uses HMAC-SHA256 — the universal standard (GitHub, Stripe, Shopify all use it). `node:crypto` provides `createHmac` and `timingSafeEqual`. No package needed.

Key implementation requirements (2025 best practice):
- Raw body buffer must be captured before JSON parsing — use Fastify's `addContentTypeParser` with `parseAs: 'buffer'` to get the raw bytes
- Always use `crypto.timingSafeEqual()` for signature comparison — prevents timing attacks
- Check timestamp header (if provided by sender) to reject replays older than 5 minutes

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  const expectedBuf = Buffer.from(`sha256=${expected}`, 'utf8');
  const actualBuf = Buffer.from(signature, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
```

---

## Domain 3: Evolution Dashboard & Design System

### 3a. Self-Hosted Fonts

**Recommendation: `@fontsource` packages — no Google Fonts CDN**

The design system requires Cormorant Garamond (display), DM Sans (body), and Press Start 2P (labels). Self-hosting via `@fontsource` packages is correct for production:

- Eliminates external CDN DNS lookup + TLS handshake (saves ~300ms on desktop, 1s+ on 3G)
- No GDPR/privacy concerns from third-party font loading
- Works offline in dev without network dependency
- Fontsource packages integrate directly with Vite (SvelteKit's bundler)

```bash
# Add to @claw/ui
pnpm --filter @claw/ui add @fontsource/cormorant-garamond
pnpm --filter @claw/ui add @fontsource-variable/dm-sans
pnpm --filter @claw/ui add @fontsource/press-start-2p
```

Note: Use `@fontsource-variable/dm-sans` (the variable font variant) for DM Sans — it covers all weights in a single file, reducing HTTP requests from ~6 weight files to 1.

**Usage in SvelteKit `+layout.svelte`:**

```typescript
import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource-variable/dm-sans/index.css';
import '@fontsource/press-start-2p/400.css';
```

### 3b. Lineage Tree Visualization

**Recommendation: `d3-hierarchy` ^3 (standalone submodule, not full `d3`)**

The Evolution Dashboard requires lineage tree visualization (agent archetype → mutations → current form) and timeline views. D3's `d3-hierarchy` module provides the `tree()` and `hierarchy()` layouts needed for these visualizations.

Use `d3-hierarchy` as a standalone package rather than the full `d3` bundle:
- Tree and hierarchy layouts only — no need for scales, axes, brush, zoom, etc. at this stage
- Smaller bundle: `d3-hierarchy` ~45KB vs full `d3` ~300KB
- Svelte 5 integration pattern: use `$effect()` to bind D3 layout calculations to reactive state; render as SVG in the Svelte template (not D3's DOM manipulation)

`@types/d3-hierarchy` provides full TypeScript types.

```bash
pnpm --filter @claw/ui add d3-hierarchy
pnpm --filter @claw/ui add -D @types/d3-hierarchy
```

**Integration pattern with Svelte 5 runes:**

```svelte
<script lang="ts">
  import { hierarchy, tree } from 'd3-hierarchy';
  import type { HierarchyNode } from 'd3-hierarchy';

  let { data }: { data: LineageNode } = $props();

  // D3 computes layout — Svelte renders the SVG declaratively
  const layout = $derived.by(() => {
    const root = hierarchy(data);
    const treeLayout = tree<LineageNode>().size([600, 400]);
    return treeLayout(root);
  });
</script>

<svg width="600" height="400">
  {#each layout.links() as link}
    <path d={linkPath(link)} stroke="var(--d-border)" fill="none" />
  {/each}
  {#each layout.descendants() as node}
    <g transform="translate({node.x},{node.y})">
      <circle r="6" fill="var(--d-vio)" />
      <text dy="-10" text-anchor="middle">{node.data.label}</text>
    </g>
  {/each}
</svg>
```

Do NOT use the full `d3` package for this. Do NOT use `svend3r` (adds a dependency layer without reducing complexity for custom tree layouts). The raw `d3-hierarchy` + Svelte SVG template approach is idiomatic and avoids React-oriented abstraction layers.

### 3c. CSS Token System (Two Worlds)

**Recommendation: Pure CSS custom properties in `app.css` — no CSS-in-JS, no design token libraries**

The two-world design system (Screenplay light + Director's Cut dark) is already partially implemented. The v6.0 design system requires a full token system expansion per `tasks/akasa-design-guide.md`.

**No new packages.** The existing pure CSS approach (`app.css` custom properties, `body.system` class scoping) is the correct architecture. Do NOT introduce:
- Tailwind CSS — conflicts with the bespoke token system and would require migrating existing CSS
- CSS modules — the existing scoped `<style>` blocks in Svelte already provide component isolation
- Design token libraries (Style Dictionary, Theo) — overkill for a two-theme single-product system

The required tokens are specified in `tasks/akasa-design-guide.md` and should be extended in the existing `services/ui/src/app.css`.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `axios` for Paperclip client | No advantage over `got` for Node.js server-to-server; worse streaming | `got ^14` |
| `node-fetch` | Deprecated in favor of native fetch in Node.js 22; lacks retry | `got ^14` |
| `@fastify/oauth2` for Tool Nexus | Designed for user auth, not third-party API OAuth | `simple-oauth2 ^5` |
| `passport` + OAuth strategies | Heavy framework; adds Express-style middleware pattern incompatible with Fastify | `simple-oauth2 ^5` |
| `@scalar/openapi-parser` | Modern but lower adoption than `@apidevtools/swagger-parser` | `@apidevtools/swagger-parser ^10` |
| `openapi-typescript` | Code generation, not runtime parsing | `@apidevtools/swagger-parser ^10` |
| Full `d3` bundle | 300KB for tree layout that only needs `d3-hierarchy` (45KB) | `d3-hierarchy ^3` |
| `svend3r` / `chart.js` / `apexcharts` | Abstract away the layout computation that must be custom | `d3-hierarchy ^3` + Svelte SVG |
| Tailwind CSS | Conflicts with existing pure CSS token system; requires migration | Pure CSS custom properties |
| Google Fonts CDN | External DNS, GDPR exposure, 300ms latency penalty | `@fontsource/*` packages |
| External encryption packages (`aes-encryption`, etc.) | Supply chain risk for security-critical path | `node:crypto` built-in |
| LangChain / LangGraph | Not needed for Council (existing generateObject() pattern) | Existing Vercel AI SDK |

---

## Installation Summary

```bash
# execution-service: Paperclip client + OAuth connections
pnpm --filter @claw/execution-service add got simple-oauth2

# tool-gateway: OpenAPI import
pnpm --filter @claw/tool-gateway add @apidevtools/swagger-parser
pnpm --filter @claw/tool-gateway add -D @types/swagger-parser

# ui: fonts + D3 tree layout
pnpm --filter @claw/ui add @fontsource/cormorant-garamond @fontsource-variable/dm-sans @fontsource/press-start-2p
pnpm --filter @claw/ui add d3-hierarchy
pnpm --filter @claw/ui add -D @types/d3-hierarchy
```

**No new packages needed for:**
- Webhook signature verification (node:crypto)
- Credential encryption (node:crypto)
- CSS design token system (existing app.css pattern)
- WebSocket streaming from Paperclip (existing `ws ^8.18.0`)
- Council LLM calls (existing Vercel AI SDK)

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `got` | `^14` | Node.js 18+, ESM | ESM-only package — matches existing `"type": "module"` in package.json |
| `simple-oauth2` | `^5.1.0` | Node.js 18+, ESM | ESM-compatible |
| `@apidevtools/swagger-parser` | `^10` | Node.js 12+, CJS+ESM | Has CJS interop; works with ESM via named import |
| `d3-hierarchy` | `^3` | Browser + Node.js, ESM | ESM module — works in Vite/SvelteKit |
| `@fontsource/*` | latest | Vite 6 | Import CSS directly in +layout.svelte |

**Critical ESM note:** All services use `"type": "module"`. `got ^14` is ESM-only, which is correct. If any of these packages show CJS-only errors at runtime, add them to the `vite.config.ts` `ssr.noExternal` list.

---

## Integration Points with Existing Stack

| New Capability | Integrates With | Pattern |
|----------------|----------------|---------|
| Paperclip client (`got`) | `execution-service` routes for agent dispatch | `services/paperclip-client.ts` — singleton `got.extend()` instance with auth headers |
| OAuth token storage | `tool_connections` DB table | Encrypt with `node:crypto` before `INSERT`; decrypt in `getValidToken()` helper |
| OAuth refresh | `tool-gateway` tool invocation path | `getValidToken()` checks `accessToken.expired()`, refreshes, re-persists encrypted token |
| OpenAPI import | `tool-gateway` POST `/tools/import` route | `SwaggerParser.dereference(url)` → extract path objects → create `ToolContract` rows |
| Webhook receiver | `tool-gateway` POST `/webhooks/:toolId/:userId` | Raw body buffer → `verifyWebhookSignature()` → route to BullMQ job for agent dispatch |
| Font imports | `services/ui/src/routes/+layout.svelte` | Import CSS at top level — Vite bundles and hashes font files |
| Lineage tree | `services/ui/src/lib/components/evolution/LineageTree.svelte` | `d3-hierarchy` layout computed in `$derived.by()`; rendered as declarative SVG |
| CSS design tokens | `services/ui/src/app.css` | Extend existing 28-token system with Screenplay + Director's Cut tokens from design guide |

---

## Open Questions (Verify Before Shipping)

1. **Paperclip endpoint paths (BLOCKER)** — The exact API routes (`/api/v1/...` vs `/api/...`, endpoint names, request/response shapes) must be verified against a running Paperclip instance before writing `paperclip-client.ts`. Check `claw-paper-clip` repo's `server/` directory or `doc/DEVELOPING.md`. All Paperclip-dependent features block on this.

2. **Paperclip auth mechanism** — Does Paperclip use API key headers, JWT, or another auth scheme for its REST API? The `PAPERCLIP_API_KEY` env var pattern above is assumed; verify the actual auth mechanism.

3. **`got ^14` ESM in execution-service** — `got` is ESM-only. Verify the execution-service `tsx` dev runner handles this correctly with the `@claw/source` export condition active. Likely fine but worth a quick smoke test.

4. **`@apidevtools/swagger-parser` CJS interop** — The package has CJS internals with an ESM entry point. If it fails in the tool-gateway ESM context, use a dynamic `import()` wrapper or switch to `@readme/openapi-parser` (the maintained fork with better ESM support).

5. **`tool_connections` encryption key rotation** — The `TOOL_ENCRYPTION_KEY` env var must be rotated carefully — rotating it invalidates all stored encrypted credentials. Plan a migration strategy before v6.0 ships (even if execution is deferred).

---

## Sources

- [got npm](https://www.npmjs.com/package/got) — MEDIUM confidence (verified active, ^14 ESM-only)
- [simple-oauth2 npm](https://www.npmjs.com/package/simple-oauth2) — MEDIUM confidence (^5 verified, 672 dependents)
- [@apidevtools/swagger-parser npm](https://www.npmjs.com/package/@apidevtools/swagger-parser) — HIGH confidence (672 dependents, actively maintained)
- [d3-hierarchy docs](https://d3js.org/d3-hierarchy/tree) — HIGH confidence (official D3 docs)
- [@fontsource/cormorant-garamond npm](https://www.npmjs.com/package/@fontsource/cormorant-garamond) — HIGH confidence
- [@fontsource-variable/dm-sans npm](https://www.npmjs.com/package/@fontsource-variable/dm-sans) — HIGH confidence
- [@fontsource/press-start-2p npm](https://www.npmjs.com/package/@fontsource/press-start-2p) — HIGH confidence
- [Node.js crypto AES-256-GCM pattern](https://nodejs.org/api/crypto.html) — HIGH confidence (built-in, no version uncertainty)
- [Paperclip GitHub README](https://github.com/paperclipai/paperclip) — MEDIUM confidence (API base URL confirmed, endpoint paths inferred)
- [OWASP Node.js Crypto Best Practices](https://www.nodejs-security.com/blog/owasp-nodejs-authentication-authorization-cryptography-practices) — HIGH confidence
- [Webhook HMAC-SHA256 best practices](https://hookdeck.com/webhooks/guides/how-to-implement-sha256-webhook-signature-verification) — HIGH confidence
- Codebase review: `services/execution-service/package.json`, `services/tool-gateway/package.json`, `services/ui/package.json`, `tasks/prd-akasa-mvp.md`, `tasks/akasa-design-guide.md` — HIGH confidence

---

*Stack research for: Akasa v6.0 Paperclip Foundation*
*Researched: 2026-03-23*
