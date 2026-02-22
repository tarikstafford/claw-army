<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getExecution, getExecutionMetrics, getExecutionBots, getExecutionPendingVerdicts } from '$lib/api';
  import { connectSSE } from '$lib/sse';
  import type { Execution, ExecutionMetrics, ActivityEvent, ExecutionBot, VerdictDetail } from '$lib/types';
  import SoulInspectorPanel from '$lib/components/SoulInspectorPanel.svelte';
  import SoulTierBadge from '$lib/components/SoulTierBadge.svelte';
  import VerdictConfirmPanel from '$lib/components/VerdictConfirmPanel.svelte';

  const executionId = $derived(page.params.id ?? '');

  let execution = $state<Execution | null>(null);
  let metrics = $state<ExecutionMetrics | null>(null);
  let bots = $state<ExecutionBot[]>([]);
  let activityFeed = $state<ActivityEvent[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let selectedBotId = $state<string | null>(null);
  let pendingVerdicts = $state<VerdictDetail[]>([]);
  let selectedVerdict = $state<VerdictDetail | null>(null);

  // Initial load
  $effect(() => {
    if (!browser) return;
    getExecution(executionId)
      .then(data => { execution = data; loading = false; })
      .catch(err => { error = (err as Error).message; loading = false; });
  });

  // Metrics + bots polling — fetch immediately and then every 5 seconds
  $effect(() => {
    if (!browser) return;
    const isTerminal =
      execution?.status === 'completed' ||
      execution?.status === 'failed' ||
      execution?.status === 'stopped';

    // Fetch immediately on mount / when execution changes
    getExecutionMetrics(executionId).then(m => { metrics = m; }).catch(() => {});
    getExecutionBots(executionId).then(b => { bots = b; }).catch(() => {});

    if (isTerminal) return; // Don't poll for completed executions

    const interval = setInterval(() => {
      getExecutionMetrics(executionId).then(m => { metrics = m; }).catch(() => {});
      getExecutionBots(executionId).then(b => { bots = b; }).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  });

  // SSE activity feed
  $effect(() => {
    if (!browser) return;
    const isTerminal =
      execution?.status === 'completed' ||
      execution?.status === 'failed' ||
      execution?.status === 'stopped';
    if (isTerminal) return;

    const cleanup = connectSSE(executionId, (event) => {
      // Keep last 100 events, newest first
      activityFeed = [event, ...activityFeed].slice(0, 100);

      // If execution status changed, update local state
      if (event.type === 'execution_status_changed' && event['toStatus']) {
        execution = execution
          ? { ...execution, status: event['toStatus'] as Execution['status'] }
          : execution;
      }
    });

    return cleanup ?? undefined;
  });

  // Pending verdicts polling — fetch immediately and poll every 10 seconds
  $effect(() => {
    if (!browser) return;
    // Fetch immediately
    getExecutionPendingVerdicts(executionId).then(v => { pendingVerdicts = v; }).catch(() => {});

    const isTerminal =
      execution?.status === 'completed' ||
      execution?.status === 'failed' ||
      execution?.status === 'stopped';
    if (isTerminal) return;

    const interval = setInterval(() => {
      getExecutionPendingVerdicts(executionId).then(v => { pendingVerdicts = v; }).catch(() => {});
    }, 10000);

    return () => clearInterval(interval);
  });

  function getPendingVerdictForBot(botId: string): VerdictDetail | undefined {
    return pendingVerdicts.find(v => v.botId === botId);
  }

  function formatEventType(type: string): string {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function formatEventDetail(event: ActivityEvent): string {
    const botId = event['botId'] as string | undefined;
    const short = botId ? botId.slice(0, 8) : 'unknown';
    const reason = event['reason'] as string | undefined;

    switch (event.type) {
      case 'task_claimed':
        return `Bot ${short} claimed task`;
      case 'task_completed':
        return `Task completed by bot ${short}`;
      case 'bot_started':
        return `Bot ${short} started`;
      case 'bot_stopped':
        return `Bot ${short} stopped${reason ? ` (${reason})` : ''}`;
      case 'guardrail_triggered':
        return `Bot ${short}: ${reason ?? 'guardrail triggered'}`;
      case 'budget_exceeded':
        return 'Budget exceeded for execution';
      default: {
        const { type: _type, executionId: _eid, timestamp: _ts, isAlert: _ia, ...rest } = event;
        const detail = JSON.stringify(rest);
        return detail.length > 120 ? detail.slice(0, 117) + '...' : detail;
      }
    }
  }

  function statusClass(status: string): string {
    switch (status) {
      case 'running': return 'status-running';
      case 'completed': return 'status-completed';
      case 'failed': return 'status-failed';
      case 'paused':
      case 'stopped': return 'status-paused';
      default: return 'status-queued';
    }
  }
</script>

<svelte:head>
  <title>Execution {executionId.slice(0, 8)} | Claw Army</title>
</svelte:head>

<div class="page">
  {#if loading}
    <p class="loading">Loading execution...</p>
  {:else if error}
    <div class="error-banner">
      <strong>Error:</strong> {error}
    </div>
  {:else if execution}
    <!-- Status banner (UI-03) -->
    <div class="status-banner {statusClass(execution.status)}">
      <h2>Status: {execution.status.toUpperCase()}</h2>
      <p class="objective">{execution.objective}</p>
    </div>

    <!-- Metrics panel (UI-04, METR-04) -->
    <section class="metrics-panel">
      <h3>Live Metrics</h3>
      <div class="metrics-grid">
        <div class="metric-card">
          <span class="metric-label">Active Bots</span>
          <span class="metric-value">{metrics?.activeBotCount ?? '-'}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Bot-Hours</span>
          <span class="metric-value">{metrics?.totalBotHours != null ? metrics.totalBotHours.toFixed(2) : '-'}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Budget Remaining</span>
          <span class="metric-value">${((metrics?.remainingCents ?? 0) / 100).toFixed(2)}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Estimated Cost</span>
          <span class="metric-value">${((metrics?.estimatedCostCents ?? 0) / 100).toFixed(2)}</span>
        </div>
      </div>
    </section>

    <!-- Link to report when completed -->
    {#if execution.status === 'completed'}
      <div class="report-link">
        <a href="/executions/{executionId}/report" class="btn-report">View Report</a>
      </div>
    {/if}

    <!-- Running bots list with links to process logs -->
    {#if bots.length > 0}
      <section class="bots-section">
        <h3>Bots <span class="bots-count">({bots.length})</span></h3>
        <div class="bots-list">
          {#each bots as bot (bot.id)}
            <a
              href="/executions/{executionId}/bots/{bot.id}"
              class="bot-card"
              class:bot-active={bot.status === 'working' || bot.status === 'idle' || bot.status === 'spawning'}
              class:bot-stopped={bot.status === 'stopped'}
              class:bot-failed={bot.status === 'failed'}
            >
              <div class="bot-card-top">
                <span class="bot-id">{bot.id.slice(0, 8)}</span>
                <span class="bot-status-pill bot-status-{bot.status}">{bot.status}</span>
                <SoulTierBadge agentClass={bot.agentClass} />
                <button
                  class="inspect-soul-btn"
                  onclick={(e) => { e.stopPropagation(); e.preventDefault(); selectedBotId = bot.id; }}
                >Soul</button>
                {#if getPendingVerdictForBot(bot.id)}
                  <button
                    class="verdict-pending-btn"
                    onclick={(e) => { e.stopPropagation(); e.preventDefault(); selectedVerdict = getPendingVerdictForBot(bot.id) ?? null; }}
                  >Verdict</button>
                {/if}
              </div>
              <div class="bot-card-stats">
                <span>{bot.tasksCompleted} done</span>
                <span class="stat-sep">·</span>
                <span>{bot.tasksClaimed} claimed</span>
                {#if bot.tasksFailed > 0}
                  <span class="stat-sep">·</span>
                  <span class="stat-fail">{bot.tasksFailed} failed</span>
                {/if}
              </div>
              {#if bot.currentTaskDescription}
                <div class="bot-task-desc">{bot.currentTaskDescription}</div>
              {/if}
              <div class="bot-live-stats">
                <span>{bot.toolCallCount} tool calls</span>
                <span class="stat-sep">&middot;</span>
                <span>{bot.tokenBurnRate != null ? `${bot.tokenBurnRate.toLocaleString()} tok/min` : '- tok/min'}</span>
              </div>
              {#if bot.status === 'failed' && bot.errorMessage}
                <div class="bot-error-msg">{bot.errorMessage}</div>
              {/if}
              <div class="bot-card-cta">View process log →</div>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    <SoulInspectorPanel botId={selectedBotId} onClose={() => selectedBotId = null} />

    {#if selectedVerdict}
      <VerdictConfirmPanel
        verdict={selectedVerdict}
        userId="operator"
        onResolved={() => {
          selectedVerdict = null;
          getExecutionPendingVerdicts(executionId).then(v => { pendingVerdicts = v; }).catch(() => {});
          getExecutionBots(executionId).then(b => { bots = b; }).catch(() => {});
        }}
        onClose={() => { selectedVerdict = null; }}
      />
    {/if}

    <!-- Activity feed (UI-05) -->
    <section class="activity-section">
      <h3>Activity Feed</h3>
      {#if activityFeed.length === 0}
        <p class="empty-feed">No events yet. Waiting for activity...</p>
      {:else}
        <div class="activity-feed">
          {#each activityFeed as event (event.timestamp + event.type + (event['botId'] ?? ''))}
            <div class="event" class:alert={event.isAlert}>
              <span class="event-type">{formatEventType(event.type)}</span>
              <span class="event-detail">{formatEventDetail(event)}</span>
              <span class="event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {:else}
    <p class="loading">Execution not found.</p>
  {/if}
</div>

<style>
  .page {
    max-width: 900px;
    margin: 0 auto;
    padding: 1.5rem;
    font-family: system-ui, sans-serif;
  }

  .loading {
    color: #666;
    text-align: center;
    padding: 2rem;
  }

  .error-banner {
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    padding: 1rem 1.25rem;
    color: #b91c1c;
    margin-bottom: 1.5rem;
  }

  /* Status banner */
  .status-banner {
    border-radius: 8px;
    padding: 1rem 1.5rem;
    margin-bottom: 1.5rem;
  }

  .status-banner h2 {
    margin: 0 0 0.25rem;
    font-size: 1.25rem;
    font-weight: 700;
  }

  .status-banner .objective {
    margin: 0;
    opacity: 0.85;
    font-size: 0.9rem;
  }

  .status-running {
    background: #dbeafe;
    border-left: 4px solid #2563eb;
    color: #1d4ed8;
  }

  .status-completed {
    background: #dcfce7;
    border-left: 4px solid #16a34a;
    color: #15803d;
  }

  .status-failed {
    background: #fef2f2;
    border-left: 4px solid #dc2626;
    color: #b91c1c;
  }

  .status-paused {
    background: #fefce8;
    border-left: 4px solid #ca8a04;
    color: #92400e;
  }

  .status-queued {
    background: #f3f4f6;
    border-left: 4px solid #9ca3af;
    color: #374151;
  }

  /* Metrics panel */
  .metrics-panel {
    margin-bottom: 1.5rem;
  }

  .metrics-panel h3 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  @media (max-width: 640px) {
    .metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .metric-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }

  .metric-label {
    display: block;
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 500;
    margin-bottom: 0.4rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .metric-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
  }

  /* Report link */
  .report-link {
    margin-bottom: 1.5rem;
  }

  .btn-report {
    display: inline-block;
    background: #16a34a;
    color: #fff;
    text-decoration: none;
    padding: 0.6rem 1.25rem;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .btn-report:hover {
    background: #15803d;
  }

  /* Running bots list */
  .bots-section {
    margin-bottom: 1.5rem;
  }

  .bots-section h3 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
  }

  .bots-count {
    font-weight: 400;
    color: #9ca3af;
    font-size: 0.875rem;
  }

  .bots-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.625rem;
  }

  .bot-card {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.75rem 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .bot-card:hover {
    border-color: #6366f1;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
  }

  .bot-card.bot-active {
    border-left: 3px solid #2563eb;
    padding-left: calc(1rem - 2px);
  }

  .bot-card.bot-stopped {
    opacity: 0.65;
  }

  .bot-card.bot-failed {
    border-left: 3px solid #dc2626;
    padding-left: calc(1rem - 2px);
    background: #fef2f2;
  }

  .bot-error-msg {
    font-size: 0.72rem;
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 4px;
    padding: 0.3rem 0.5rem;
    margin-top: 0.15rem;
    line-height: 1.3;
    /* Truncate very long messages to 3 lines */
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .bot-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .bot-id {
    font-family: ui-monospace, monospace;
    font-size: 0.85rem;
    font-weight: 700;
    color: #111827;
  }

  .bot-status-pill {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.4rem;
    border-radius: 9999px;
    white-space: nowrap;
  }

  .bot-status-spawning { background: #fef9c3; color: #854d0e; }
  .bot-status-idle { background: #f0fdf4; color: #15803d; }
  .bot-status-working { background: #dbeafe; color: #1d4ed8; }
  .bot-status-stopping { background: #fef9c3; color: #854d0e; }
  .bot-status-stopped { background: #f3f4f6; color: #6b7280; }
  .bot-status-failed { background: #fee2e2; color: #991b1b; }

  .bot-card-stats {
    font-size: 0.75rem;
    color: #6b7280;
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .stat-sep { color: #d1d5db; }
  .stat-fail { color: #dc2626; }

  .bot-task-desc {
    font-size: 0.72rem;
    color: #4b5563;
    background: #f0f4ff;
    border: 1px solid #c7d2fe;
    border-radius: 4px;
    padding: 0.3rem 0.5rem;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .bot-live-stats {
    font-size: 0.72rem;
    color: #6b7280;
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .bot-card-cta {
    font-size: 0.72rem;
    color: #6366f1;
    font-weight: 500;
    margin-top: 0.15rem;
  }

  .inspect-soul-btn {
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
    border: 1px solid #c7d2fe;
    background: #eef2ff;
    color: #4f46e5;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s, border-color 0.1s;
  }

  .inspect-soul-btn:hover {
    background: #e0e7ff;
    border-color: #a5b4fc;
  }

  .verdict-pending-btn {
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
    border: 1px solid #fde68a;
    background: #fef3c7;
    color: #92400e;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s, border-color 0.1s;
    animation: pulse-verdict 2s ease-in-out infinite;
  }

  .verdict-pending-btn:hover {
    background: #fde68a;
    border-color: #f59e0b;
  }

  @keyframes pulse-verdict {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  /* Activity feed */
  .activity-section h3 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
  }

  .empty-feed {
    color: #9ca3af;
    font-size: 0.9rem;
    font-style: italic;
    padding: 1rem 0;
  }

  .activity-feed {
    max-height: 500px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
  }

  .event {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    font-size: 0.875rem;
  }

  .event:last-child {
    border-bottom: none;
  }

  /* Guardrail / alert events (UI-05) */
  .event.alert {
    border-left: 3px solid #dc2626;
    background: rgba(220, 38, 38, 0.04);
    padding-left: calc(1rem - 3px);
  }

  .event-type {
    font-weight: 600;
    color: #374151;
    min-width: 150px;
    flex-shrink: 0;
  }

  .event.alert .event-type {
    color: #b91c1c;
  }

  .event-detail {
    flex: 1;
    color: #6b7280;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .event-time {
    color: #9ca3af;
    font-size: 0.8rem;
    flex-shrink: 0;
  }
</style>
