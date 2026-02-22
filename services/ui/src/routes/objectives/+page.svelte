<script lang="ts">
  import { browser } from '$app/environment';
  import { getObjectives } from '$lib/api';
  import type { ObjectiveListItem } from '$lib/types';

  let objectives = $state<ObjectiveListItem[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!browser) return;
    getObjectives()
      .then(data => { objectives = data; loading = false; })
      .catch(err => { error = (err as Error).message; loading = false; });
  });
</script>

<svelte:head>
  <title>Objectives | Claw Army</title>
</svelte:head>

<div class="page">
  <h1>Objectives</h1>
  <p class="subtitle">Your saved objectives and their run history.</p>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    {#if objectives.length === 0}
      <p class="empty">No objectives yet. Create one from the Deploy Crew page.</p>
    {:else}
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Last Run</th>
              <th>Runs</th>
              <th class="col-cost">Total Spend</th>
              <th>Best Class</th>
            </tr>
          </thead>
          <tbody>
            {#each objectives as obj}
              <tr>
                <td class="col-name">
                  <a href="/objectives/{obj.id}">
                    {obj.name.length > 50 ? obj.name.slice(0, 50) + '...' : obj.name}
                  </a>
                </td>
                <td>
                  {#if obj.lastRunStatus}
                    <span class="status status-{obj.lastRunStatus}">{obj.lastRunStatus}</span>
                  {:else}
                    <span class="no-runs">No runs</span>
                  {/if}
                </td>
                <td>{obj.runCount}</td>
                <td class="col-cost">${(obj.totalSpendCents / 100).toFixed(2)}</td>
                <td>
                  {#if obj.bestBotClass}
                    <span class="class-badge class-{obj.bestBotClass.toLowerCase()}">{obj.bestBotClass}</span>
                  {:else}
                    <span class="no-class">---</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
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

  .empty {
    color: #9ca3af;
    font-style: italic;
  }

  /* Objectives table */
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

  .col-name {
    max-width: 360px;
  }

  .col-name a {
    color: #6366f1;
    text-decoration: none;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-name a:hover {
    text-decoration: underline;
  }

  .col-cost {
    text-align: right;
    font-weight: 600;
  }

  .no-runs {
    color: #9ca3af;
    font-size: 0.85rem;
  }

  .no-class {
    color: #9ca3af;
    font-size: 0.85rem;
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

  /* Class badge */
  .class-badge {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .class-novice {
    color: #6b7280;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
  }

  .class-understudy {
    color: #7c3aed;
    background: #f5f3ff;
    border: 1px solid #ddd6fe;
  }

  .class-artisan {
    color: #d97706;
    background: #fffbeb;
    border: 1px solid #fde68a;
  }

  .class-retired {
    color: #9ca3af;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
  }
</style>
