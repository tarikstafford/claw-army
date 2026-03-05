<script lang="ts">
  import { browser } from '$app/environment';
  import { getObjectives, getArchivedObjectives } from '$lib/api';
  import type { ObjectiveListItem } from '$lib/types';

  let objectives = $state<ObjectiveListItem[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let showArchived = $state(false);
  let archivedObjectives = $state<ObjectiveListItem[]>([]);
  let loadingArchived = $state(false);
  let openMenuId = $state<string | null>(null);

  // Archive dialog state
  let archivingObjectiveId = $state<string | null>(null);
  let archivingObjectiveName = $state('');
  let archiving = $state(false);

  $effect(() => {
    if (!browser) return;
    getObjectives()
      .then(data => { objectives = data; loading = false; })
      .catch(err => { error = (err as Error).message; loading = false; });
  });

  // Close kebab menu on outside click
  $effect(() => {
    if (!browser || !openMenuId) return;
    const handleClick = () => { openMenuId = null; };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  });

  function toggleArchived() {
    showArchived = !showArchived;
    if (showArchived && archivedObjectives.length === 0) {
      loadingArchived = true;
      getArchivedObjectives()
        .then(data => { archivedObjectives = data; loadingArchived = false; })
        .catch(() => { loadingArchived = false; });
    }
  }

  async function archiveFromList(id: string) {
    archiving = true;
    const formData = new FormData();
    try {
      const res = await fetch(`/objectives/${id}?/archive`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        objectives = objectives.filter(o => o.id !== id);
        archivingObjectiveId = null;
        // Refresh archived list if visible
        if (showArchived) {
          getArchivedObjectives().then(data => { archivedObjectives = data; }).catch(() => {});
        }
      }
    } finally {
      archiving = false;
    }
  }

  async function unarchiveFromList(id: string) {
    const formData = new FormData();
    const res = await fetch(`/objectives/${id}?/unarchive`, {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      archivedObjectives = archivedObjectives.filter(a => a.id !== id);
      getObjectives().then(data => { objectives = data; }).catch(() => {});
    }
  }
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
    <a href="/objectives/new" class="btn-deploy">New Objective</a>
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
      <p class="empty">No objectives yet. Create one above to get started.</p>
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
              <th></th>
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
                <td class="col-actions">
                  <div class="row-actions">
                    <button
                      class="kebab-btn"
                      onclick={(e) => { e.stopPropagation(); openMenuId = openMenuId === obj.id ? null : obj.id; }}
                      aria-label="Row actions"
                    >
                      &middot;&middot;&middot;
                    </button>
                    {#if openMenuId === obj.id}
                      <div class="kebab-dropdown">
                        <a href="/objectives/{obj.id}" class="kebab-item">View</a>
                        <a href="/objectives/{obj.id}" class="kebab-item" onclick={() => openMenuId = null}>Edit</a>
                        <button class="kebab-item kebab-danger" onclick={() => {
                          openMenuId = null;
                          archivingObjectiveId = obj.id;
                          archivingObjectiveName = obj.name;
                        }}>Archive</button>
                      </div>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <div class="filter-row">
      <button
        class="toggle-archived"
        class:active={showArchived}
        onclick={toggleArchived}
      >
        {showArchived ? 'Hide archived' : 'Show archived'}
      </button>
    </div>

    {#if showArchived}
      <section class="archived-section">
        <h2>Archived Objectives</h2>
        {#if loadingArchived}
          <div class="loading">Loading archived...</div>
        {:else if archivedObjectives.length === 0}
          <p class="empty">No archived objectives.</p>
        {:else}
          <div class="table-wrapper">
            <table class="archived-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Last Run</th>
                  <th>Runs</th>
                  <th class="col-cost">Total Spend</th>
                  <th>Best Class</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each archivedObjectives as obj}
                  <tr class="archived-row">
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
                    <td class="col-actions">
                      <button class="btn-unarchive" onclick={() => unarchiveFromList(obj.id)}>Unarchive</button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    {/if}
  {/if}
</div>

<!-- Archive confirmation dialog -->
{#if archivingObjectiveId}
  <div class="dialog-backdrop" onclick={() => archivingObjectiveId = null} role="presentation">
    <div class="dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <h3>Archive {archivingObjectiveName}?</h3>
      <p>It will be hidden from your list. Run history is preserved.</p>
      <div class="dialog-actions">
        <button onclick={() => archivingObjectiveId = null} class="btn-cancel">Cancel</button>
        <button
          onclick={() => archiveFromList(archivingObjectiveId!)}
          class="btn-archive-confirm"
          disabled={archiving}
        >
          {archiving ? 'Archiving...' : 'Archive'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page {
    max-width: 1000px;
    margin: 0 auto;
    padding: 40px 36px 80px;
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
    .page { padding: 32px 20px 60px; }
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

  /* Kebab menu */
  .col-actions {
    width: 48px;
    position: relative;
  }

  .row-actions {
    position: relative;
  }

  .kebab-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    font-size: 1.1rem;
    letter-spacing: 0.15em;
    border-radius: 4px;
    transition: background 0.1s;
  }

  .kebab-btn:hover {
    background: var(--bg-3);
    color: var(--text);
  }

  .kebab-dropdown {
    position: absolute;
    right: 0;
    top: 100%;
    z-index: 10;
    background: var(--bg-card);
    border: 1px solid var(--border-mid);
    border-radius: 8px;
    min-width: 120px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }

  .kebab-item {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
    color: var(--text);
    text-decoration: none;
    text-align: left;
    border: none;
    background: none;
    cursor: pointer;
  }

  .kebab-item:hover {
    background: var(--violet-dim);
  }

  .kebab-danger {
    color: var(--error);
  }

  .kebab-danger:hover {
    background: var(--error-dim);
  }

  /* Archived toggle filter row */
  .filter-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 1rem;
    margin-bottom: 1rem;
  }

  .toggle-archived {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .toggle-archived:hover {
    border-color: var(--violet);
    color: var(--text);
  }

  .toggle-archived.active {
    border-color: var(--violet);
    color: var(--violet-bright);
  }

  /* Archived section */
  .archived-section {
    margin-top: 0.5rem;
  }

  .archived-section h2 {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-muted);
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
  }

  .archived-row {
    opacity: 0.5;
  }

  .btn-unarchive {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .btn-unarchive:hover {
    border-color: var(--violet);
    color: var(--text);
  }

  /* Archive confirmation dialog */
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .dialog {
    background: var(--bg-card);
    border: 1px solid var(--border-mid);
    border-radius: 14px;
    padding: 1.5rem 2rem;
    max-width: 400px;
    width: 90%;
  }

  .dialog h3 {
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text);
  }

  .dialog p {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin: 0 0 1.25rem;
  }

  .dialog-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border-mid);
    color: var(--text-muted);
    padding: 0.5rem 1rem;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-cancel:hover {
    background: var(--bg-3);
  }

  .btn-archive-confirm {
    padding: 0.5rem 1.25rem;
    background: var(--error);
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-archive-confirm:hover:not(:disabled) {
    opacity: 0.85;
  }

  .btn-archive-confirm:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Sec label */
  .sec-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--violet-bright);
    font-family: var(--font-mono);
    margin-bottom: 0.5rem;
  }
</style>
