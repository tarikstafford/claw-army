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
</script>

<svelte:head>
  <title>Billing | Akasa</title>
</svelte:head>

<div class="page">
  <div class="sec-label">Usage & Billing</div>
  <h1>This month at a glance.</h1>
  <p class="subtitle">Monthly usage summary and historical execution costs.</p>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <!-- Monthly Summary Panel (UI-10) -->
    <section class="section">
      <h2>This Month</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Bot-Hours This Month</span>
          <span class="stat-value">{summary ? summary.monthlyBotHours.toFixed(2) : '—'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Estimated Spend</span>
          <span class="stat-value">${summary ? (summary.monthlySpendCents / 100).toFixed(2) : '—'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Executions This Month</span>
          <span class="stat-value">{summary ? summary.executionCount : '—'}</span>
        </div>
      </div>
    </section>

    <!-- Historical Execution List (METR-05) -->
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
                <th class="col-cost">Cost</th>
              </tr>
            </thead>
            <tbody>
              {#each history as entry}
                <tr>
                  <td class="col-date">{new Date(entry.createdAt).toLocaleDateString()}</td>
                  <td class="col-objective">
                    <a href="/executions/{entry.executionId}">
                      {entry.objective.length > 60 ? entry.objective.slice(0, 60) + '...' : entry.objective}
                    </a>
                  </td>
                  <td>
                    <span class="status status-{entry.status}">{entry.status}</span>
                  </td>
                  <td>{entry.taskCount}</td>
                  <td>{entry.totalBotHours.toFixed(3)}</td>
                  <td class="col-cost">${(entry.totalCostCents / 100).toFixed(2)}</td>
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
    padding: 100px 36px 80px;
  }

  h1 {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 600;
    letter-spacing: -0.025em;
    color: var(--text);
    margin: 0 0 0.5rem;
  }

  .subtitle {
    color: var(--text-muted);
    margin: 0 0 2.5rem;
    font-size: 1rem;
    font-family: var(--font-body);
    line-height: 1.6;
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
    border-radius: 14px;
    color: var(--error);
  }

  .section {
    margin-bottom: 2.5rem;
  }

  .section h2 {
    font-size: 1.25rem;
    font-weight: 600;
    font-family: var(--font-display);
    color: var(--text);
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
  }

  /* Summary stat cards */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  @media (max-width: 960px) {
    .page { padding: 100px 24px 60px; }
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
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-align: center;
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
    font-family: var(--font-mono);
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text);
    font-family: var(--font-mono);
  }

  .empty {
    color: var(--text-muted);
    font-style: italic;
  }

  /* Execution history table */
  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 14px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  thead th {
    text-align: left;
    padding: 0.75rem 1rem;
    background: var(--bg-3);
    border-bottom: 1px solid var(--border);
    font-weight: 600;
    color: var(--text-faint);
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  tbody td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    background: var(--bg-card);
  }

  tbody tr:hover td {
    background: var(--bg-2);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  .col-date {
    white-space: nowrap;
    font-size: 0.85rem;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  .col-objective {
    max-width: 360px;
  }

  .col-objective a {
    color: var(--violet-bright);
    text-decoration: none;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-objective a:hover {
    color: var(--violet-light);
    text-decoration: underline;
  }

  .col-cost {
    text-align: right;
    font-weight: 600;
    font-family: var(--font-mono);
    color: var(--text);
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
    font-family: var(--font-mono);
  }

  .status-completed { color: var(--violet-bright); background: var(--violet-dim);  border: 1px solid var(--violet-bright); }
  .status-failed    { color: var(--error);          background: var(--error-dim);   border: 1px solid var(--error); }
  .status-running   { color: var(--teal);           background: var(--teal-dim);    border: 1px solid var(--teal); }
  .status-queued    { color: var(--text-faint);     background: var(--bg-3);        border: 1px solid var(--border); }
  .status-stopped   { color: var(--amber);          background: var(--amber-dim);   border: 1px solid var(--amber); }
  .status-paused    { color: var(--amber);          background: var(--amber-dim);   border: 1px solid var(--amber); }
</style>
