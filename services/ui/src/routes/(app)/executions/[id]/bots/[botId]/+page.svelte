<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getBotDetail, getBotSoul, getBotDecisionTraces } from '$lib/api';
  import { connectBotLogs } from '$lib/sse';
  import type { BotDetail, BotLogEntry, StepTrace, DecisionTraceEntry } from '$lib/types';
  import SoulInspectorPanel from '$lib/components/SoulInspectorPanel.svelte';
  import SoulTierBadge from '$lib/components/SoulTierBadge.svelte';

  const executionId = $derived((page.params as Record<string, string>).id ?? '');
  const botId = $derived((page.params as Record<string, string>).botId ?? '');

  let detail = $state<BotDetail | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let logEntries = $state<BotLogEntry[]>([]);
  let logContainer = $state<HTMLElement | null>(null);
  let liveConnected = $state(false);
  let showInspector = $state(false);
  let botAgentClass = $state<'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null>(null);

  // Decision traces state
  let decisionTraces = $state<DecisionTraceEntry[]>([]);
  let tracesLoading = $state(false);
  let tracesError = $state<string | null>(null);
  let tracesTotal = $state(0);
  let tracesHasMore = $state(false);
  let tracesOffset = $state(0);
  let showTraces = $state(false);
  let tracesLoaded = $state(false);

  const ACTIVE_STATUSES = new Set(['spawning', 'idle', 'working', 'stopping']);

  function isActive(status: string) {
    return ACTIVE_STATUSES.has(status);
  }

  // Seed log from existing step trace (historical tool calls already in DB)
  function seedLogFromSteps(steps: StepTrace[]): BotLogEntry[] {
    return steps.map((s) => ({
      type: 'tool_invocation' as const,
      botId,
      toolName: s.toolName,
      invocationId: s.invocationId,
      rejected: s.rejected,
      rejectionReason: s.rejectionReason,
      durationMs: s.durationMs,
      totalTokens: s.totalTokens,
      invokedAt: s.invokedAt,
      timestamp: s.invokedAt,
    }));
  }

  $effect(() => {
    if (!browser) return;
    const id = botId;
    if (!id) return;

    loading = true;
    error = null;

    getBotDetail(id)
      .then(d => {
        detail = d;
        loading = false;
        // Seed log with historical steps
        logEntries = seedLogFromSteps(d.steps);
      })
      .catch(err => { error = (err as Error).message; loading = false; });
  });

  // Fetch soul agentClass for SoulTierBadge — lightweight, displayed without opening inspector
  $effect(() => {
    if (!browser) return;
    const id = botId;
    if (!id) return;
    getBotSoul(id)
      .then(soul => { botAgentClass = soul.agentClass; })
      .catch(() => { botAgentClass = null; });
  });

  // Status polling — refresh bot record while active so we detect when it stops
  $effect(() => {
    if (!browser || !detail) return;
    if (!isActive(detail.bot.status)) return;

    const interval = setInterval(() => {
      getBotDetail(botId)
        .then(d => { detail = d; })
        .catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  });

  // SSE live log connection — only while bot is active
  $effect(() => {
    if (!browser || !detail) return;
    if (!isActive(detail.bot.status)) return;

    liveConnected = true;
    const knownIds = new Set(logEntries.map(e => e.invocationId).filter(Boolean));

    const cleanup = connectBotLogs(botId, (entry) => {
      // Deduplicate tool_invocation entries by invocationId
      if (entry.type === 'tool_invocation' && entry.invocationId) {
        if (knownIds.has(entry.invocationId)) return;
        knownIds.add(entry.invocationId);
      }
      logEntries = [...logEntries, entry];
      // Auto-scroll to bottom
      setTimeout(() => {
        if (logContainer) {
          logContainer.scrollTop = logContainer.scrollHeight;
        }
      }, 0);
    });

    return () => {
      liveConnected = false;
      cleanup?.();
    };
  });

  function formatLogTime(entry: BotLogEntry): string {
    const ts = entry.invokedAt ?? entry.timestamp;
    if (!ts) return '--:--:--';
    return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
  }

  function logClass(entry: BotLogEntry): string {
    if (entry.type === 'guardrail_triggered') return 'log-warn';
    if (entry.type === 'tool_invocation' && entry.rejected) return 'log-error';
    if (entry.type === 'bot_stopped') return 'log-dim';
    if (entry.type === 'bot_started') return 'log-success';
    if (entry.type === 'task_completed') return 'log-success';
    if (entry.type === 'task_claimed') return 'log-info';
    return 'log-default';
  }

  function loadTraces(reset = false) {
    if (reset) { tracesOffset = 0; decisionTraces = []; }
    tracesLoading = true;
    tracesError = null;
    getBotDecisionTraces(botId, { limit: 30, offset: tracesOffset })
      .then(res => {
        decisionTraces = reset ? res.traces : [...decisionTraces, ...res.traces];
        tracesTotal = res.total;
        tracesHasMore = res.hasMore;
        tracesOffset = (reset ? 0 : tracesOffset) + res.traces.length;
        tracesLoading = false;
        tracesLoaded = true;
      })
      .catch(err => { tracesError = (err as Error).message; tracesLoading = false; });
  }

  function toggleTraces() {
    showTraces = !showTraces;
    if (showTraces && !tracesLoaded) {
      loadTraces(true);
    }
  }

  function dtTypeBadgeClass(decisionType: string): string {
    if (decisionType === 'tool_call') return 'dt-badge-violet';
    if (decisionType === 'reasoning_branch') return 'dt-badge-teal';
    if (decisionType === 'output_step') return 'dt-badge-amber';
    return 'dt-badge-default';
  }

  function dtOutcomeBadgeClass(outcome: string | null): string {
    if (outcome === 'success') return 'dt-outcome-success';
    if (outcome === 'failure') return 'dt-outcome-failure';
    if (outcome === 'partial') return 'dt-outcome-partial';
    return 'dt-outcome-unknown';
  }

  function dtFormatConfidence(conf: string | null): string {
    if (conf == null) return '—';
    const pct = parseFloat(conf) * 100;
    return isNaN(pct) ? '—' : `${pct.toFixed(1)}%`;
  }

  function dtFormatTime(ts: string): string {
    return new Date(ts).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'medium' });
  }

  function formatLogLine(entry: BotLogEntry): string {
    switch (entry.type) {
      case 'bot_started':
        return '▶  Bot started';
      case 'bot_stopped':
        return `■  Bot stopped${entry.reason ? ` (${entry.reason})` : ''}`;
      case 'task_claimed':
        return `◆  Task claimed${entry['taskId'] ? ` [${String(entry['taskId']).slice(0, 8)}]` : ''}`;
      case 'task_completed':
        return `✓  Task completed${entry['taskId'] ? ` [${String(entry['taskId']).slice(0, 8)}]` : ''}`;
      case 'guardrail_triggered':
        return `⚠  Guardrail: ${entry.reason ?? 'triggered'}`;
      case 'tool_invocation': {
        const tool = entry.toolName ?? 'unknown';
        if (entry.rejected) {
          return `✗  ${tool}  REJECTED: ${entry.rejectionReason ?? 'unknown reason'}`;
        }
        const dur = entry.durationMs != null ? `${entry.durationMs}ms` : '';
        const tok = entry.totalTokens != null ? `${entry.totalTokens} tokens` : '';
        const meta = [dur, tok].filter(Boolean).join('  ');
        return `←  ${tool}${meta ? `  ${meta}` : ''}`;
      }
      default:
        return JSON.stringify(entry);
    }
  }
