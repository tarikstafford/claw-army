<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getBotDetail } from '$lib/api';
  import type { BotDetail } from '$lib/types';

  const executionId = $derived((page.params as Record<string, string>).id ?? '');
  const botId = $derived((page.params as Record<string, string>).botId ?? '');

  let detail = $state<BotDetail | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!browser) return;
    const id = botId;
    if (!id) return;

    loading = true;
    error = null;

    getBotDetail(id)
      .then(d => { detail = d; loading = false; })
      .catch(err => { error = (err as Error).message; loading = false; });
  });
</script>

<svelte:head>
  <title>Bot {botId.slice(0, 8)} | Claw Army</title>
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
    </div>

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

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  .breadcrumb {
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .breadcrumb a {
    color: #6366f1;
    text-decoration: none;
  }

  .breadcrumb a:hover {
    text-decoration: underline;
  }

  h1 {
    margin: 0 0 0.25rem;
    font-size: 1.75rem;
  }

  .subtitle {
    margin: 0 0 1rem;
    color: #6b7280;
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
    background: #e5e7eb;
    color: #374151;
  }

  .status-running { background: #dbeafe; color: #1d4ed8; }
  .status-completed { background: #d1fae5; color: #065f46; }
  .status-failed { background: #fee2e2; color: #991b1b; }
  .status-stopped { background: #fef3c7; color: #92400e; }

  .loading {
    padding: 2rem;
    text-align: center;
    color: #6b7280;
  }

  .error {
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.5rem;
    color: #dc2626;
  }

  .section {
    margin-bottom: 2.5rem;
  }

  .section h2 {
    font-size: 1.25rem;
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e5e7eb;
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
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 0.875rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .metric-card.highlight {
    background: #eff6ff;
    border-color: #bfdbfe;
  }

  .metric-label {
    font-size: 0.7rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .metric-value {
    font-size: 1.2rem;
    font-weight: 700;
    color: #111827;
  }

  .metric-value.large {
    font-size: 1.5rem;
    color: #1d4ed8;
  }

  .empty {
    color: #9ca3af;
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
    color: #16a34a;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
  }

  .tier-medium {
    color: #ca8a04;
    background: #fefce8;
    border: 1px solid #fde68a;
  }

  .tier-low {
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
  }

  .tier-none {
    color: #6b7280;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
  }

  /* Step trace */
  .step-trace-outer {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .step-trace-summary {
    padding: 0.875rem 1.25rem;
    background: #f3f4f6;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.95rem;
    user-select: none;
    list-style: none;
  }

  .step-trace-summary::-webkit-details-marker {
    display: none;
  }

  .step-trace-summary::before {
    content: '+ ';
    font-weight: 700;
    color: #6366f1;
  }

  details[open] > .step-trace-summary::before {
    content: '- ';
  }

  .step-trace {
    max-height: 600px;
    overflow-y: auto;
    border-top: 1px solid #e5e7eb;
  }

  .step {
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid #f3f4f6;
    font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace;
    font-size: 0.85rem;
  }

  .step:last-child {
    border-bottom: none;
  }

  .step.rejected {
    border-left: 4px solid #dc2626;
    background: #fff5f5;
    padding-left: calc(1.25rem - 4px);
  }

  .step-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .step-num {
    color: #9ca3af;
    min-width: 2.5rem;
  }

  .step-tool {
    font-weight: 700;
    color: #111827;
    flex: 1;
  }

  .step-duration {
    color: #6366f1;
    font-size: 0.8rem;
  }

  .step-tokens {
    color: #059669;
    font-size: 0.8rem;
  }

  .step-time {
    color: #9ca3af;
    font-size: 0.75rem;
    margin-left: auto;
  }

  .step-rejection {
    margin-top: 0.5rem;
    color: #dc2626;
    font-size: 0.8rem;
    font-family: sans-serif;
  }

  .step-detail {
    margin-top: 0.5rem;
  }

  .step-detail > summary {
    cursor: pointer;
    color: #6b7280;
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
  }

  pre {
    overflow-x: auto;
    max-height: 200px;
    background: #f5f5f5;
    border: 1px solid #e5e7eb;
    border-radius: 0.25rem;
    padding: 0.5rem;
    margin: 0.25rem 0 0;
    font-size: 0.8rem;
    font-family: ui-monospace, 'Cascadia Code', monospace;
  }

  .token-detail {
    color: #6b7280;
    font-size: 0.8rem;
  }
</style>
