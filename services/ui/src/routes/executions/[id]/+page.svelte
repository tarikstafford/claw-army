<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getExecution, getExecutionMetrics, getExecutionBots } from '$lib/api';
  import { connectSSE } from '$lib/sse';
  import type { Execution, ExecutionMetrics, ActivityEvent, ExecutionBot } from '$lib/types';

  const executionId = $derived(page.params.id ?? '');

  let execution = $state<Execution | null>(null);
  let metrics = $state<ExecutionMetrics | null>(null);
  let bots = $state<ExecutionBot[]>([]);
  let activityFeed = $state<ActivityEvent[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

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
  <title>Execution {executionId.slice(0, 8)} | Akasa</title>
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
              class:bot-stopped={bot.status === 'stopped' || bot.status === 'failed'}
            >
              <div class="bot-card-top">
                <span class="bot-id">{bot.id.slice(0, 8)}</span>
                <span class="bot-status-pill bot-status-{bot.status}">{bot.status}</span>
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
              <div class="bot-card-cta">View process log →</div>
            </a>
          {/each}
        </div>
      </section>
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
  /* ── Page wrapper ── */
  .page {
    max-width: 960px;
    margin: 0 auto;
    padding: 96px 36px 80px;
  }

  /* ── Loading ── */
  .loading {
    color: var(--text-faint);
    text-align: center;
    padding: 60px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  /* ── Error banner ── */
  .error-banner {
    background: var(--rose-dim);
    border: 1px solid rgba(244,114,182,0.2);
    border-radius: 12px;
    padding: 16px 20px;
    color: var(--rose);
    margin-bottom: 24px;
    font-size: 14px;
    font-weight: 300;
  }

  /* ── Status banner ── */
  .status-banner {
    border-radius: 14px;
    padding: 20px 28px;
    margin-bottom: 32px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    position: relative;
    overflow: hidden;
  }

  .status-banner h2 {
    margin: 0 0 6px;
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .status-banner .objective {
    margin: 0;
    font-size: 14px;
    font-weight: 300;
    color: var(--text-muted);
    line-height: 1.65;
  }

  .status-running  { border-left: 3px solid var(--teal); }
  .status-running h2 { color: var(--teal); }

  .status-completed { border-left: 3px solid var(--teal); }
  .status-completed h2 { color: var(--teal); }

  .status-failed { border-left: 3px solid var(--rose); }
  .status-failed h2 { color: var(--rose); }

  .status-paused { border-left: 3px solid var(--amber); }
  .status-paused h2 { color: var(--amber); }

  .status-queued { border-left: 3px solid var(--text-faint); }
  .status-queued h2 { color: var(--text-muted); }

  /* ── Metrics panel ── */
  .metrics-panel {
    margin-bottom: 32px;
  }

  .metrics-panel h3 {
    margin: 0 0 16px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 300;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--text-faint);
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .metrics-panel h3::after {
    content: '';
    display: block;
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, var(--border-mid), transparent);
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  @media (max-width: 640px) {
    .metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .metric-card {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px 18px;
    background: var(--bg-card);
    transition: border-color 0.3s;
  }

  .metric-card:hover {
    border-color: var(--border-mid);
  }

  .metric-label {
    display: block;
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 300;
    color: var(--text-faint);
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
  }

  .metric-value {
    display: block;
    font-family: var(--font-mono);
    font-size: 1.75rem;
    font-weight: 400;
    color: var(--text);
    letter-spacing: -0.02em;
    line-height: 1;
  }

  /* ── Report link ── */
  .report-link {
    margin-bottom: 32px;
  }

  .btn-report {
    display: inline-flex;
    align-items: center;
    padding: 12px 28px;
    background: var(--violet);
    border: none;
    border-radius: 7px;
    color: #fff;
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.03em;
    text-decoration: none;
    box-shadow: 0 4px 20px rgba(124,58,237,0.35);
    transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
  }

  .btn-report:hover {
    opacity: 0.88;
    color: #fff;
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(124,58,237,0.5);
  }

  /* ── Bots section ── */
  .bots-section {
    margin-bottom: 32px;
  }

  .bots-section h3 {
    margin: 0 0 16px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 300;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--text-faint);
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .bots-section h3::after {
    content: '';
    display: block;
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, var(--border-mid), transparent);
  }

  .bots-count {
    font-weight: 300;
    color: var(--text-faint);
    font-size: 10px;
    font-family: var(--font-mono);
    letter-spacing: 0.08em;
  }

  .bots-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
  }

  .bot-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 18px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-card);
    text-decoration: none;
    color: inherit;
    position: relative;
    overflow: hidden;
    transition: border-color 0.3s, transform 0.35s, box-shadow 0.35s;
  }

  .bot-card:hover {
    border-color: var(--border-mid);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }

  .bot-card.bot-active {
    border-left: 3px solid var(--teal);
    padding-left: calc(18px - 2px);
  }

  .bot-card.bot-stopped {
    opacity: 0.5;
  }

  .bot-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .bot-id {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 400;
    color: var(--text);
    letter-spacing: 0.02em;
  }

  .bot-status-pill {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.10em;
    padding: 3px 8px;
    border-radius: 100px;
    white-space: nowrap;
  }

  .bot-status-spawning  { background: var(--amber-dim);  color: var(--amber);         border: 1px solid rgba(251,191,36,0.22);  }
  .bot-status-idle      { background: var(--violet-dim); color: var(--violet-bright); border: 1px solid rgba(167,139,250,0.22); }
  .bot-status-working   { background: var(--teal-dim);   color: var(--teal);          border: 1px solid rgba(45,212,191,0.22);  }
  .bot-status-stopping  { background: var(--amber-dim);  color: var(--amber);         border: 1px solid rgba(251,191,36,0.22);  }
  .bot-status-stopped   { background: transparent;       color: var(--text-faint);    border: 1px solid var(--border);          }
  .bot-status-failed    { background: var(--rose-dim);   color: var(--rose);          border: 1px solid rgba(244,114,182,0.22); }

  .bot-card-stats {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 300;
    color: var(--text-faint);
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .stat-sep { color: var(--border-mid); }
  .stat-fail { color: var(--rose); }

  .bot-card-cta {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 300;
    color: var(--violet-bright);
    letter-spacing: 0.04em;
    margin-top: 4px;
  }

  /* ── Activity feed ── */
  .activity-section {
    margin-bottom: 32px;
  }

  .activity-section h3 {
    margin: 0 0 16px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 300;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--text-faint);
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .activity-section h3::after {
    content: '';
    display: block;
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, var(--border-mid), transparent);
  }

  .empty-feed {
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 300;
    letter-spacing: 0.08em;
    padding: 24px 0;
  }

  .activity-feed {
    max-height: 500px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--bg-card);
  }

  .event {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
  }

  .event:last-child {
    border-bottom: none;
  }

  .event.alert {
    border-left: 2px solid var(--rose);
    background: var(--rose-dim);
    padding-left: calc(16px - 2px);
  }

  .event-type {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 400;
    color: var(--violet-bright);
    min-width: 160px;
    flex-shrink: 0;
    letter-spacing: 0.03em;
  }

  .event.alert .event-type {
    color: var(--rose);
  }

  .event-detail {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 300;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .event-time {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 300;
    color: var(--text-faint);
    flex-shrink: 0;
    letter-spacing: 0.06em;
  }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .page {
      padding: 88px 20px 60px;
    }
    .event {
      flex-wrap: wrap;
      gap: 8px;
    }
    .event-type {
      min-width: auto;
    }
  }
</style>
