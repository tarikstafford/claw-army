<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getExecution, getExecutionMetrics, getExecutionBots, getExecutionPendingVerdicts, getRingLeaderManifest, getRingLeaderState } from '$lib/api';
  import { connectSSE } from '$lib/sse';
  import type { Execution, ExecutionMetrics, ActivityEvent, ExecutionBot, VerdictDetail, RingLeaderManifestResponse, RingLeaderStateResponse } from '$lib/types';
  import SoulInspectorPanel from '$lib/components/SoulInspectorPanel.svelte';
  import SoulTierBadge from '$lib/components/SoulTierBadge.svelte';
  import VerdictConfirmPanel from '$lib/components/VerdictConfirmPanel.svelte';

  let { data } = $props();
  let userId = $derived(data.session?.user?.email ?? 'operator');

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
  let manifest = $state<RingLeaderManifestResponse | null>(null);
  let ringLeaderState = $state<RingLeaderStateResponse | null>(null);

  // Initial load
  $effect(() => {
    if (!browser) return;
    getExecution(executionId)
      .then(data => { execution = data; loading = false; })
      .catch(err => { error = (err as Error).message; loading = false; });
  });

  // Population manifest — fetch once on mount (silently ignore non-Ring-Leader 404s)
  $effect(() => {
    if (!browser) return;
    getRingLeaderManifest(executionId).then(m => { manifest = m; }).catch(() => {});
  });

  // Ring Leader state polling — fetch immediately and every 5 seconds while non-terminal
  $effect(() => {
    if (!browser) return;
    const isTerminal =
      execution?.status === 'completed' ||
      execution?.status === 'failed' ||
      execution?.status === 'stopped';

    getRingLeaderState(executionId).then(s => { ringLeaderState = s; }).catch(() => {});

    if (isTerminal) return;

    const interval = setInterval(() => {
      getRingLeaderState(executionId).then(s => { ringLeaderState = s; }).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
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

  function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  }

  function driftClass(score: number): string {
    if (score > 0.35) return 'drift-error';
    if (score >= 0.20) return 'drift-amber';
    return 'drift-teal';
  }

  function taskStatusClass(status: string): string {
    switch (status) {
      case 'active':
      case 'completing':
      case 'complete': return 'task-status-teal';
      case 'failed':   return 'task-status-error';
      default:         return 'task-status-faint';
    }
  }

  function truncate(str: string, max: number): string {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
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

    <!-- Population Manifest panel (DASH-01) -->
    <section class="manifest-section">
      <h3>Population Manifest</h3>
      {#if manifest && manifest.manifests.length > 0}
        <div class="manifest-cards">
          {#each manifest.manifests as task (task.taskId)}
            <div class="manifest-card">
              <div class="manifest-card-header">
                <span class="manifest-task-desc">{task.taskDescription}</span>
                {#if task.pioneerFlag}
                  <span class="pioneer-badge">Pioneer</span>
                {/if}
              </div>
              <div class="soul-table">
                <div class="soul-table-head">
                  <span>Soul ID</span>
                  <span>Class</span>
                  <span>Source</span>
                  <span class="soul-col-rationale">Rationale</span>
                  <span>Score</span>
                </div>
                {#each task.assignedSouls as soul (soul.soulId)}
                  <div class="soul-row">
                    <span class="soul-id-mono">{soul.soulId.slice(0, 8)}</span>
                    <span><SoulTierBadge agentClass={soul.agentClass} /></span>
                    <span class="source-pill source-{soul.source}">{soul.source}</span>
                    <span class="soul-rationale">{truncate(soul.selectionRationale, 120)}</span>
                    <span class="diff-score">{soul.differentiationScore.toFixed(2)}</span>
                  </div>
                {/each}
              </div>
              {#if task.varianceIntent}
                <p class="variance-intent"><em>{task.varianceIntent}</em></p>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-feed">No population manifest available.</p>
      {/if}
    </section>

    <!-- Ring Leader state panel (DASH-02) -->
    {#if ringLeaderState?.runState}
      {@const runState = ringLeaderState.runState}
      <section class="ring-leader-section">
        <h3>Ring Leader</h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-label">Budget Consumed</span>
            <span class="metric-value">${(runState.budgetConsumedCents / 100).toFixed(2)}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Drift Score</span>
            <span class="metric-value {driftClass(runState.objectiveDriftScore)}">{runState.objectiveDriftScore.toFixed(2)}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Elapsed</span>
            <span class="metric-value">{formatElapsed(runState.elapsedTimeSeconds)}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Anomalies</span>
            <span class="metric-value {runState.anomalies.length > 0 ? 'anomaly-error' : 'anomaly-teal'}">{runState.anomalies.length}</span>
          </div>
        </div>

        <!-- Per-task state summary -->
        {#if Object.keys(runState.taskStates).length > 0}
          <div class="task-states">
            {#each Object.entries(runState.taskStates) as [taskId, state] (taskId)}
              <div class="task-state-row">
                <span class="task-id-mono">{taskId.slice(0, 12)}</span>
                <span class="task-status-pill {taskStatusClass(state.status)}">{state.status}</span>
                <span class="task-agents">
                  <span class="ta-active">{state.activeAgents.length} active</span>
                  <span class="ta-sep">·</span>
                  <span class="ta-done">{state.completedAgents.length} done</span>
                  {#if state.failedAgents.length > 0}
                    <span class="ta-sep">·</span>
                    <span class="ta-fail">{state.failedAgents.length} fail</span>
                  {/if}
                </span>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Anomalies list (up to 5) -->
        {#if runState.anomalies.length > 0}
          <div class="anomalies-list">
            <span class="anomalies-label">Anomalies</span>
            {#each runState.anomalies.slice(0, 5) as anomaly, i (i)}
              <div class="anomaly-item">{anomaly}</div>
            {/each}
            {#if runState.anomalies.length > 5}
              <div class="anomaly-more">+{runState.anomalies.length - 5} more</div>
            {/if}
          </div>
        {/if}
      </section>
    {/if}

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
        userId={userId}
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
    background: var(--error-dim);
    border: 1px solid rgba(248,113,113,0.25);
    border-radius: 12px;
    padding: 16px 20px;
    color: var(--error);
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

  .status-failed { border-left: 3px solid var(--error); }
  .status-failed h2 { color: var(--error); }

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
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
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

  .bot-card.bot-failed {
    border-left: 3px solid var(--error);
    padding-left: calc(18px - 2px);
  }

  .bot-card-top {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
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
  .bot-status-failed    { background: var(--error-dim);  color: var(--error);         border: 1px solid rgba(248,113,113,0.22); }

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
  .stat-fail { color: var(--error); }

  .bot-task-desc {
    font-size: 12px;
    font-weight: 300;
    color: var(--text-muted);
    background: var(--violet-dim);
    border: 1px solid var(--border-mid);
    border-radius: 6px;
    padding: 5px 8px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .bot-live-stats {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 300;
    color: var(--text-faint);
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .bot-error-msg {
    font-size: 12px;
    font-weight: 300;
    color: var(--error);
    background: var(--error-dim);
    border: 1px solid rgba(248,113,113,0.22);
    border-radius: 6px;
    padding: 5px 8px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .bot-card-cta {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 300;
    color: var(--violet-bright);
    letter-spacing: 0.04em;
    margin-top: 4px;
  }

  .inspect-soul-btn {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.10em;
    padding: 3px 8px;
    border-radius: 100px;
    border: 1px solid var(--border-mid);
    background: var(--violet-dim);
    color: var(--violet-bright);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s, border-color 0.2s;
  }

  .inspect-soul-btn:hover {
    background: rgba(124,58,237,0.25);
    border-color: var(--border-hi);
  }

  .verdict-pending-btn {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.10em;
    padding: 3px 8px;
    border-radius: 100px;
    border: 1px solid rgba(251,191,36,0.3);
    background: var(--amber-dim);
    color: var(--amber);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s, border-color 0.2s;
    animation: pulse-verdict 2s ease-in-out infinite;
  }

  .verdict-pending-btn:hover {
    background: rgba(251,191,36,0.2);
    border-color: rgba(251,191,36,0.5);
  }

  @keyframes pulse-verdict {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.65; }
  }

  /* ── Population Manifest panel ── */
  .manifest-section {
    margin-bottom: 32px;
  }

  .manifest-section h3 {
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

  .manifest-section h3::after {
    content: '';
    display: block;
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, var(--border-mid), transparent);
  }

  .manifest-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .manifest-card {
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 18px 20px;
    background: var(--bg-card);
  }

  .manifest-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }

  .manifest-task-desc {
    font-size: 14px;
    font-weight: 300;
    color: var(--text);
    line-height: 1.5;
    flex: 1;
  }

  .pioneer-badge {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.10em;
    padding: 3px 8px;
    border-radius: 100px;
    background: var(--amber-dim);
    color: var(--amber);
    border: 1px solid rgba(251,191,36,0.22);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .soul-table {
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }

  .soul-table-head {
    display: grid;
    grid-template-columns: 90px 90px 80px 1fr 60px;
    gap: 12px;
    padding: 8px 12px;
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-faint);
    background: rgba(148,110,255,0.04);
    border-bottom: 1px solid var(--border);
  }

  .soul-row {
    display: grid;
    grid-template-columns: 90px 90px 80px 1fr 60px;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
  }

  .soul-row:last-child {
    border-bottom: none;
  }

  .soul-id-mono {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }

  .source-pill {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.10em;
    padding: 3px 7px;
    border-radius: 100px;
    white-space: nowrap;
    display: inline-block;
  }

  .source-library  { background: var(--teal-dim);   color: var(--teal);          border: 1px solid rgba(45,212,191,0.20);  }
  .source-generated { background: var(--violet-dim); color: var(--violet-bright); border: 1px solid rgba(124,58,237,0.20);  }
  .source-mutated  { background: var(--amber-dim);  color: var(--amber);         border: 1px solid rgba(251,191,36,0.20);  }

  .soul-rationale {
    font-size: 12px;
    font-weight: 300;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .diff-score {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 400;
    color: var(--text-muted);
    text-align: right;
  }

  .variance-intent {
    margin-top: 10px;
    font-size: 12px;
    font-weight: 300;
    color: var(--text-faint);
    font-style: italic;
  }

  /* ── Ring Leader state panel ── */
  .ring-leader-section {
    margin-bottom: 32px;
  }

  .ring-leader-section h3 {
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

  .ring-leader-section h3::after {
    content: '';
    display: block;
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, var(--border-mid), transparent);
  }

  .drift-teal  { color: var(--teal) !important; }
  .drift-amber { color: var(--amber) !important; }
  .drift-error { color: var(--error) !important; }
  .anomaly-teal  { color: var(--teal) !important; }
  .anomaly-error { color: var(--error) !important; }

  .task-states {
    margin-top: 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }

  .task-state-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }

  .task-state-row:last-child {
    border-bottom: none;
  }

  .task-id-mono {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted);
    letter-spacing: 0.04em;
    min-width: 100px;
    flex-shrink: 0;
  }

  .task-status-pill {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.10em;
    padding: 3px 8px;
    border-radius: 100px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .task-status-teal  { background: var(--teal-dim);   color: var(--teal);       border: 1px solid rgba(45,212,191,0.22); }
  .task-status-error { background: var(--error-dim);  color: var(--error);      border: 1px solid rgba(248,113,113,0.22); }
  .task-status-faint { background: transparent;       color: var(--text-faint); border: 1px solid var(--border); }

  .task-agents {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 300;
    color: var(--text-faint);
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
  }

  .ta-active { color: var(--teal); }
  .ta-done   { color: var(--text-muted); }
  .ta-fail   { color: var(--error); }
  .ta-sep    { color: var(--border-mid); }

  .anomalies-list {
    margin-top: 14px;
    border: 1px solid rgba(248,113,113,0.20);
    border-radius: 10px;
    overflow: hidden;
    background: var(--error-dim);
  }

  .anomalies-label {
    display: block;
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--error);
    padding: 8px 12px;
    border-bottom: 1px solid rgba(248,113,113,0.15);
    background: rgba(248,113,113,0.06);
  }

  .anomaly-item {
    padding: 8px 12px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 300;
    color: var(--text-muted);
    border-bottom: 1px solid rgba(248,113,113,0.10);
    line-height: 1.45;
  }

  .anomaly-item:last-child {
    border-bottom: none;
  }

  .anomaly-more {
    padding: 6px 12px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 300;
    color: var(--error);
    letter-spacing: 0.06em;
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
    border-left: 2px solid var(--error);
    background: var(--error-dim);
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
    color: var(--error);
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
