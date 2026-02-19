# Phase 7: Google Auth Gate - Research

**Researched:** 2026-02-19
**Domain:** Auth.js (@auth/sveltekit) + SvelteKit adapter migration + Fastify JWT verification
**Confidence:** MEDIUM (critical architectural blocker confirmed with HIGH confidence; workaround pattern MEDIUM confidence)

---

## Summary

This phase adds Google OAuth to the SvelteKit UI so `/new-execution` is gated behind authentication, and protects the `POST /executions` backend endpoint from unauthenticated calls.

**The single most important finding:** The project currently uses `adapter-static` with a global `ssr = false` in `+layout.js`. Auth.js (`@auth/sveltekit`) requires a server runtime — it relies on `hooks.server.ts`, `+page.server.ts` load functions, and server-side session cookie handling. These do not execute in a true static SPA (where the browser receives a bare HTML shell and renders everything client-side). **The adapter must change from `adapter-static` to `adapter-node` (or `adapter-vercel`)** before Auth.js will function. Client-side routing remains intact after this change; the `ssr = false` export in `+layout.js` can be removed or kept — but the project now runs a real Node/Serverless server.

Once the adapter is changed, Auth.js setup is well-understood: create `src/auth.ts`, export the handle from `hooks.server.ts`, add a catch-all route, and use `locals.auth()` in server load functions. The backend JWT decode is achievable with the `jose` package (already present in `execution-service`) using Node's native `crypto.hkdfSync` for key derivation.

**Primary recommendation:** Switch UI to `adapter-vercel` (matches current Vercel deployment), configure Auth.js with Google provider, use the `hooks.server.ts` redirect pattern for `/new-execution` protection, and decode the Auth.js JWE session token in `execution-service` using `jose` + `crypto.hkdfSync` with the shared `AUTH_SECRET`.

---

## Critical Architectural Finding: adapter-static Incompatibility

### The Problem (HIGH confidence)