</script>

<svelte:head>
  <title>Bot {botId.slice(0, 8)} | Akasa</title>
</svelte:head>

<div class="page">
  <!-- Header -->
  <div class="page-header">
    <a href="/executions/{executionId}/report" class="back-link">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Leaderboard
    </a>
    <div class="sec-label">Bot Detail</div>
    <h1>
      <code class="bot-id-display">{botId.slice(0, 8)}</code>
    </h1>
  </div>

  {#if loading}
    <div class="loading">Loading bot details...</div>
  {:else if error}
    <div class="error-card">{error}</div>
  {:else if detail}
    <!-- Bot identity strip -->
    <div class="identity-strip">
      <div class="identity-left">
        <span class="status-badge status-{detail.bot.status}">{detail.bot.status}</span>
        {#if detail.bot.tier}
          <span class="tier-badge tier-{detail.bot.tier.toLowerCase()}">{detail.bot.tier}</span>
        {/if}
        <SoulTierBadge agentClass={botAgentClass} />
        {#if liveConnected}
          <span class="live-indicator"><span class="live-dot"></span> LIVE</span>
        {/if}
      </div>
      <div class="identity-actions">
        <button class="action-btn" onclick={() => showInspector = true}>Inspect Soul</button>
        <button class="action-btn action-btn-teal" onclick={toggleTraces}>
          {showTraces ? 'Hide Traces' : 'Decision Traces'}
        </button>
      </div>
    </div>

    <!-- Process Log -->
    <section class="panel">
      <div class="panel-header">
        <h2>Process Log</h2>
        <span class="panel-meta">{logEntries.length} entries</span>
      </div>
      <div
        class="log-pane"
        bind:this={logContainer}
      >
        {#if logEntries.length === 0}
          {#if isActive(detail.bot.status)}
            <div class="log-empty">Waiting for activity...</div>
          {:else}
            <div class="log-empty">No log entries recorded for this bot.</div>
          {/if}
        {:else}
          {#each logEntries as entry (entry.invocationId ?? (entry.type + (entry.invokedAt ?? entry.timestamp ?? '')))}
            <div class="log-line {logClass(entry)}">
              <span class="log-time">{formatLogTime(entry)}</span>
              <span class="log-msg">{formatLogLine(entry)}</span>
            </div>
          {/each}
        {/if}
        {#if isActive(detail.bot.status)}
          <div class="log-cursor">▊</div>
        {/if}
      </div>
    </section>

    <!-- Performance Metrics -->
    <section class="panel">
      <h2>Performance Metrics</h2>

      <!-- Hero metrics row -->
      <div class="hero-metrics">
        <div class="hero-metric hero-metric-signal">
          <span class="hero-value">{detail.bot.compositeScore?.toFixed(1) ?? '—'}</span>
          <span class="hero-label">Composite Score</span>
        </div>
        <div class="hero-metric">
          <span class="hero-value">{(detail.metrics.successRate * 100).toFixed(0)}%</span>
          <span class="hero-label">Success Rate</span>
        </div>
        <div class="hero-metric">
          <span class="hero-value">${(detail.metrics.totalCostCents / 100).toFixed(2)}</span>
          <span class="hero-label">Total Cost</span>
        </div>
      </div>

      <!-- Detail metrics grid -->
      <div class="metrics-grid">
        <div class="metric-cell">
          <span class="metric-value">{detail.metrics.tasksCompleted}</span>
          <span class="metric-label">Tasks Completed</span>
        </div>
        <div class="metric-cell">
          <span class="metric-value">{detail.metrics.tasksFailed}</span>
          <span class="metric-label">Tasks Failed</span>
        </div>
        <div class="metric-cell">
          <span class="metric-value">{detail.metrics.botHours.toFixed(3)}</span>
          <span class="metric-label">Runtime (hrs)</span>
        </div>
        <div class="metric-cell">
          <span class="metric-value">{detail.metrics.totalTokens.toLocaleString()}</span>
          <span class="metric-label">Tokens</span>
        </div>
        <div class="metric-cell">
          <span class="metric-value">{detail.metrics.totalToolCalls}</span>
          <span class="metric-label">Tool Calls</span>
        </div>
        <div class="metric-cell">
          <span class="metric-value">{(detail.metrics.errorRate * 100).toFixed(1)}%</span>
          <span class="metric-label">Error Rate</span>
        </div>
        <div class="metric-cell">
          <span class="metric-value">${(detail.metrics.costPerTaskCents / 100).toFixed(2)}</span>
          <span class="metric-label">Cost/Task</span>
        </div>
        <div class="metric-cell">
          <span class="metric-value">{detail.metrics.tasksPerMinute.toFixed(2)}</span>
          <span class="metric-label">Tasks/Min</span>
        </div>
        <div class="metric-cell">
          <span class="metric-value">{detail.metrics.tokensPerTask}</span>
          <span class="metric-label">Tokens/Task</span>
        </div>
        <div class="metric-cell">
          <span class="metric-value">{(detail.metrics.idleRatio * 100).toFixed(1)}%</span>
          <span class="metric-label">Idle Ratio</span>
        </div>
      </div>
    </section>

    <!-- Step Trace -->
    <section class="panel">
      <details class="step-trace-outer">
        <summary class="step-trace-summary">
          Step Trace ({detail.steps.length} invocations)
        </summary>
        <div class="step-trace">
          {#each detail.steps as step, i}
            <div class="step" class:rejected={step.rejected}>
              <div class="step-header">
                <span class="step-num">#{i + 1}</span>
                <span class="step-tool">{step.toolName}</span>
                <span class="step-duration">{step.durationMs ?? '-'}ms</span>
                <span class="step-tokens">{step.totalTokens ?? '-'} tokens</span>
                <span class="step-time">{new Date(step.invokedAt).toLocaleTimeString()}</span>
              </div>
              {#if step.rejected}
                <div class="step-rejection">
                  Rejected: {step.rejectionReason ?? 'unknown reason'}
                </div>
              {/if}
              <details class="step-detail">
                <summary>Details</summary>
                <div class="step-body">
                  <div>
                    <strong>Request:</strong>
                    <pre>{JSON.stringify(step.requestSummary, null, 2)}</pre>
                  </div>
                  <div>
                    <strong>Response:</strong>
                    <pre>{JSON.stringify(step.responseSummary, null, 2)}</pre>
                  </div>
                  <div class="token-detail">
                    Prompt tokens: {step.promptTokens ?? '-'} | Completion tokens: {step.completionTokens ?? '-'}
                  </div>
                </div>
              </details>
            </div>
          {/each}
          {#if detail.steps.length === 0}
            <p class="empty">No step trace recorded for this bot.</p>
          {/if}
        </div>
      </details>
    </section>

    <!-- Decision Traces -->
    {#if showTraces}
      <section class="panel dt-section">
        <div class="panel-header">
          <h2>Decision Traces</h2>
          {#if !tracesLoading}
            <span class="panel-meta">{tracesTotal} total</span>
          {/if}
        </div>

        {#if tracesLoading && decisionTraces.length === 0}
          <div class="loading">Loading decision traces...</div>
        {:else if tracesError}
          <div class="error-card">{tracesError}</div>
        {:else if decisionTraces.length === 0}
          <div class="empty">No decision traces recorded for this bot.</div>
        {:else}
          <div class="dt-list">
            {#each decisionTraces as trace (trace.id)}
              <div class="dt-row">
                <span class="dt-badge {dtTypeBadgeClass(trace.decisionType)}">{trace.decisionType}</span>
                <span class="dt-directive" title={trace.directiveReferenced ?? ''}>{trace.directiveReferenced ?? '—'}</span>
                <span class="dt-confidence">{dtFormatConfidence(trace.attributionConfidence)}</span>
                <span class="dt-outcome {dtOutcomeBadgeClass(trace.outcome)}">{trace.outcome ?? 'unknown'}</span>
                <span class="dt-time">{dtFormatTime(trace.decidedAt)}</span>
              </div>
            {/each}
          </div>

          {#if tracesHasMore}
            <button
              class="load-more-btn"
              onclick={() => loadTraces(false)}
              disabled={tracesLoading}
            >
              {tracesLoading ? 'Loading...' : 'Load More'}
            </button>
          {/if}
        {/if}
      </section>
    {/if}
  {/if}
</div>

<SoulInspectorPanel botId={showInspector ? detail?.bot.id ?? null : null} onClose={() => showInspector = false} />

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 96px var(--s-9) 80px;
    min-height: 100vh;
  }

  @media (max-width: 600px) {
    .page { padding: 88px var(--s-5) 60px; }
  }

  /* ── Page header ──────────────────────────────── */
  .page-header {
    margin-bottom: var(--s-8);
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    text-decoration: none;
    margin-bottom: var(--s-5);
    transition: color 0.15s;
  }

  .back-link:hover {
    color: var(--violet-bright);
  }

  .page-header h1 {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text);
    margin: var(--s-2) 0 0;
    line-height: 1.1;
  }

  .bot-id-display {
    font-family: var(--font-mono);
    font-size: 0.85em;
    color: var(--violet-bright);
    background: none;
  }

  /* ── Identity strip ───────────────────────────── */
  .identity-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-4);
    padding: var(--s-4) var(--s-5);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: var(--s-8);
    flex-wrap: wrap;
  }

  .identity-left {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    flex-wrap: wrap;
  }

  .identity-actions {
    display: flex;
    gap: var(--s-2);
  }

  /* ── Status badge ─────────────────────────────── */
  .status-badge {
    display: inline-block;
    padding: 3px var(--s-3);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: var(--bg-3);
    color: var(--text-muted);
  }

  .status-running, .status-working { background: rgba(99, 102, 241, 0.15); color: var(--violet-bright); }
  .status-idle      { background: rgba(45, 212, 191, 0.12); color: var(--teal); }
  .status-spawning, .status-stopping { background: rgba(251, 191, 36, 0.12); color: var(--amber); }
  .status-completed { background: rgba(45, 212, 191, 0.12); color: var(--teal); }
  .status-failed    { background: rgba(248, 113, 113, 0.12); color: var(--error); }
  .status-stopped   { background: var(--bg-3); color: var(--text-faint); }

  .tier-badge {
    display: inline-block;
    padding: 3px var(--s-3);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .tier-high   { color: var(--teal);  background: var(--teal-dim); }
  .tier-medium { color: var(--amber); background: var(--amber-dim); }
  .tier-low    { color: var(--error); background: var(--error-dim); }
  .tier-none   { color: var(--text-muted); background: var(--bg-3); }

  .live-indicator {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--teal);
  }

  /* ── Action buttons ───────────────────────────── */
  .action-btn {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 6px var(--s-4);
    border-radius: 3px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--violet-bright);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s;
  }

  .action-btn:hover {
    background: var(--bg-3);
    border-color: var(--border-mid);
  }

  .action-btn-teal {
    color: var(--teal);
  }

  /* ── Loading / error / empty ──────────────────── */
  .loading {
    padding: var(--s-8);
    text-align: center;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .error-card {
    padding: var(--s-4) var(--s-5);
    background: var(--error-dim);
    border: 1px solid rgba(248, 113, 113, 0.2);
    border-left: 3px solid var(--error);
    border-radius: 6px;
    color: var(--error);
    font-size: 0.875rem;
  }

  .empty {
    color: var(--text-faint);
    font-size: 0.875rem;
    padding: var(--s-4) 0;
  }

  /* ── Panel (section container) ────────────────── */
  .panel {
    margin-bottom: var(--s-8);
  }

  .panel > h2,
  .panel-header h2 {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin: 0 0 var(--s-4);
    padding-bottom: var(--s-2);
    border-bottom: 1px solid var(--border);
  }

  .panel-header {
    display: flex;
    align-items: baseline;
    gap: var(--s-3);
    margin-bottom: var(--s-4);
    padding-bottom: var(--s-2);
    border-bottom: 1px solid var(--border);
  }

  .panel-header h2 {
    margin: 0;
    padding: 0;
    border: none;
  }

  .panel-meta {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-faint);
  }

  /* ── Hero metrics ─────────────────────────────── */
  .hero-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s-4);
    margin-bottom: var(--s-5);
  }

  .hero-metric {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: var(--s-5) var(--s-5);
    display: flex;
    flex-direction: column;
    gap: var(--s-1);
  }

  .hero-metric-signal {
    border-color: var(--border-mid);
  }

  .hero-value {
    font-family: var(--font-mono);
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
  }

  .hero-metric-signal .hero-value {
    color: var(--violet-bright);
  }

  .hero-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  @media (max-width: 600px) {
    .hero-metrics {
      grid-template-columns: 1fr;
    }
  }

  /* ── Detail metrics grid ──────────────────────── */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }

  .metric-cell {
    background: var(--bg-card);
    padding: var(--s-4) var(--s-4);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .metric-value {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
    line-height: 1.2;
  }

  .metric-label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  @media (max-width: 900px) {
    .metrics-grid { grid-template-columns: repeat(3, 1fr); }
  }

  @media (max-width: 600px) {
    .metrics-grid { grid-template-columns: repeat(2, 1fr); }
  }

  /* ── Process Log ──────────────────────────────── */
  .log-pane {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: var(--s-3) var(--s-4);
    height: 320px;
    overflow-y: auto;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.6;
    scroll-behavior: smooth;
  }

  .log-line {
    display: flex;
    gap: var(--s-4);
    padding: 1px 0;
  }

  .log-time {
    color: var(--text-faint);
    flex-shrink: 0;
    min-width: 6rem;
    user-select: none;
  }

  .log-msg {
    flex: 1;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .log-default .log-msg { color: var(--text-muted); }
  .log-info .log-msg    { color: var(--violet-bright); }
  .log-success .log-msg { color: var(--teal); }
  .log-warn .log-msg    { color: var(--amber); }
  .log-error .log-msg   { color: var(--error); }
  .log-dim .log-msg     { color: var(--text-faint); }

  .log-empty {
    color: var(--text-faint);
    font-style: italic;
    padding: var(--s-2) 0;
  }

  .log-cursor {
    color: var(--violet-bright);
    animation: blink 1s step-end infinite;
    margin-top: 2px;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  /* ── Step trace ───────────────────────────────── */
  .step-trace-outer {
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }

  .step-trace-summary {
    padding: var(--s-3) var(--s-5);
    background: var(--bg-3);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text);
    user-select: none;
    list-style: none;
  }

  .step-trace-summary::-webkit-details-marker {
    display: none;
  }

  .step-trace-summary::before {
    content: '+ ';
    font-weight: 700;
    color: var(--violet-bright);
  }

  details[open] > .step-trace-summary::before {
    content: '- ';
  }

  .step-trace {
    max-height: 600px;
    overflow-y: auto;
    border-top: 1px solid var(--border);
  }

  .step {
    padding: var(--s-3) var(--s-5);
    border-bottom: 1px solid var(--bg-3);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    background: var(--bg-card);
  }

  .step:last-child { border-bottom: none; }

  .step.rejected {
    border-left: 3px solid var(--error);
    background: var(--error-dim);
    padding-left: calc(var(--s-5) - 3px);
  }

  .step-header {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    flex-wrap: wrap;
  }

  .step-num {
    color: var(--text-faint);
    min-width: 2.5rem;
  }

  .step-tool {
    font-weight: 700;
    color: var(--text);
    flex: 1;
  }

  .step-duration {
    color: var(--violet-bright);
    font-size: 0.8rem;
  }

  .step-tokens {
    color: var(--teal);
    font-size: 0.8rem;
  }

  .step-time {
    color: var(--text-faint);
    font-size: 0.75rem;
    margin-left: auto;
  }

  .step-rejection {
    margin-top: var(--s-2);
    color: var(--error);
    font-size: 0.8rem;
    font-family: var(--font-body);
  }

  .step-detail {
    margin-top: var(--s-2);
  }

  .step-detail > summary {
    cursor: pointer;
    color: var(--text-muted);
    font-size: 0.8rem;
    font-family: var(--font-body);
    user-select: none;
    padding: var(--s-1) 0;
  }

  .step-body {
    margin-top: var(--s-2);
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    color: var(--text);
  }

  pre {
    overflow-x: auto;
    max-height: 200px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: var(--s-2);
    margin: var(--s-1) 0 0;
    font-size: 0.8rem;
    font-family: var(--font-mono);
    color: var(--text);
  }

  .token-detail {
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  /* ── Decision Traces ──────────────────────────── */
  .dt-section {
    margin-top: var(--s-4);
  }

  .dt-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }

  .dt-row {
    display: grid;
    grid-template-columns: auto 1fr auto auto auto;
    align-items: center;
    gap: var(--s-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: var(--s-3) var(--s-4);
    font-size: 0.8125rem;
  }

  .dt-badge {
    display: inline-block;
    padding: 3px var(--s-2);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }

  .dt-badge-violet { background: rgba(124,58,237,0.18); color: var(--violet-bright); }
  .dt-badge-teal   { background: rgba(45,212,191,0.14); color: var(--teal); }
  .dt-badge-amber  { background: rgba(251,191,36,0.14); color: var(--amber); }
  .dt-badge-default { background: var(--bg-3); color: var(--text-muted); }

  .dt-directive {
    color: var(--text-muted);
    font-size: 0.8125rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dt-confidence {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--violet-bright);
    white-space: nowrap;
  }

  .dt-outcome {
    display: inline-block;
    padding: 3px var(--s-2);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }

  .dt-outcome-success { background: rgba(45,212,191,0.14); color: var(--teal); }
  .dt-outcome-failure { background: rgba(248,113,113,0.14); color: var(--error); }
  .dt-outcome-partial { background: rgba(251,191,36,0.14); color: var(--amber); }
  .dt-outcome-unknown { background: var(--bg-3); color: var(--text-faint); }

  .dt-time {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-faint);
    white-space: nowrap;
  }

  .load-more-btn {
    margin-top: var(--s-4);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: var(--s-2) var(--s-5);
    border-radius: 3px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .load-more-btn:hover:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--border-mid);
  }

  .load-more-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
