---
phase: 7
slug: tool-nexus-ui
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-25
revised: 2026-03-25
---

# Phase 7 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | services/ui/vitest.config.ts |
| **Quick run command** | `pnpm --filter @claw/ui exec vitest run` |
| **Full suite command** | `pnpm --filter @claw/ui exec vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @claw/ui exec vitest run`
- **After every plan wave:** Run `pnpm --filter @claw/ui exec vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 07-01-01 | 01 | 1 | TOOL-08 | grep | `grep -q "webhookRoutingRules" packages/db/src/schema/webhook-routing-rules.ts && grep -q "webhookRoutingRulesRouter" services/akasa-server/src/routes/index.ts` | pending |
| 07-01-02 | 01 | 1 | TOOL-09 | grep | `grep -q "startsWith('/tools')" services/ui/src/hooks.server.ts && grep -q "'tools'" services/ui/src/lib/components/NavBar.svelte && test -f services/ui/src/lib/tool-catalog.ts` | pending |
| 07-02-01 | 02 | 2 | TOOL-04 | grep | `test -f services/ui/src/lib/components/tools/ToolCatalog.svelte && test -f services/ui/src/lib/components/tools/ToolCard.svelte && test -f services/ui/src/lib/components/tools/StatusBadge.svelte && test -f services/ui/src/lib/components/tools/ToolBelt.svelte` | pending |
| 07-02-02 | 02 | 2 | TOOL-05 | grep | `test -f services/ui/src/routes/\(app\)/tools/catalog/+page.svelte && test -f services/ui/src/routes/\(app\)/tools/belt/+page.svelte && grep -q "ToolCatalog" services/ui/src/routes/\(app\)/tools/catalog/+page.svelte && grep -q "ToolBelt" services/ui/src/routes/\(app\)/tools/belt/+page.svelte` | pending |
| 07-03-01 | 03 | 2 | TOOL-08 | grep | `test -f services/ui/src/lib/components/tools/WebhookRuleForm.svelte && test -f services/ui/src/lib/components/tools/WebhookLogEntry.svelte && grep -q "TOOL_EVENT_TYPES" services/ui/src/lib/components/tools/WebhookRuleForm.svelte` | pending |
| 07-03-02 | 03 | 2 | TOOL-09 | grep | `test -f services/ui/src/routes/\(app\)/tools/webhooks/+page.svelte && grep -q "WebhookRuleForm" services/ui/src/routes/\(app\)/tools/webhooks/+page.svelte && grep -q "WebhookLogEntry" services/ui/src/routes/\(app\)/tools/webhooks/+page.svelte` | pending |

*Status: pending / green / red / flaky*

**Note:** Plans use grep-based file existence and content verification rather than unit tests. This is appropriate for UI scaffolding phases where the primary deliverable is component structure and wiring. The automated commands in each plan's `<verify>` block serve as the Nyquist-compliant feedback mechanism.

---

## Wave 0 Requirements

- [ ] Vitest config exists for UI package
- [ ] Test stubs for TOOL-04 (catalog), TOOL-05 (tool belt), TOOL-08 (webhook routing), TOOL-09 (webhook logs)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth connection flow redirect | TOOL-04 | Requires real OAuth provider | Click "Connect" -> verify redirect -> check success notification on return |
| Live status badge updates | TOOL-05 | Requires real connection state changes | Connect a tool, let token expire, verify badge changes |
| Webhook event rendering | TOOL-09 | Requires real webhook delivery | Send test webhook -> verify it appears in log |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands (grep-based)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 stubs not required -- grep-based verification covers all tasks
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
