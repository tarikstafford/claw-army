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
  <title>Objectives | Akasa</title>
</svelte:head>

<div class="page">
  <div class="page-header">
    <div>
      <div class="sec-label">Objectives</div>
      <h1>Mission library.</h1>
      <p class="subtitle">Your saved objectives and their run history.</p>
    </div>
    <a href="/new-execution" class="btn-deploy">Deploy new crew</a>
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">
      <span class="error-title">Unable to load objectives</span>
      <span class="error-detail">{error}</span>
    </div>
  {:else}
    {#if objectives.length === 0}
      <p class="empty">No objectives yet. Deploy a crew above to get started.</p>
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
    padding: 100px 36px 80px;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    margin-bottom: 0;
  }

  .btn-deploy {
    display: inline-flex;
    align-items: center;
    padding: 0.55rem 1.1rem;
    background: var(--violet);
    color: white;
    font-size: 13.5px;
    font-weight: 600;
    border-radius: 10px;
    text-decoration: none;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 2.25rem;
    transition: background 0.15s;
  }

  .btn-deploy:hover { background: var(--violet-bright); }

  h1 {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 600;
    letter-spacing: -0.025em;
    margin: 0 0 0.5rem;
    color: var(--text);
  }

  .subtitle {
    color: var(--text-muted);
    margin: 0 0 2.5rem;
    font-size: 1rem;
    line-height: 1.6;
  }

  .loading {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }

  .error {
    padding: 1.25rem 1.5rem;
    background: var(--error-dim);
    border: 1px solid rgba(248,113,113,0.25);
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .error-title {
    color: var(--error);
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .error-detail {
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }

  .empty {
    color: var(--text-muted);
    font-style: italic;
  }

  @media (max-width: 960px) {
    .page { padding: 100px 24px 60px; }
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
    background: var(--bg-3);
    border-bottom: 1px solid var(--border);
    font-weight: 600;
    color: var(--text-faint);
    white-space: nowrap;
    font-family: var(--font-mono);
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.15em;
  }

  tbody td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }

  tbody tr {
    background: var(--bg-card);
  }

  tbody tr:nth-child(even) {
    background: var(--bg-3);
  }

  tbody tr:hover {
    background: var(--bg-card-2);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  .col-name {
    max-width: 360px;
  }

  .col-name a {
    color: var(--violet-bright);
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
    font-family: var(--font-mono);
  }

  .no-runs {
    color: var(--text-faint);
    font-size: 0.85rem;
  }

  .no-class {
    color: var(--text-faint);
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
    font-family: var(--font-mono);
  }

  .status-completed {
    color: var(--violet-bright);
    background: var(--violet-dim);
    border: 1px solid rgba(167,139,250,0.2);
  }

  .status-failed {
    color: var(--error);
    background: var(--error-dim);
    border: 1px solid rgba(248,113,113,0.2);
  }

  .status-running {
    color: var(--teal);
    background: var(--teal-dim);
    border: 1px solid rgba(45,212,191,0.2);
  }

  .status-queued {
    color: var(--text-faint);
    background: rgba(236,232,255,0.05);
    border: 1px solid var(--border);
  }

  .status-stopped {
    color: var(--amber);
    background: var(--amber-dim);
    border: 1px solid rgba(251,191,36,0.2);
  }

  .status-paused {
    color: var(--amber);
    background: var(--amber-dim);
    border: 1px solid rgba(251,191,36,0.2);
  }

  /* Class badge */
  .class-badge {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    font-family: var(--font-mono);
  }

  .class-novice {
    color: var(--text-muted);
    background: rgba(236,232,255,0.05);
    border: 1px solid var(--border);
  }

  .class-understudy {
    color: var(--teal);
    background: var(--teal-dim);
    border: 1px solid rgba(45,212,191,0.2);
  }

  .class-artisan {
    color: var(--amber);
    background: var(--amber-dim);
    border: 1px solid rgba(251,191,36,0.2);
  }

  .class-retired {
    color: var(--rose);
    background: var(--rose-dim);
    border: 1px solid rgba(244,114,182,0.15);
  }
</style>