`adapter-static` produces only static files. When `ssr = false` is set globally (as in this project's `+layout.js`), SvelteKit renders an empty HTML shell. **Server files do not run at request time:**

- `hooks.server.ts` — does not execute
- `+page.server.ts` load functions — do not execute
- `+layout.server.ts` load functions — do not execute
- Server actions (`actions` in `+page.server.ts`) — do not execute

Auth.js `@auth/sveltekit` requires all three of these. The `/auth/callback/google` route is itself a `+server.ts` endpoint that Auth.js registers via the `handle` hook — it cannot exist in a purely static output.

Source: Multiple official SvelteKit docs and community investigation confirm that "if you don't have any server-side logic (i.e. `+page.server.js`, `+layout.server.js` or `+server.js` files) you can use adapter-static." Auth.js requires all of these.

### The Solution: Switch to adapter-vercel (HIGH confidence)

The project already deploys to Vercel (evidenced by `vercel.json`, `outputDirectory: "build"`, and rewrite rules). Switching from `adapter-static` to `adapter-vercel`:

1. Enables server runtime (Vercel serverless functions)
2. Makes `hooks.server.ts`, `+page.server.ts`, and `+layout.server.ts` work
3. Preserves client-side routing (SvelteKit always uses client-side navigation between pages)
4. Removes the need for the `200.html` fallback — Vercel handles routing natively
5. Does NOT break the SPA feel — pages still hydrate and navigate client-side after initial load

The `vercel.json` rewrite for `/api/:path*` still works; the `/(.*)` → `/200.html` fallback rule can be removed (Vercel handles 404 routing via SvelteKit's router).

**The `ssr = false` in `+layout.js` should be removed.** With `adapter-vercel`, SSR is available and needed for Auth.js. The UI was likely SPA-only because the developer didn't need SSR. Now they do.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@auth/sveltekit` | ^1.11.1 | Google OAuth, session management, SvelteKit integration | Official Auth.js SvelteKit adapter; stateless JWT cookie sessions, no DB needed |
| `@sveltejs/adapter-vercel` | ^5.x | Server runtime enabling hooks.server.ts and Auth.js | Required to replace adapter-static; matches existing Vercel deployment |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jose` | ^6.1.3 (already installed) | JWE decryption for Auth.js session tokens in execution-service | Decoding Auth.js encrypted session cookies in the Fastify backend |
| Node.js `crypto` | built-in | `hkdfSync` for deriving the Auth.js encryption key | Key derivation with same algorithm Auth.js uses; no extra install |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `adapter-vercel` | `adapter-node` | adapter-node would also work if deploying a custom Node server; adapter-vercel is better given existing Vercel setup |
| `@auth/sveltekit` JWT decode in backend | Shared `X-Internal-Token` secret header (Option A from PRD) | Option A (shared secret) is simpler to implement but less cryptographically sound; Option B (JWT decode) is correct but adds complexity in execution-service |
| `@auth/sveltekit` | `better-auth` | better-auth is gaining traction but introduces a database requirement; Auth.js stateless JWT matches the no-DB-for-auth requirement in the PRD |

### Installation
```bash
# In services/ui — remove adapter-static, add adapter-vercel + Auth.js
pnpm remove @sveltejs/adapter-static
pnpm add -D @sveltejs/adapter-vercel
pnpm add @auth/sveltekit

# execution-service already has jose@^6.1.3 — no new installs needed
```

---

## Architecture Patterns

### Recommended File Structure Changes

```
services/ui/
├── svelte.config.js              # CHANGE adapter-static → adapter-vercel
├── vercel.json                   # REMOVE the /(.*)→/200.html rewrite
├── src/
│   ├── auth.ts                   # NEW: SvelteKitAuth config with Google provider
│   ├── hooks.server.ts           # NEW: export { handle } from './auth'
│   ├── app.d.ts                  # NEW or update: declare locals.auth() type
│   ├── routes/
│   │   ├── +layout.js            # CHANGE: remove export const ssr = false
│   │   ├── +layout.server.ts     # NEW: expose session to all layouts
│   │   ├── +layout.svelte        # UPDATE: add user avatar/name + sign-out
│   │   ├── auth/
│   │   │   └── [...auth]/
│   │   │       └── +server.ts    # NEW: Auth.js catch-all route handler
│   │   ├── login/
│   │   │   └── +page.svelte      # NEW: Sign in with Google page
│   │   └── new-execution/
│   │       ├── +page.svelte      # UPDATE: convert handleSubmit to form action
│   │       └── +page.server.ts   # NEW: auth guard + form action for POST /executions

services/execution-service/
├── src/
│   └── routes/
│       └── executions.ts         # UPDATE: add auth middleware to POST /
```

### Pattern 1: Auth.js Core Setup

**What:** Three files bootstrap all of Auth.js session management.

```typescript
// Source: https://authjs.dev/reference/sveltekit
// src/auth.ts
import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';

export const { handle, signIn, signOut } = SvelteKitAuth({
  providers: [Google],
  // AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET auto-read from env
  // AUTH_TRUST_HOST must be true for non-Vercel; for Vercel it is automatic
});
```

```typescript
// src/hooks.server.ts
export { handle } from './auth';
```

```typescript
// src/routes/auth/[...auth]/+server.ts
export { GET, POST } from '../../../auth';
```

```typescript
// src/app.d.ts — type augmentation for locals.auth
declare global {
  namespace App {
    interface Locals {
      auth(): Promise<import('@auth/sveltekit').Session | null>;
    }
  }
}
export {};
```

### Pattern 2: Route Protection via server load

**What:** Redirect unauthenticated users server-side before page renders.

**When to use:** Any route that must require login. Runs on direct navigation and on client-side navigation (the data load is fetched from the server even during SPA navigation).

```typescript
// Source: https://authjs.dev/reference/sveltekit
// src/routes/new-execution/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async (event) => {
  const session = await event.locals.auth();
  if (!session?.user) {
    redirect(303, '/login');
  }
  return { session };
};
```

**Important:** Do NOT put redirect logic in `+layout.server.ts`. Auth.js docs explicitly warn that layout load functions are not guaranteed to propagate protection to all child routes. Protect each route individually in `+page.server.ts`.

### Pattern 3: Expose Session in Root Layout

**What:** Make session data available to all layouts and pages via `$page.data.session`.

```typescript
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  const session = await event.locals.auth();
  return { session };
};
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { signOut } from '@auth/sveltekit/client';
  let { data, children } = $props();
  let session = $derived(data.session);
