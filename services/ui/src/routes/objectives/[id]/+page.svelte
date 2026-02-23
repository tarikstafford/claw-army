<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getObjective, getObjectiveExecutions, getObjectiveStats, getExecutionMetrics } from '$lib/api';
  import { connectSSE } from '$lib/sse';
  import type { Objective, ObjectiveRun, ObjectiveStats, ExecutionMetrics, ActivityEvent } from '$lib/types';

  const objectiveId = $derived(page.params.id ?? '');

  let objective = $state<Objective | null>(null);
  let runs = $state<ObjectiveRun[]>([]);
  let stats = $state<ObjectiveStats | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Live status (HUB-03)
  // activeRunId is a separate $state (NOT $derived from runs) to avoid the infinite re-run pitfall.
  // It is set once after initial load and cleared when a terminal execution_status_changed event arrives.
  let activeRunId = $state<string | null>(null);
  let liveMetrics = $state<ExecutionMetrics | null>(null);
  let activityFeed = $state<ActivityEvent[]>([]);

  // Effect 1 — Load all data on mount
  $effect(() => {
    if (!browser || !objectiveId) return;
    loading = true;
    Promise.all([
      getObjective(objectiveId),
      getObjectiveExecutions(objectiveId),
      getObjectiveStats(objectiveId),
    ])
      .then(([obj, r, s]) => {
        objective = obj;
        runs = r;
        stats = s;
        // Set activeRunId from loaded data (one-time)
        const running = r.find(run => run.status === 'running');
        activeRunId = running?.id ?? null;
        loading = false;
      })
      .catch(err => { error = (err as Error).message; loading = false; });
  });

  // Effect 2 — SSE + metrics polling for live status (HUB-03)
  $effect(() => {
    if (!browser || !activeRunId) return;
    const runId = activeRunId; // capture for cleanup closure

    // Initial metrics fetch
    getExecutionMetrics(runId).then(m => { liveMetrics = m; }).catch(() => {});

    // Poll metrics every 5 seconds
    const interval = setInterval(() => {
      getExecutionMetrics(runId).then(m => { liveMetrics = m; }).catch(() => {});
    }, 5000);

    // SSE for activity events (keep last 5)
    const cleanup = connectSSE(runId, (event) => {
      activityFeed = [event, ...activityFeed].slice(0, 5);
      // If execution reaches terminal state, clear activeRunId to disconnect
      if (event.type === 'execution_status_changed') {
        const toStatus = event['toStatus'] as string | undefined;
        if (toStatus === 'completed' || toStatus === 'failed' || toStatus === 'stopped') {
          activeRunId = null;
          // Refresh runs to update status in table
          getObjectiveExecutions(objectiveId).then(r => { runs = r; }).catch(() => {});
          getObjectiveStats(objectiveId).then(s => { stats = s; }).catch(() => {});
        }
      }
    });

    return () => { clearInterval(interval); cleanup?.(); };
  });

  function formatEventDetail(event: ActivityEvent): string {
    const botId = event['botId'] as string | undefined;
    const short = botId ? botId.slice(0, 8) : 'unknown';
    const reason = event['reason'] as string | undefined;
    switch (event.type) {
      case 'task_claimed': return `Bot ${short} claimed task`;
      case 'task_completed': return `Task completed by bot ${short}`;
      case 'bot_started': return `Bot ${short} started`;
      case 'bot_stopped': return `Bot ${short} stopped${reason ? ` (${reason})` : ''}`;
      case 'guardrail_triggered': return `Bot ${short}: ${reason ?? 'guardrail triggered'}`;
      case 'budget_exceeded': return 'Budget exceeded for execution';
      default: {
        const { type: _type, executionId: _eid, timestamp: _ts, isAlert: _ia, ...rest } = event;
        const detail = JSON.stringify(rest);
        return detail.length > 120 ? detail.slice(0, 117) + '...' : detail;
      }
    }
  }
</script>

<svelte:head>
  <title>{objective?.name ?? 'Objective'} | Claw Army</title>
</svelte:head>

