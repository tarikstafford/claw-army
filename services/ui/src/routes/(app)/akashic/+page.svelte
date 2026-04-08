<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let selectedEntry = $state<Record<string, unknown> | null>(null);
  let acquiringId = $state<string | null>(null);
  let filterTaskCategory = $state(data.filters.taskCategory ?? '');
  let filterMinScore = $state(data.filters.minScore ?? '');
  let filterSortBy = $state(data.filters.sortBy ?? 'score');

  function buildUrl(page: number): string {
    const params = new URLSearchParams();
    if (filterTaskCategory) params.set('taskCategory', filterTaskCategory);
    if (filterMinScore) params.set('minScore', filterMinScore);
    if (filterSortBy) params.set('sortBy', filterSortBy);
    params.set('page', String(page));
    return `/akashic?${params.toString()}`;
  }

  async function handleAcquire(entryId: string) {
    acquiringId = entryId;
    try {
      const res = await fetch(`/api/akasa/akashic/${entryId}/acquire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: '', companyId: '' }),
      });
      if (res.ok) {
        window.location.href = '/office/agents';
      }
    } catch {
      acquiringId = null;
    }
  }
</script>

<div class="akashic-page">
  <header class="page-header">
    <h1 class="page-title">Akashic Library</h1>
    <p class="page-subtitle">Acquire pre-evolved agent souls from the marketplace</p>
  </header>

  <div class="akashic-layout">
    <aside class="filter-sidebar">
      <div class="filter-section">
        <label class="filter-label" for="taskCategory">Task Category</label>
        <select id="taskCategory" class="filter-select" bind:value={filterTaskCategory}>
          <option value="">All categories</option>
          <option value="coding">Coding</option>
          <option value="research">Research</option>
          <option value="write">Writing</option>
          <option value="analysis">Analysis</option>
        </select>
      </div>

      <div class="filter-section">
        <label class="filter-label" for="minScore">Min Score</label>
        <input
          id="minScore"
          type="number"
          class="filter-input"
          placeholder="0.00"
          min="0"
          max="100"
          step="0.01"
          bind:value={filterMinScore}
        />
      </div>

      <div class="filter-section">
        <label class="filter-label" for="sortBy">Sort By</label>
        <select id="sortBy" class="filter-select" bind:value={filterSortBy}>
          <option value="score">Score</option>
          <option value="generation">Generation</option>
          <option value="acquiredCount">Most Acquired</option>
        </select>
      </div>

      <a href={buildUrl(1)} class="filter-apply-btn">Apply Filters</a>
    </aside>

    <main class="soul-grid-wrap">
      {#if data.browse.entries.length === 0}
        <div class="empty-state">
          <p class="empty-heading">No souls found</p>
          <p class="empty-body">Try adjusting your filters or check back later.</p>
        </div>
      {:else}
        <div class="soul-grid">
          {#each data.browse.entries as entry (entry.id)}
            <button
              class="soul-card"
              onclick={() => selectedEntry = selectedEntry?.id === entry.id ? null : entry}
              aria-expanded={selectedEntry?.id === entry.id}
            >
              <div class="soul-card-header">
                <h3 class="soul-title">{entry.title ?? 'Untitled Soul'}</h3>
                <span class="soul-score">{Number(entry.compositeScore).toFixed(2)}</span>
              </div>

              <p class="soul-desc">{entry.description ?? ''}</p>

              <div class="soul-meta">
                <span class="meta-chip">Gen {entry.generation}</span>
                <span class="meta-chip">Depth {entry.mutationLineageDepth}</span>
                <span class="meta-chip acquired">{entry.acquiredCount} acquired</span>
              </div>

              {#if entry.taskCategory}
                <span class="soul-category">{entry.taskCategory}</span>
              {/if}
            </button>
          {/each}
        </div>

        <nav class="pagination" aria-label="Browse pagination">
          {#if data.browse.page > 1}
            <a href={buildUrl(data.browse.page - 1)} class="page-btn prev">Previous</a>
          {/if}
          <span class="page-indicator">
            Page {data.browse.page} of {data.browse.totalPages}
          </span>
          {#if data.browse.page < data.browse.totalPages}
            <a href={buildUrl(data.browse.page + 1)} class="page-btn next">Next</a>
          {/if}
        </nav>
      {/if}
    </main>
  </div>
</div>

<style>
  .akashic-page {
    max-width: 1200px;
    padding: var(--space-2xl) var(--space-xl) var(--space-xl);
  }

  .page-header {
    margin-bottom: var(--space-xl);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-xs);
    line-height: 1.1;
  }

  .page-subtitle {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--bo-muted);
    margin: 0;
  }

  .akashic-layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: var(--space-xl);
    align-items: start;
  }

  /* ── Filter sidebar ──────────────────────────── */
  .filter-sidebar {
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .filter-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .filter-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    color: var(--bo-caption);
  }

  .filter-select,
  .filter-input {
    background: var(--bo-bg);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-sm);
    color: var(--bo-text);
    font-family: var(--font-body);
    font-size: 13px;
    padding: var(--space-sm) var(--space-md);
    width: 100%;
    outline: none;
    transition: border-color 0.15s;
  }

  .filter-select:focus,
  .filter-input:focus {
    border-color: var(--bo-vb);
  }

  .filter-apply-btn {
    display: block;
    text-align: center;
    background: var(--bo-violet);
    color: white;
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-sm);
    text-decoration: none;
    transition: background 0.15s;
  }

  .filter-apply-btn:hover {
    background: var(--bo-vb);
  }

  /* ── Soul grid ───────────────────────────────── */
  .soul-grid-wrap {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .soul-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-md);
  }

  .soul-card {
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: border-color 0.15s, box-shadow 0.15s;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .soul-card:hover {
    border-color: var(--bo-vb);
    box-shadow: 0 0 0 1px var(--bo-vb);
  }

  .soul-card[aria-expanded="true"] {
    border-color: var(--bo-violet);
  }

  .soul-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .soul-title {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0;
    line-height: 1.3;
  }

  .soul-score {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--bo-amber);
    flex-shrink: 0;
  }

  .soul-desc {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-muted);
    margin: 0;
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .soul-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    margin-top: var(--space-xs);
  }

  .meta-chip {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.08em;
    color: var(--bo-caption);
    background: var(--bo-ghost);
    padding: 3px 6px;
    border-radius: 3px;
  }

  .meta-chip.acquired {
    color: var(--bo-teal);
  }

  .soul-category {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.08em;
    color: var(--bo-violet);
    align-self: flex-start;
  }

  /* ── Empty state ─────────────────────────────── */
  .empty-state {
    padding: var(--space-3xl);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .empty-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-sm);
  }

  .empty-body {
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
  }

  /* ── Pagination ──────────────────────────────── */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
  }

  .page-btn {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
    color: var(--bo-vb);
    text-decoration: none;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-sm);
    transition: border-color 0.15s;
  }

  .page-btn:hover {
    border-color: var(--bo-vb);
  }

  .page-indicator {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-muted);
  }
</style>
