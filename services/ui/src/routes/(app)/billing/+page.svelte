<script lang="ts">
  import { browser } from '$app/environment';
  import { getBillingHistory, getBillingSummary } from '$lib/api';
  import type { BillingHistoryEntry, BillingSummary } from '$lib/types';

  let summary = $state<BillingSummary | null>(null);
  let history = $state<BillingHistoryEntry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!browser) return;
    Promise.all([getBillingSummary(), getBillingHistory()])
      .then(([s, h]) => { summary = s; history = h; loading = false; })
      .catch(err => { error = (err as Error).message; loading = false; });
  });

  function avgCostPerExecution(): string {
    if (!summary || summary.executionCount === 0) return '—';
    return '$' + (summary.monthlySpendCents / 100 / summary.executionCount).toFixed(2);
  }
</script>

<svelte:head>
  <title>Billing | Akasa</title>
</svelte:head>

<div class="page">
  <div class="page-header">
    <div class="sec-label">Usage & Billing</div>
    <h1>This month at a glance.</h1>
    <p class="page-sub">Monthly usage summary and historical execution costs.</p>
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error-card">{error}</div>
  {:else}
    <!-- Hero metrics -->
    <section class="section">
      <div class="hero-row">
        <div class="hero-metric hero-primary">
          <span class="hero-value">${summary ? (summary.monthlySpendCents / 100).toFixed(2) : '—'}</span>
          <span class="hero-label">Estimated Spend</span>
        </div>
        <div class="hero-metric">
          <span class="hero-value">{summary ? summary.monthlyBotHours.toFixed(2) : '—'}</span>
          <span class="hero-label">Bot-Hours</span>
        </div>
        <div class="hero-metric">
          <span class="hero-value">{summary ? summary.executionCount : '—'}</span>
          <span class="hero-label">Executions</span>
        </div>
        <div class="hero-metric">
          <span class="hero-value">{avgCostPerExecution()}</span>
          <span class="hero-label">Avg Cost/Execution</span>
        </div>
      </div>
    </section>

    <!-- Execution History -->
    <section class="section">
      <h2>Execution History</h2>
      {#if history.length === 0}
        <p class="empty">No executions yet.</p>
      {:else}
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Objective</th>
                <th>Status</th>
                <th>Tasks</th>
                <th>Bot-Hours</th>
                <th class="col-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {#each history as entry}
                <tr>
                  <td class="col-mono col-date">{new Date(entry.createdAt).toLocaleDateString()}</td>
                  <td class="col-objective">
                    <a href="/executions/{entry.executionId}">
                      {entry.objective.length > 60 ? entry.objective.slice(0, 60) + '...' : entry.objective}
                    </a>
                  </td>
                  <td>
                    <span class="status-badge status-{entry.status}">{entry.status}</span>
                  </td>
                  <td class="col-mono">{entry.taskCount}</td>
                  <td class="col-mono">{entry.totalBotHours.toFixed(3)}</td>
                  <td class="col-right col-mono col-cost">${(entry.totalCostCents / 100).toFixed(2)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .page {
    max-width: 1000px;
    margin: 0 auto;
    padding: 40px var(--space-2xl) 80px;
  }

  @media (max-width: 960px) {
    .page { padding: 32px var(--space-xl) 60px; }
  }

  /* ── Page header ──────────────────────────────── */
  .page-header {
    margin-bottom: var(--space-2xl);
  }

  .page-header h1 {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 600;
    letter-spacing: -0.025em;
    color: var(--text);
    margin: 0 0 var(--space-sm);
  }

  .page-sub {
    color: var(--text-muted);
    margin: 0;
    font-size: 1rem;
    line-height: 1.6;
  }

  /* ── States ───────────────────────────────────── */
  .loading {
    padding: var(--space-2xl);
    text-align: center;
    color: var(--text-muted);
  }

  .error-card {
    padding: 16px var(--space-lg);
    background: var(--error-dim);
    border: 1px solid rgba(248, 113, 113, 0.2);
    border-left: 3px solid var(--error);
    border-radius: 6px;
    color: var(--error);
    font-size: 0.875rem;
  }

  .empty {
    color: var(--text-muted);
    font-style: italic;
  }

  /* ── Section ──────────────────────────────────── */
  .section {
    margin-bottom: var(--space-2xl);
  }

  .section h2 {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--bo-faint);
    margin: 0 0 16px;
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--border);
  }

  /* ── Hero metrics ─────────────────────────────── */
  .hero-row {
    display: grid;
    grid-template-columns: 1.4fr repeat(3, 1fr);
    gap: 16px;
  }

  .hero-metric {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: var(--space-xl) var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .hero-primary {
    border-color: var(--border);
  }

  .hero-value {
    font-family: var(--font-mono);
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
  }

  .hero-primary .hero-value {
    color: var(--accent-m);
    font-size: 2rem;
  }

  .hero-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--bo-faint);
  }

  @media (max-width: 768px) {
    .hero-row {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 480px) {
    .hero-row {
      grid-template-columns: 1fr;
    }
  }

  /* ── Table ────────────────────────────────────── */
  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  thead th {
    text-align: left;
    padding: 12px 16px;
    background: var(--bg3);
    border-bottom: 1px solid var(--border);
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--bo-faint);
    white-space: nowrap;
  }

  tbody td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    background: var(--card);
  }

  tbody tr:hover td {
    background: var(--bg2);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  .col-mono {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
  }

  .col-date {
    color: var(--text-muted);
    white-space: nowrap;
  }

  .col-objective {
    max-width: 360px;
  }

  .col-objective a {
    color: var(--accent-m);
    text-decoration: none;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-objective a:hover {
    color: var(--accent-m);
    text-decoration: underline;
  }

  .col-right {
    text-align: right;
  }

  .col-cost {
    font-weight: 600;
  }

  /* ── Status badge ─────────────────────────────── */
  .status-badge {
    display: inline-block;
    padding: 3px var(--space-sm);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .status-completed { color: var(--accent-m); background: var(--accent-dim); }
  .status-failed    { color: var(--error);         background: var(--error-dim); }
  .status-running   { color: var(--bo-teal);          background: rgba(45, 212, 191, 0.10); }
  .status-queued    { color: var(--bo-faint);    background: var(--bg3); }
  .status-stopped   { color: var(--karma);         background: rgba(251, 191, 36, 0.10); }
  .status-paused    { color: var(--karma);         background: rgba(251, 191, 36, 0.10); }
</style>
