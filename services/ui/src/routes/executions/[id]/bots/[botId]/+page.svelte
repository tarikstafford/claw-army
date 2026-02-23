<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getBotDetail, getBotSoul } from '$lib/api';
  import { connectBotLogs } from '$lib/sse';
  import type { BotDetail, BotLogEntry, StepTrace } from '$lib/types';
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
  <nav class="breadcrumb">
    <a href="/executions/{executionId}/report">Back to Leaderboard</a>
  </nav>

  <h1>Bot Detail</h1>
  <p class="subtitle">Bot <code>{botId.slice(0, 8)}</code></p>

  {#if loading}
    <div class="loading">Loading bot details...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if detail}
    <!-- Bot status badge -->
    <div class="bot-status-row">
      <span class="status-badge status-{detail.bot.status}">{detail.bot.status}</span>
      {#if detail.bot.tier}
        <span class="tier tier-{detail.bot.tier.toLowerCase()}">{detail.bot.tier}</span>
      {/if}
      <SoulTierBadge agentClass={botAgentClass} />
      {#if liveConnected}
        <span class="live-badge">● LIVE</span>
      {/if}
      <button class="inspect-soul-btn" onclick={() => showInspector = true}>
        Inspect Soul
      </button>
    </div>

    <!-- Process Log (live when active, historical when stopped) -->
    <section class="section">
      <div class="log-header">
        <h2>Process Log</h2>
        <span class="log-count">{logEntries.length} entries</span>
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

    <!-- Bot Metrics Panel (UI-08) -->
    <section class="section">
      <h2>Performance Metrics</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <span class="metric-label">Tasks Completed</span>
          <span class="metric-value">{detail.metrics.tasksCompleted}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Tasks Failed</span>
          <span class="metric-value">{detail.metrics.tasksFailed}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Runtime</span>
          <span class="metric-value">{detail.metrics.botHours.toFixed(3)} hours</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Token Usage</span>
          <span class="metric-value">{detail.metrics.totalTokens.toLocaleString()}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Tool Calls</span>
          <span class="metric-value">{detail.metrics.totalToolCalls}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Error Count</span>
          <span class="metric-value">{detail.metrics.tasksFailed}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Error Rate</span>
          <span class="metric-value">{(detail.metrics.errorRate * 100).toFixed(1)}%</span>
        </div>
        <div class="metric-card highlight">
          <span class="metric-label">Composite Score</span>
          <span class="metric-value large">{detail.bot.compositeScore?.toFixed(1) ?? '-'}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Tier</span>
          <span class="metric-value">
            {#if detail.bot.tier}
              <span class="tier tier-{detail.bot.tier.toLowerCase()}">{detail.bot.tier}</span>
            {:else}
              -
            {/if}
          </span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Cost</span>
          <span class="metric-value">${(detail.metrics.totalCostCents / 100).toFixed(2)}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Cost/Task</span>
          <span class="metric-value">${(detail.metrics.costPerTaskCents / 100).toFixed(2)}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Tasks/Min</span>
          <span class="metric-value">{detail.metrics.tasksPerMinute.toFixed(2)}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Tokens/Task</span>
          <span class="metric-value">{detail.metrics.tokensPerTask}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Idle Ratio</span>
          <span class="metric-value">{(detail.metrics.idleRatio * 100).toFixed(1)}%</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Success Rate</span>
          <span class="metric-value">{(detail.metrics.successRate * 100).toFixed(1)}%</span>
        </div>
      </div>
    </section>

    <!-- Expandable Step Trace (UI-09) -->
    <section class="section">
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
  {/if}
</div>

<SoulInspectorPanel botId={showInspector ? detail?.bot.id ?? null : null} onClose={() => showInspector = false} />

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1.5rem;
    background: var(--bg);
    min-height: 100vh;
  }

  .breadcrumb {
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .breadcrumb a {
    color: var(--violet-bright);
    text-decoration: none;
  }

  .breadcrumb a:hover {
    color: var(--violet-light);
    text-decoration: underline;
  }

  h1 {
    margin: 0 0 0.25rem;
    font-size: 1.75rem;
    color: var(--text);
  }

  .subtitle {
    margin: 0 0 1rem;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .bot-status-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.75rem;
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: capitalize;
    background: var(--bg-3);
    color: var(--text-muted);
  }

  .status-running { background: rgba(99, 102, 241, 0.15); color: var(--violet-bright); }
  .status-working { background: rgba(99, 102, 241, 0.15); color: var(--violet-bright); }
  .status-idle { background: rgba(45, 212, 191, 0.12); color: var(--teal); }
  .status-spawning { background: rgba(251, 191, 36, 0.12); color: var(--amber); }
  .status-stopping { background: rgba(251, 191, 36, 0.12); color: var(--amber); }
  .status-completed { background: rgba(45, 212, 191, 0.12); color: var(--teal); }
  .status-failed { background: rgba(248, 113, 113, 0.12); color: var(--error); }
  .status-stopped { background: var(--bg-3); color: var(--text-faint); }

  .live-badge {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--teal);
    letter-spacing: 0.05em;
    animation: pulse 2s ease-in-out infinite;
  }

  .inspect-soul-btn {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.25rem 0.65rem;
    border-radius: 9999px;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--violet-bright);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s, border-color 0.1s;
    margin-left: auto;
  }

  .inspect-soul-btn:hover {
    background: var(--bg-3);
    border-color: var(--border-mid);
    opacity: 0.85;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .loading {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }

  .error {
    padding: 1rem;
    background: var(--error-dim);
    border: 1px solid var(--error);
    border-radius: 0.5rem;
    color: var(--error);
  }

  .section {
    margin-bottom: 2.5rem;
  }

  .section h2 {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
  }

  /* Process Log */
  .log-header {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
  }

  .log-header h2 {
    margin: 0;
    padding: 0;
    border: none;
    font-size: 10px;
  }

  .log-count {
    font-size: 0.8rem;
    color: var(--text-faint);
  }

  .log-pane {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 0.75rem 1rem;
    height: 320px;
    overflow-y: auto;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.6;
    scroll-behavior: smooth;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }

  .log-line {
    display: flex;
    gap: 1rem;
    padding: 0.1rem 0;
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
  .log-info .log-msg { color: var(--violet-bright); }
  .log-success .log-msg { color: var(--teal); }
  .log-warn .log-msg { color: var(--amber); }
  .log-error .log-msg { color: var(--error); }
  .log-dim .log-msg { color: var(--text-faint); }

  .log-empty {
    color: var(--text-faint);
    font-style: italic;
    padding: 0.5rem 0;
  }

  .log-cursor {
    color: var(--violet-bright);
    animation: blink 1s step-end infinite;
    margin-top: 0.2rem;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  /* Metrics grid: 3-4 cols on desktop */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  @media (max-width: 900px) {
    .metrics-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 600px) {
    .metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .metric-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 0.875rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }

  .metric-card.highlight {
    background: var(--bg-card);
    border-color: var(--violet-bright);
  }

  .metric-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    font-weight: 600;
  }

  .metric-value {
    font-family: var(--font-mono);
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text);
  }

  .metric-value.large {
    font-size: 1.5rem;
    color: var(--violet-bright);
  }

  .empty {
    color: var(--text-faint);
    font-style: italic;
    padding: 1rem 0;
  }

  /* Tier badges */
  .tier {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  .tier-high {
    color: var(--teal);
    background: var(--teal-dim);
    border: 1px solid var(--teal);
  }

  .tier-medium {
    color: var(--amber);
    background: var(--amber-dim);
    border: 1px solid var(--amber);
  }

  .tier-low {
    color: var(--error);
    background: var(--error-dim);
    border: 1px solid var(--error);
  }

  .tier-none {
    color: var(--text-muted);
    background: var(--bg-3);
    border: 1px solid var(--border);
  }

  /* Step trace */
  .step-trace-outer {
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }

  .step-trace-summary {
    padding: 0.875rem 1.25rem;
    background: var(--bg-3);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.95rem;
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
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid var(--bg-3);
    font-family: var(--font-mono);
    font-size: 0.85rem;
    background: var(--bg-card);
  }

  .step:last-child {
    border-bottom: none;
  }

  .step.rejected {
    border-left: 4px solid var(--error);
    background: var(--error-dim);
    padding-left: calc(1.25rem - 4px);
  }

  .step-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
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
    margin-top: 0.5rem;
    color: var(--error);
    font-size: 0.8rem;
    font-family: sans-serif;
  }

  .step-detail {
    margin-top: 0.5rem;
  }

  .step-detail > summary {
    cursor: pointer;
    color: var(--text-muted);
    font-size: 0.8rem;
    font-family: sans-serif;
    user-select: none;
    padding: 0.25rem 0;
  }

  .step-body {
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-family: sans-serif;
    font-size: 0.85rem;
    color: var(--text);
  }

  pre {
    overflow-x: auto;
    max-height: 200px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 0.25rem;
    padding: 0.5rem;
    margin: 0.25rem 0 0;
    font-size: 0.8rem;
    font-family: var(--font-mono);
    color: var(--text);
  }

  .token-detail {
    color: var(--text-muted);
    font-size: 0.8rem;
  }
</style>
