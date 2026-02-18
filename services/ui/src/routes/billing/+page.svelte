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
  <title>Usage & Billing | Claw Army</title>
</svelte:head>

<div class="page">
  <h1>Usage & Billing</h1>
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
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
  }

  .subtitle {
    color: #6b7280;
    margin: 0 0 2rem;
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

  /* Summary stat cards — same pattern as other screens */
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

  .col-objective {
    max-width: 360px;
  }

  .col-objective a {
    color: #6366f1;
    text-decoration: none;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-objective a:hover {
    text-decoration: underline;
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
</style>