<div class="page">
  {#if loading}
    <div class="loading">Loading objective...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}

    <!-- Section 1: Objective Header -->
    <h1>{objective?.name ?? 'Objective'}</h1>
    {#if objective?.description}
      <p class="subtitle">{objective.description}</p>
    {/if}
    <p class="meta">Created {new Date(objective?.createdAt ?? '').toLocaleDateString()} | Default bots: {objective?.defaultMaxBots}</p>

    <div class="launch-row">
      <a
        href="/new-execution?objectiveId={objectiveId}&maxBots={objective?.defaultMaxBots ?? 3}&budgetCapDollars={objective?.defaultBudgetCapCents ? objective.defaultBudgetCapCents / 100 : 10}"
        class="launch-objective-btn"
      >
        Launch from this objective
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
    </div>

    <!-- Section 2: Aggregate Stats Panel (HUB-02) -->
    <section class="section">
      <h2>Aggregate Stats</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Total Spend</span>
          <span class="stat-value">${stats ? (stats.totalSpendCents / 100).toFixed(2) : '---'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Tasks Completed</span>
          <span class="stat-value">{stats?.totalTasksCompleted ?? '---'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Bot-Hours</span>
          <span class="stat-value">{stats ? stats.totalBotHours.toFixed(2) : '---'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Total Runs</span>
          <span class="stat-value">{stats?.runCount ?? '---'}</span>
        </div>
      </div>
    </section>

    <!-- Section 3: Live Status Panel (HUB-03) — conditional -->
    {#if activeRunId}
      <section class="section live-section">
        <h2>Live Run</h2>
        <div class="live-panel">
          <div class="live-stats">
            <div class="live-stat">
              <span class="live-label">Active Bots</span>
              <span class="live-value">{liveMetrics?.activeBotCount ?? '---'}</span>
            </div>
            <div class="live-stat">
              <span class="live-label">Budget Burn</span>
              <span class="live-value">${liveMetrics ? (liveMetrics.spentCents / 100).toFixed(2) : '---'} / ${liveMetrics ? (liveMetrics.budgetCapCents / 100).toFixed(2) : '---'}</span>
            </div>
            <div class="live-stat">
              <span class="live-label">Remaining</span>
              <span class="live-value">${liveMetrics ? (liveMetrics.remainingCents / 100).toFixed(2) : '---'}</span>
            </div>
          </div>
          <div class="activity-feed">
            <h3>Recent Activity</h3>
            {#if activityFeed.length === 0}
              <p class="empty">Waiting for events...</p>
            {:else}
              {#each activityFeed as event}
                <div class="activity-item">
                  <span class="activity-detail">{formatEventDetail(event)}</span>
                  <span class="activity-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
              {/each}
            {/if}
            <a href="/executions/{activeRunId}" class="view-full-run">View full run &rarr;</a>
          </div>
        </div>
      </section>
    {/if}

    <!-- Section 4: Run History Table (HUB-01) -->
    <section class="section">
      <h2>Run History</h2>
      {#if runs.length === 0}
        <p class="empty">No runs yet for this objective.</p>
      {:else}
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Bots</th>
                <th>Avg Score</th>
                <th class="col-cost">Cost</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each runs as run}
                <tr>
                  <td class="col-date">{new Date(run.createdAt).toLocaleDateString()}</td>
                  <td><span class="status status-{run.status}">{run.status}</span></td>
                  <td>{run.botCount}</td>
                  <td>{run.avgCompositeScore !== null ? run.avgCompositeScore.toFixed(2) : '---'}</td>
                  <td class="col-cost">${(run.totalCostCents / 100).toFixed(2)}</td>
                  <td><a href="/executions/{run.id}" class="view-link">View</a></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    <!-- Section 5: DNA Evolution Summary (HUB-04) -->
    <section class="section">
      <h2>DNA Evolution</h2>
      {#if stats && stats.runCount > 0}
        <p class="trend-summary">{stats.classTrendSummary}</p>
        <div class="class-list">
          <div class="class-item">
            <span class="class-badge class-artisan">Artisan</span>
            <span class="class-count">{stats.classBreakdown.artisan}</span>
          </div>
          <div class="class-item">
            <span class="class-badge class-understudy">Understudy</span>
            <span class="class-count">{stats.classBreakdown.understudy}</span>
          </div>
          <div class="class-item">
            <span class="class-badge class-novice">Novice</span>
            <span class="class-count">{stats.classBreakdown.novice}</span>
          </div>
          <div class="class-item">
            <span class="class-badge class-retired">Retired</span>
            <span class="class-count">{stats.classBreakdown.retired}</span>
          </div>
        </div>
      {:else}
        <p class="empty">Run this objective to start evolving your army's DNA.</p>
      {/if}
    </section>

  {/if}
</div>

<style>
  .page {
    max-width: 1000px;
    margin: 0 auto;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
  }

  .subtitle {
    color: #6b7280;
    margin: 0 0 0.25rem;
    font-size: 0.9rem;
  }

  .meta { font-size: 0.85rem; color: #6b7280; margin: 0 0 0.5rem; }

  .launch-row {
    margin: 1rem 0 2rem;
  }

  .launch-objective-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: #4f46e5;
    color: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 0.375rem;
    text-decoration: none;
    transition: background 0.15s;
  }

  .launch-objective-btn:hover {
    background: #4338ca;
  }

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

  /* Summary stat cards */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }

  .stat-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-align: center;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
  }

  .empty {
    color: #9ca3af;
    font-style: italic;
  }

  /* Live panel */
  .live-section { border: 1px solid #bfdbfe; border-radius: 0.5rem; padding: 1rem 1.25rem; background: #eff6ff; }
  .live-panel { display: flex; gap: 2rem; flex-wrap: wrap; }
  .live-stats { display: flex; gap: 1.5rem; flex-wrap: wrap; }
  .live-stat { display: flex; flex-direction: column; gap: 0.25rem; }
  .live-label { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  .live-value { font-size: 1.25rem; font-weight: 700; color: #111827; }
  .activity-feed { flex: 1; min-width: 200px; }
  .activity-feed h3 { font-size: 0.875rem; font-weight: 600; margin: 0 0 0.5rem; color: #374151; }
  .activity-item { display: flex; justify-content: space-between; padding: 0.375rem 0; border-bottom: 1px solid #e5e7eb; font-size: 0.8125rem; }
  .activity-detail {
    color: #374151;
    font-size: 0.8125rem;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .activity-time { color: #9ca3af; font-size: 0.75rem; }
  .view-full-run {
    display: inline-block;
    margin-top: 0.75rem;
    font-size: 0.8125rem;
    color: #6366f1;
    text-decoration: none;
    font-weight: 500;
  }
  .view-full-run:hover {
    text-decoration: underline;
  }

  /* Execution history table */
  .table-wrapper {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  thead th {
    text-align: left;
    padding: 0.75rem 1rem;
    background: #f3f4f6;
    border-bottom: 2px solid #e5e7eb;
    font-weight: 600;
    color: #374151;
    white-space: nowrap;
  }

  tbody td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    color: #374151;
  }

  tbody tr:nth-child(even) {
    background: #f9fafb;
  }

  tbody tr:hover {
    background: #f0f4ff;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  .col-date {
    white-space: nowrap;
    font-size: 0.85rem;
    color: #6b7280;
  }

  .col-cost {
    text-align: right;
    font-weight: 600;
  }

  /* Status badge */
  .status {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  .status-completed {
    color: #16a34a;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
  }

  .status-failed {
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
  }

  .status-running {
    color: #0066cc;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
  }

  .status-queued {
    color: #6b7280;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
  }

  .status-stopped {
    color: #ca8a04;
    background: #fefce8;
    border: 1px solid #fde68a;
  }

  .status-paused {
    color: #ca8a04;
    background: #fefce8;
    border: 1px solid #fde68a;
  }

  /* DNA Evolution */
  .class-list { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.75rem; }
  .class-item { display: flex; align-items: center; gap: 0.5rem; }
  .class-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
  .class-novice { color: #6b7280; background: #f3f4f6; border: 1px solid #e5e7eb; }
  .class-understudy { color: #7c3aed; background: #f5f3ff; border: 1px solid #ddd6fe; }
  .class-artisan { color: #d97706; background: #fffbeb; border: 1px solid #fde68a; }
  .class-retired { color: #9ca3af; background: #f9fafb; border: 1px solid #e5e7eb; }
  .class-count { font-size: 0.9rem; font-weight: 600; color: #111827; }
  .trend-summary { font-size: 1rem; color: #374151; font-weight: 500; margin: 0; }

  /* View link in table */
  .view-link { color: #6366f1; text-decoration: none; font-weight: 500; }
  .view-link:hover { text-decoration: underline; }
</style>