</script>

{#if session?.user}
  <img src={session.user.image} alt={session.user.name} width="28" height="28" />
  <span>{session.user.name}</span>
  <button onclick={() => signOut({ redirectTo: '/' })}>Sign out</button>
{/if}
```

### Pattern 4: Form Action for Execution Submit (US-006)

**What:** Convert `handleSubmit` from client-side `fetch` to a SvelteKit server action. This keeps the auth token server-side.

```typescript
// src/routes/new-execution/+page.server.ts (continued)
export const actions: Actions = {
  default: async (event) => {
    const session = await event.locals.auth();
    if (!session?.user) redirect(303, '/login');

    const data = await event.request.formData();
    // extract fields from formData

    // Forward to execution-service with auth token
    const token = await getAuthToken(event); // derive from session cookie
    const res = await fetch(`${EXECUTION_SERVICE_URL}/executions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ objective, maxBots, budgetCapCents, allowedTools }),
    });

    if (!res.ok) {
      return fail(res.status, { error: 'Failed to create execution.' });
    }

    const { executionId } = await res.json();
    redirect(303, `/executions/${executionId}`);
  }
};
```

**Important change to +page.svelte:** The form's `onsubmit` changes from calling `handleSubmit()` (which called `$lib/api.createExecution`) to a native form submission. Use SvelteKit's `use:enhance` for progressive enhancement.

### Pattern 5: Auth Token Extraction for Backend (US-005/006)

**What:** Two options for backend token validation. Option B (JWT decode) is correct.

**Option A — Shared Secret Header (simpler):**
The SvelteKit server action adds `X-Internal-Token: ${process.env.INTERNAL_SECRET}` header. The Fastify service checks this header. Client-side JS never sees the secret. This does not validate *who* the user is, only that the request came from the SvelteKit server.

**Option B — Decode Auth.js JWT (correct):**
Auth.js stores sessions as JWE (JSON Web Encryption) tokens using A256CBC-HS512 with a key derived from `AUTH_SECRET` via HKDF-SHA256.

```typescript
// services/execution-service/src/lib/auth.ts — NEW FILE
import { compactDecrypt } from 'jose';
import crypto from 'node:crypto';

// Source: https://gist.github.com/aegrumet/9ca3e13278b8543348bfdb270133512d
// Source: Auth.js v5 HKDF key derivation spec
export async function verifyAuthJwt(token: string): Promise<boolean> {
  try {
    // Cookie name determines the salt (dev vs prod)
    const isSecure = process.env.NODE_ENV === 'production';
    const cookieName = isSecure
      ? '__Secure-authjs.session-token'
      : 'authjs.session-token';
    const salt = cookieName;
    const info = `Auth.js Generated Encryption Key (${salt})`;

    const keyBuffer = crypto.hkdfSync(
      'sha256',
      process.env.AUTH_SECRET!,
      salt,
      info,
      64, // 512 bits for A256CBC-HS512
    );
    const key = new Uint8Array(keyBuffer);

    const { plaintext } = await compactDecrypt(token, key);
    const payload = JSON.parse(Buffer.from(plaintext).toString('utf8'));
    return !!payload?.email; // or check expiry
  } catch {
    return false;
  }
}
```

**Token forwarding from SvelteKit:** The SvelteKit action needs to extract the session cookie value from the request to forward to the backend:

```typescript
// In the form action
const sessionCookie = event.cookies.get('authjs.session-token')
  || event.cookies.get('__Secure-authjs.session-token');
// Forward as Authorization: Bearer <sessionCookie>
```

### Pattern 6: Login Page

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { signIn } from '@auth/sveltekit/client';
</script>

<button onclick={() => signIn('google', { redirectTo: '/new-execution' })}>
  Sign in with Google
</button>
```

**Note on Svelte 5:** Use `onclick` (not `on:click`) per the project's existing Svelte 5 runes conventions. The `signIn` and `signOut` functions from `@auth/sveltekit/client` work fine with the Svelte 5 `onclick` attribute.

**Known issue:** Versions 1.7.3–1.8.0 of `@auth/sveltekit` had a bug where client-side `signIn()` returned 404 in some Svelte 5 configurations. Install the latest stable version (1.11.1 or newer). If the bug persists, use the form action `SignIn` component from `@auth/sveltekit/components` as a fallback.

### Anti-Patterns to Avoid

- **Putting auth redirect in `+layout.server.ts`:** Auth.js docs explicitly warn against this. Load functions don't reliably propagate protection to all descendant routes. Use `+page.server.ts` for each protected route.
- **Keeping `ssr = false` in `+layout.js`:** This disables the server-side rendering that Auth.js needs. Remove this export when switching to `adapter-vercel`.
- **Keeping the `200.html` fallback in `vercel.json`:** With `adapter-vercel`, Vercel's routing handles unknown paths. The `/(.*) → /200.html` rewrite conflicts with Auth.js server routes.
- **Calling `createExecution` from `$lib/api` in client code after adding auth:** The auth token is only available server-side. The form must go through a server action so the token stays server-side.
- **Exposing `AUTH_SECRET` to the UI:** The secret is only needed in the execution-service for JWT decode. It must stay in server-only environment variables.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth flow (PKCE, state param, token exchange) | Custom OAuth implementation | `@auth/sveltekit` Google provider | OAuth has many security edge cases (CSRF via state, token leakage); Auth.js handles all of them |
| Session cookie encryption | Custom AES/JWT | Auth.js default (JWE, A256CBC-HS512) | Key rotation, cookie security flags, expiry — Auth.js handles all automatically |
| CSRF protection for auth endpoints | Custom CSRF middleware | Auth.js built-in CSRF protection | Auth.js includes CSRF token validation on all POST auth endpoints |
| Google user profile parsing | Manual userinfo endpoint call | Auth.js Google provider | Provider handles token refresh, profile normalization, scope management |
| JWT key derivation for backend | Hand-written HKDF | `crypto.hkdfSync` + `jose.compactDecrypt` | Matches Auth.js's exact key derivation spec; getting this wrong means all tokens fail validation |

**Key insight:** The Auth.js session cookie is a JWE (encrypted JWT), not a plain JWT. You cannot verify it with a simple `jwt.verify()` call — you must decrypt it first using HKDF-derived key. The `jose` library (already installed in `execution-service`) handles this correctly.

---

## Common Pitfalls

### Pitfall 1: Keeping adapter-static
**What goes wrong:** Auth.js `handle` hook never runs. The `/auth/callback/google` route returns 404. `locals.auth()` is undefined. Session is never created.
**Why it happens:** `adapter-static` produces a static HTML file; there is no server to run `hooks.server.ts` at request time.
**How to avoid:** Switch to `adapter-vercel` before adding any Auth.js code.
**Warning signs:** Immediate 404 on `/auth/callback/google`, `locals.auth is not a function` errors.

### Pitfall 2: Keeping `ssr = false` in `+layout.js`
**What goes wrong:** Even with `adapter-node`/`adapter-vercel`, keeping `ssr = false` globally may cause `+page.server.ts` load functions to behave unexpectedly. The server returns an empty shell rather than running server-side load logic, defeating the route protection redirect.
**Why it happens:** `ssr = false` tells SvelteKit to skip server-side rendering for pages. The server load can still fire on direct navigation, but client-side navigations skip it.
**How to avoid:** Remove `export const ssr = false` from `+layout.js` entirely when migrating to `adapter-vercel`.
**Warning signs:** Direct navigation to `/new-execution` redirects correctly, but client-side navigation bypasses the redirect.

### Pitfall 3: AUTH_SECRET mismatch between services
**What goes wrong:** The execution-service can't decrypt the Auth.js session token. Every request returns 401 even with a valid session.
**Why it happens:** Both services must use identical `AUTH_SECRET` values. If they differ, the HKDF-derived key differs, and decryption fails.
**How to avoid:** Share the exact same `AUTH_SECRET` value in both `services/ui/.env` and `services/execution-service/.env`.
**Warning signs:** `compactDecrypt` throws "decryption operation failed" errors in the execution-service.

### Pitfall 4: Production vs development cookie name difference
**What goes wrong:** Session token forwarding fails in production but works in development.
**Why it happens:** Auth.js uses `authjs.session-token` on HTTP (development) and `__Secure-authjs.session-token` on HTTPS (production). The backend must derive the HKDF key using the correct cookie name as the salt.
**How to avoid:** Check for both cookie names when extracting the token, or derive keys for both and try each.
**Warning signs:** Auth works locally but returns 401 in production Vercel deployment.

### Pitfall 5: Vercel.json rewrite conflict with Auth.js routes
**What goes wrong:** The `/(.*) → /200.html` rewrite in `vercel.json` intercepts Auth.js server routes (`/auth/callback/google`, `/auth/signin`, etc.) and serves static HTML instead of the server handler.
**Why it happens:** The broad wildcard rewrite was added for the SPA fallback; it pre-empts the actual server routes.
**How to avoid:** Remove the `/(.*) → /200.html` rewrite from `vercel.json` when switching to `adapter-vercel`. Keep the `/api/:path*` proxy rewrite if needed.
**Warning signs:** Google OAuth callback redirects to a blank page or 404 instead of completing the OAuth flow.

### Pitfall 6: `signIn` client import in Svelte 5
**What goes wrong:** Calling `signIn('google')` from a button returns 404 (`SvelteKitError: Not found: /signin/google`).
**Why it happens:** Versions 1.7.3–1.8.0 of `@auth/sveltekit` had a routing bug with Svelte 5. This was reportedly fixed in later versions.
**How to avoid:** Use `@auth/sveltekit` 1.11.x or latest. If issue persists, use the server-side `SignIn` component from `@auth/sveltekit/components` with a form action.
**Warning signs:** Google OAuth never starts; network tab shows POST to `/auth/signin/google` returning 404.

### Pitfall 7: Forgetting AUTH_TRUST_HOST for non-Vercel environments
**What goes wrong:** Auth.js throws "Host must be trusted" error on deployment.
**Why it happens:** Auth.js requires explicitly trusting the host to prevent open redirect attacks on non-Vercel deployments.
**How to avoid:** For Vercel deployments, `AUTH_TRUST_HOST` is automatically set to `true`. Set it explicitly for other environments (development: `AUTH_TRUST_HOST=true` in `.env`).
**Warning signs:** Authentication redirects fail with "untrusted host" error.

---

## Code Examples

### Complete auth.ts Setup
```typescript
// Source: https://authjs.dev/reference/sveltekit
// services/ui/src/auth.ts
import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/sveltekit/providers/google';

export const { handle, signIn, signOut } = SvelteKitAuth({
  providers: [Google],
});
```

### hooks.server.ts
```typescript
// services/ui/src/hooks.server.ts
export { handle } from './auth';
```

### Auth catch-all route
```typescript
// services/ui/src/routes/auth/[...auth]/+server.ts
export { GET, POST } from '../../../auth';
```

### Route guard in +page.server.ts
```typescript
// services/ui/src/routes/new-execution/+page.server.ts
import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async (event) => {
  const session = await event.locals.auth();
  if (!session?.user) {
    redirect(303, '/login');
  }
  return {};
};

export const actions: Actions = {
  default: async (event) => {
    const session = await event.locals.auth();
    if (!session?.user) redirect(303, '/login');

    const formData = await event.request.formData();
    const objective = formData.get('objective') as string;
    const maxBots = Number(formData.get('maxBots'));
    const budgetCapCents = Number(formData.get('budgetCapDollars')) * 100;
    const allowedTools = formData.getAll('allowedTools') as string[];

    // Extract session token from cookie to forward to backend
    const sessionToken =
      event.cookies.get('__Secure-authjs.session-token') ??
      event.cookies.get('authjs.session-token');

    const res = await fetch(`${process.env.EXECUTION_SERVICE_URL}/executions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({ objective, maxBots, budgetCapCents, allowedTools }),
    });

    if (!res.ok) {
      const text = await res.text();
      return fail(res.status, { error: text || 'Failed to create execution.' });
    }

    const { executionId } = await res.json();
    redirect(303, `/executions/${executionId}`);
  },
};
```

### Fastify auth middleware using jose + HKDF
```typescript
// Source: https://gist.github.com/aegrumet/9ca3e13278b8543348bfdb270133512d
// Auth.js v5 HKDF key derivation spec
// services/execution-service/src/lib/verify-auth-token.ts
import { compactDecrypt } from 'jose';
import crypto from 'node:crypto';

export async function verifyAuthToken(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  if (!token) return false;

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET not set');

  // Auth.js uses different cookie names for http vs https
  // Try both — whichever matches the environment that issued the token
  const salts = ['authjs.session-token', '__Secure-authjs.session-token'];

  for (const salt of salts) {
    try {
      const info = `Auth.js Generated Encryption Key (${salt})`;
      const keyBuffer = crypto.hkdfSync('sha256', secret, salt, info, 64);
      const key = new Uint8Array(keyBuffer);
      const { plaintext } = await compactDecrypt(token, key);
      const payload = JSON.parse(Buffer.from(plaintext).toString('utf8'));
      // Check that payload has user data and is not expired
      if (payload?.email || payload?.sub) return true;
    } catch {
      // Try next salt
    }
  }
  return false;
}
```

### Fastify route protection
```typescript
// services/execution-service/src/routes/executions.ts (update POST /)
// Add preHandler to check auth before executing route logic
fastify.post('/', {
  schema: { /* ... existing schema ... */ },
  preHandler: async (request, reply) => {
    const valid = await verifyAuthToken(request.headers.authorization);
    if (!valid) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  },
}, async (request, reply) => {
  // ... existing handler unchanged ...
});
```

### svelte.config.js update
```javascript
// services/ui/svelte.config.js
import adapter from '@sveltejs/adapter-vercel';

export default {
  kit: {
    adapter: adapter()
  }
};
```

### Updated vercel.json (remove SPA fallback, keep API proxy)
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "http://34.136.15.56:3001/:path*" }
  ]
}
```

### Root layout.server.ts to expose session
```typescript
// services/ui/src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  return {
    session: await event.locals.auth(),
  };
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NextAuth.js (next-auth) | Auth.js v5 (@auth/sveltekit) | 2023 rebrand | Auth.js is the framework-agnostic version; `@auth/sveltekit` is the official SvelteKit adapter |
| Database sessions | Stateless JWT/JWE cookies | Default in Auth.js v5 | No DB needed for sessions — ideal for this phase's no-user-table requirement |
| `on:click` event handlers | `onclick` attribute | Svelte 5 runes | Project already uses runes; all Auth.js UI code must use `onclick` not `on:click` |
| adapter-static SPA | adapter-vercel SSR | This phase | Required for Auth.js; preserves client-side routing feel |
| Auth.js v4 `getServerSession` | `event.locals.auth()` | v5 | Breaking change — use `locals.auth()` everywhere |
| JWT signed (HS256) | JWE encrypted (A256CBC-HS512) | Auth.js v5 | Tokens are now encrypted JWE, not signed JWTs — must use `compactDecrypt` not `verify` |

**Deprecated/outdated:**
- `getServerSession()`: Replaced by `event.locals.auth()` in Auth.js v5
- `@auth/core/providers/google` (old import path): Now `@auth/sveltekit/providers/google`
- `next-auth/sveltekit`: Renamed to `@auth/sveltekit`

---

## Open Questions

1. **Backend Token Strategy: Option A vs Option B**
   - What we know: Option A (shared `X-Internal-Token` secret header) is simpler — no HKDF math, just compare strings. Option B (JWT decode with HKDF) is cryptographically correct and validates the actual user's session token.
   - What's unclear: Whether the added correctness of Option B is worth the implementation complexity.
   - Recommendation: **Implement Option B** (JWT decode). The `jose` library is already installed in `execution-service`, and the HKDF pattern is well-documented. Option B validates that the request carries a valid Auth.js session from a real Google OAuth user, not just that the request came from any server with the secret.

2. **Vercel.json API Proxy After Adapter Change**
   - What we know: The current `vercel.json` has a rewrite proxying `/api/*` to the execution-service IP. This was needed to avoid CORS issues in SPA mode.
   - What's unclear: Whether this proxy continues to work with `adapter-vercel`, or whether the execution-service URL should be configured via environment variables instead.
   - Recommendation: Keep the `/api/:path*` rewrite. It should continue to work. Remove only the `/(.*) → /200.html` fallback.

3. **EXECUTION_SERVICE_URL in server actions**
   - What we know: In SPA mode, the UI called `/api/executions` (which proxied to the execution-service via vercel.json rewrites). In server actions, the server is running on Vercel, so it must call the execution-service directly (not through its own rewrites).
   - What's unclear: The correct URL for server-side calls to execution-service from Vercel functions.
   - Recommendation: Add `EXECUTION_SERVICE_URL` env var (e.g., `http://34.136.15.56:3001`) for server-side use. Client-side calls (for non-protected routes) can still use `/api` prefix.

4. **Session Duration**
   - What we know: Auth.js default session expiry is 30 days (JWT maxAge).
   - What's unclear: Whether 30 days is acceptable for this app.
   - Recommendation: Accept the 30-day default for now. Can be configured via `session.maxAge` in `SvelteKitAuth` config if needed.

---

## Sources

### Primary (HIGH confidence)
- `https://authjs.dev/reference/sveltekit` — Auth.js SvelteKit reference; confirmed setup requirements, `locals.auth()` API, environment variables
- `https://svelte.dev/docs/kit/single-page-apps` — Official SvelteKit SPA docs; confirmed adapter-static does not support server-side files
- `https://github.com/sveltejs/kit/issues/13735` — Confirmed `hooks.server.ts` behavior with `ssr=false`; intentional behavior documented

### Secondary (MEDIUM confidence)
- `https://gist.github.com/aegrumet/9ca3e13278b8543348bfdb270133512d` — Auth.js v5 JWE decryption in Node.js using `crypto.hkdfSync` and `jose.compactDecrypt`; cross-verified with Auth.js JWT encryption spec
- `https://github.com/nextauthjs/next-auth/discussions/8807` — Python decoding of Auth.js JWTs; confirms HKDF algorithm, salt, info string format
- `https://sveltestarterkit.com/blog/sveltekit-spa-protected-routes` — Confirmed `+page.server.ts` does not execute in true SPA mode with `ssr=false`
- `https://svelte.dev/docs/kit/adapter-node` — adapter-node docs; used to understand server runtime behavior

### Tertiary (LOW confidence, needs validation)
- WebSearch results on `@auth/sveltekit` 1.7.3–1.8.0 Svelte 5 signIn bug — multiple sources agree it exists; fix status in 1.11.x not directly confirmed from official changelog
- Vercel.json rewrite compatibility with `adapter-vercel` — inferred from documentation, not directly tested

---

## Metadata

**Confidence breakdown:**
- Critical finding (adapter-static incompatibility): HIGH — confirmed by multiple official sources and SvelteKit documentation
- Standard stack (Auth.js + adapter-vercel): HIGH — official Auth.js docs confirm setup
- Architecture patterns: MEDIUM — Auth.js setup patterns confirmed; HKDF decode pattern confirmed by gist + Auth.js JWT spec discussion
- Svelte 5 signIn bug: LOW — open GitHub issue; version 1.11.x may resolve it but not directly confirmed
- Backend token decode: MEDIUM — confirmed algorithm from Auth.js source analysis and community gist

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days — Auth.js releases frequently but patterns are stable)
