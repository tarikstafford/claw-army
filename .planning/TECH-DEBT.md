# Tech Debt Backlog

Accumulated from v5.0 milestone audit (2026-03-03). Track and address in future milestones.

---

## Priority 1 — Functional Gap

### TD-01: Per-Execution Domain Filtering Activation
**Source:** v5.0 audit, API-03 partial
**Impact:** Users who set `allowedDomains` on an execution get no isolation — all bot traffic falls back to global `PROXY_DOMAIN_ALLOWLIST`
**Root cause:** `gce-bot-launcher.ts` `buildStartupScript()` never injects `X-Execution-Id` into bot VM `HTTP_PROXY` configuration
**Fix:** Add `X-Execution-Id` header or env var to the bot VM startup script so Tool Gateway can look up per-execution domain lists
**Files:** `services/execution-service/src/orchestrator/gce-bot-launcher.ts`
**Effort:** Small — one env var or proxy header addition in startup script

---

## Priority 2 — Type Safety

### TD-02: billing.ts TypeBox Schema Missing `pre_flight`
**Source:** v5.0 audit, Phase 36 fallout
**Impact:** TS2345 compile error; Fastify may reject/strip `pre_flight` executions from billing history response at runtime
**Fix:** Add `'pre_flight'` to the status union in billing.ts GET /history response schema
**Files:** `services/execution-service/src/routes/billing.ts` (line ~16)
**Effort:** Trivial — one literal added to TypeBox union

### TD-03: AdminExecution Interface Missing `pre_flight`
**Source:** v5.0 audit, Phase 36 fallout
**Impact:** Admin page type mismatch for pre_flight executions; no `status-pre_flight` CSS class for badge styling
**Fix:** Add `'pre_flight'` to `AdminExecution.status` union in `api.ts`; add CSS class in admin `+page.svelte`
**Files:** `services/ui/src/lib/api.ts` (~line 92), `services/ui/src/routes/admin/+page.svelte`
**Effort:** Trivial — one literal + one CSS rule

### TD-04: createExecution() Stale Return Type
**Source:** v5.0 audit, Phase 36 fallout
**Impact:** None currently (function unused — server action does raw fetch). Becomes a bug if ever consumed.
**Fix:** Update return type from `'queued'` to `'pre_flight'` or make it the full status union
**Files:** `services/ui/src/lib/api.ts` (~line 48)
**Effort:** Trivial

### TD-05: Drizzle `as any` Cast in Timeline Endpoint
**Source:** v5.0 audit, Phase 38
**Impact:** Type safety bypass for `inArray()` with string[] vs enum mismatch
**Fix:** Properly type the `allowedVerdictTypes` array or use a Drizzle-compatible enum cast
**Files:** `services/execution-service/src/routes/objectives.ts` (~line 526)
**Effort:** Small

---

## Priority 3 — Documentation

### TD-06: REQUIREMENTS.md Stale Checkboxes
**Source:** v5.0 audit
**Impact:** 9 requirements (API-01–06, FORM-01–03) still marked `[ ]` Pending despite being verified as satisfied
**Fix:** Update checkboxes to `[x]` and status to Complete in traceability table
**Files:** `.planning/REQUIREMENTS.md`

### TD-07: SUMMARY Frontmatter Gaps
**Source:** v5.0 audit
**Impact:** 13 requirements not listed in `requirements_completed` frontmatter across Phases 33–36, 39-01, 40-01
**Fix:** Add requirements_completed to SUMMARY frontmatter for completeness (low priority — code is verified)
**Files:** Various `*-SUMMARY.md` files

---

*Created: 2026-03-03 from v5.0 milestone audit*
