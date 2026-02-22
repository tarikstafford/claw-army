<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getExecutionReport, getLeaderboard } from '$lib/api';
  import type { ExecutionReport, LeaderboardEntry } from '$lib/types';
  import SoulInspectorPanel from '$lib/components/SoulInspectorPanel.svelte';
  import SoulTierBadge from '$lib/components/SoulTierBadge.svelte';

  const executionId = $derived(page.params.id ?? '');

  let report = $state<ExecutionReport | null>(null);
  let leaderboard = $state<LeaderboardEntry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let selectedBotId = $state<string | null>(null);

  $effect(() => {
    if (!browser) return;
    const id = executionId;
    if (!id) return;

    loading = true;
    error = null;

    Promise.all([
      getExecutionReport(id),
      getLeaderboard(id),
    ])
      .then(([r, l]) => { report = r; leaderboard = l; loading = false; })
      .catch(err => { error = (err as Error).message; loading = false; });
  });
</script>

<svelte:head>
  <title>Report — Execution {executionId.slice(0, 8)} | Claw Army</title>
</svelte:head>

<div class="page">
  <nav class="breadcrumb">
    <a href="/executions/{executionId}">Back to Execution</a>
  </nav>

  <h1>Execution Report</h1>
  <p class="subtitle">Execution <code>{executionId.slice(0, 8)}</code></p>

  {#if loading}
    <div class="loading">Loading report...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if report}
    <!-- Execution Summary Panel (UI-06) -->
    <section class="section">
      <h2>Execution Summary</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Total Cost</span>
          <span class="stat-value">${(report.totalCostCents / 100).toFixed(2)}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Total Bot-Hours</span>
          <span class="stat-value">{report.totalBotHours.toFixed(2)}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Tasks Completed</span>
          <span class="stat-value">{report.completedTasks} / {report.totalTasks}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Average Bot Score</span>
          <span class="stat-value">{report.averageBotScore.toFixed(1)}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Top Bot</span>
          <span class="stat-value">{report.topPerformingBotId?.slice(0, 8) ?? 'N/A'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Failed Tasks</span>
          <span class="stat-value">{report.failedTasks}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Cost Per Task</span>
          <span class="stat-value">${(report.costPerTaskCents / 100).toFixed(2)}</span>
        </div>
      </div>
    </section>

    <!-- Bot Leaderboard Table (UI-07) -->
    <section class="section">
      <h2>Bot Leaderboard</h2>
      {#if leaderboard.length === 0}
        <p class="empty">No bots in this execution.</p>
      {:else}
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Bot ID</th>
                <th>Score</th>
                <th>Tier</th>
                <th>Completed</th>
                <th>Failed</th>
                <th>Bot-Hours</th>
                <th>Class</th>
                <th>Verdict</th>
                <th>Pioneer</th>
                <th>Soul</th>
              </tr>
            </thead>
            <tbody>
              {#each leaderboard as entry, i}
                <tr>
                  <td>{i + 1}</td>
                  <td>
                    <a href="/executions/{executionId}/bots/{entry.botId}">
                      {entry.botId.slice(0, 8)}
                    </a>
                  </td>
                  <td>{entry.compositeScore?.toFixed(1) ?? '-'}</td>
                  <td>
                    <span class="tier tier-{entry.tier?.toLowerCase() ?? 'none'}">
                      {entry.tier ?? '-'}
                    </span>
                  </td>
                  <td>{entry.tasksCompleted}</td>
                  <td>{entry.tasksFailed}</td>
                  <td>{entry.botHours?.toFixed(3) ?? '-'}</td>
                  <td>
                    <SoulTierBadge agentClass={entry.agentClass} />
                  </td>
                  <td>
                    {#if entry.verdictType}
                      <span class="verdict-badge verdict-{entry.verdictType.toLowerCase()}">{entry.verdictType}</span>
                      {#if entry.verdictSummary}
                        <span class="verdict-summary">{entry.verdictSummary.length > 60 ? entry.verdictSummary.slice(0, 60) + '...' : entry.verdictSummary}</span>
                      {/if}
                    {:else}
                      <span class="no-data">-</span>
                    {/if}
                  </td>
                  <td>
                    {#if entry.isPioneer}
                      <span class="pioneer-badge" title="Pioneer — first in category">P</span>
                    {:else}
                      <span class="no-data">-</span>
                    {/if}
                  </td>
                  <td>
                    <button class="inspect-soul-btn" onclick={() => selectedBotId = entry.botId}>
                      Inspect
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  {/if}
</div>

<SoulInspectorPanel botId={selectedBotId} onClose={() => selectedBotId = null} />

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
    margin: 0 0 2rem;
    color: #6b7280;
    font-size: 0.9rem;
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

  /* Stats grid: 3 cols on desktop, 2 on tablet, 1 on mobile */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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

  tbody tr:hover {
    background: #f9fafb;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody td a {
    color: #6366f1;
    text-decoration: none;
    font-family: monospace;
    font-weight: 600;
  }

  tbody td a:hover {
    text-decoration: underline;
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

  /* Agent class badges */
  .class-badge {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  .class-novice {
    color: #3b82f6;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
  }

  .class-understudy {
    color: #8b5cf6;
    background: #f5f3ff;
    border: 1px solid #ddd6fe;
  }

  .class-artisan {
    color: #d97706;
    background: #fffbeb;
    border: 1px solid #fde68a;
  }

  .class-retired {
    color: #6b7280;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
  }

  .class-none {
    color: #6b7280;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
  }

  /* Pioneer badge */
  .pioneer-badge {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #fef3c7;
    color: #92400e;
    font-weight: 700;
    font-size: 0.7rem;
    border: 1px solid #fde68a;
  }

  /* Verdict badges */
  .verdict-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  .verdict-promote {
    color: #16a34a;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
  }

  .verdict-retire {
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
  }

  .verdict-demote {
    color: #ea580c;
    background: #fff7ed;
    border: 1px solid #fed7aa;
  }

  .verdict-monitor {
    color: #ca8a04;
    background: #fefce8;
    border: 1px solid #fde68a;
  }

  .verdict-maintain {
    color: #2563eb;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
  }

  .verdict-summary {
    display: block;
    font-size: 0.75rem;
    color: #6b7280;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 0.2rem;
  }

  .no-data {
    color: #9ca3af;
  }

  .inspect-soul-btn {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.2rem 0.55rem;
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
</style>
