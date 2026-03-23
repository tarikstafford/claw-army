<script lang="ts">
  import { browser } from '$app/environment';
  import { getObjectives, listAllExecutions, getBillingSummary, getPendingVerdicts } from '$lib/api';
  import type { ObjectiveListItem, BillingSummary, PendingVerdict } from '$lib/types';
  import type { AdminExecution } from '$lib/api';

  let objectives = $state<ObjectiveListItem[]>([]);
  let executions = $state<AdminExecution[]>([]);
  let billing = $state<BillingSummary | null>(null);
  let pendingVerdicts = $state<PendingVerdict[]>([]);
  let loading = $state(true);

  let activeExecutions = $derived(executions.filter(e => e.status === 'running' || e.status === 'pre_flight'));
  let recentExecutions = $derived(executions.slice(0, 5));

  $effect(() => {
    if (!browser) return;
    Promise.allSettled([
      getObjectives().then(d => { objectives = d; }),
      listAllExecutions().then(d => { executions = d; }),
      getBillingSummary().then(d => { billing = d; }),
      getPendingVerdicts().then(d => { pendingVerdicts = d; }),
    ]).then(() => { loading = false; });
  });

  function statusColor(status: string): string {
    switch (status) {
      case 'running':   return 'var(--bo-teal)';
      case 'completed': return 'var(--accent-m)';
      case 'failed':    return 'var(--bo-rose)';
      case 'pre_flight': return 'var(--karma)';
      case 'paused':    return 'var(--karma)';
      case 'stopped':   return 'var(--bo-faint)';
      default:          return 'var(--bo-faint)';
    }
  }

  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }
</script>

<div class="page">
  <header class="page-header">
    <span class="page-tag">DB</span>
    <div>
      <h1>Situation Briefing</h1>
      <p class="page-subtitle">Dashboard</p>
    </div>
  </header>

  {#if loading}
    <div class="loading">Loading briefing data...</div>
  {:else}
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-tag">OP</span>
        <span class="metric-value">{activeExecutions.length}</span>
        <span class="metric-label">Active Executions</span>
      </div>
      <div class="metric-card">
        <span class="metric-tag">FN</span>
        <span class="metric-value">{billing ? formatCents(billing.monthlySpendCents) : '--'}</span>
        <span class="metric-label">Monthly Spend</span>
      </div>
      <div class="metric-card">
        <span class="metric-tag">VD</span>
        <span class="metric-value">{pendingVerdicts.length}</span>
        <span class="metric-label">Pending Verdicts</span>
      </div>
      <div class="metric-card">
        <span class="metric-tag">EX</span>
        <span class="metric-value">{executions.length}</span>
        <span class="metric-label">Total Executions</span>
      </div>
    </div>

    <a href="/new-execution" class="quick-launch">
      <span class="quick-launch-icon">+</span>
      Deploy a new crew
    </a>

    {#if recentExecutions.length > 0}
      <section class="section">
        <h2 class="section-title">Recent Executions</h2>
        <div class="exec-list">
          {#each recentExecutions as exec (exec.id)}
            <a href="/executions/{exec.id}" class="exec-row">
              <span class="exec-objective">{exec.objective}</span>
              <span class="exec-status" style="color: {statusColor(exec.status)}">
                <span class="status-dot" style="background: {statusColor(exec.status)}"></span>
                {exec.status.replace(/_/g, ' ')}
              </span>
              <span class="exec-bots">{exec.activeBotCount} bot{exec.activeBotCount !== 1 ? 's' : ''}</span>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    {#if objectives.length > 0}
      <section class="section">
        <h2 class="section-title">Active Objectives</h2>
        <div class="obj-list">
          {#each objectives as obj (obj.id)}
            <a href="/objectives/{obj.id}" class="obj-row">
              <span class="obj-name">{obj.name}</span>
              <span class="obj-runs">{obj.runCount} run{obj.runCount !== 1 ? 's' : ''}</span>
            </a>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .page {
    max-width: 1000px;
    margin: 0 auto;
    padding: 40px 36px 80px;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 32px;
  }

  .page-tag {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.12em;
    color: var(--accent-m);
    background: var(--accent-dim);
    padding: 4px 8px;
    border-radius: 5px;
    margin-top: 6px;
    flex-shrink: 0;
  }

  h1 {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .page-subtitle {
    font-size: 14px;
    color: var(--bo-faint);
    margin: 4px 0 0;
  }

  .loading {
    font-size: 14px;
    color: var(--bo-faint);
    padding: 40px 0;
  }

  /* ── Metrics grid ─────────────────────────────────── */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 14px;
    margin-bottom: 28px;
  }

  .metric-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .metric-tag {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    letter-spacing: 0.15em;
    color: var(--accent-m);
    background: var(--accent-dim);
    padding: 2px 6px;
    border-radius: 4px;
    align-self: flex-start;
  }

  .metric-value {
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 600;
    color: var(--text);
    line-height: 1.1;
  }

  .metric-label {
    font-size: 12px;
    color: var(--bo-faint);
    letter-spacing: 0.02em;
  }

  /* ── Quick launch ─────────────────────────────────── */
  .quick-launch {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    background: var(--accent-dim);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--accent-m);
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    transition: background 0.15s, border-color 0.15s;
    margin-bottom: 32px;
  }

  .quick-launch:hover {
    background: rgba(124,58,237,0.2);
    border-color: var(--border);
  }

  .quick-launch-icon {
    font-size: 16px;
    font-weight: 300;
    line-height: 1;
  }

  /* ── Sections ─────────────────────────────────────── */
  .section {
    margin-bottom: 32px;
  }

  .section-title {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--bo-faint);
    margin: 0 0 12px;
  }

  /* ── Execution list ───────────────────────────────── */
  .exec-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .exec-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 14px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    text-decoration: none;
    transition: border-color 0.15s, background 0.15s;
  }

  .exec-row:hover {
    border-color: var(--border);
    background: var(--card);
  }

  .exec-objective {
    flex: 1;
    font-size: 13.5px;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .exec-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: capitalize;
    flex-shrink: 0;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .exec-bots {
    font-size: 12px;
    color: var(--bo-faint);
    flex-shrink: 0;
    min-width: 50px;
    text-align: right;
  }

  /* ── Objective list ───────────────────────────────── */
  .obj-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .obj-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    text-decoration: none;
    transition: border-color 0.15s, background 0.15s;
  }

  .obj-row:hover {
    border-color: var(--border);
    background: var(--card);
  }

  .obj-name {
    font-size: 13.5px;
    color: var(--text);
  }

  .obj-runs {
    font-size: 12px;
    color: var(--bo-faint);
    flex-shrink: 0;
  }

  @media (max-width: 960px) {
    .page { padding: 32px 20px 60px; }

    .exec-row {
      flex-wrap: wrap;
      gap: 8px;
    }

    .exec-objective {
      width: 100%;
      flex: none;
    }
  }
</style>
