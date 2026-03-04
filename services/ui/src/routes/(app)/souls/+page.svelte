<script lang="ts">
  import { browser } from '$app/environment';
  import { getSoulLibrary, getSoulCategories } from '$lib/api';
  import type { SoulLibraryEntry, SoulLibraryResponse } from '$lib/types';

  let data = $state<SoulLibraryResponse | null>(null);
  let categories = $state<string[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let activeCategory = $state('');
  let activeClass = $state('');
  let currentOffset = $state(0);
  let loadingMore = $state(false);

  const LIMIT = 50;
  const AGENT_CLASSES = ['Novice', 'Understudy', 'Artisan', 'Retired'] as const;

  function loadSouls(reset: boolean) {
    const offset = reset ? 0 : currentOffset;
    if (reset) {
      currentOffset = 0;
      loading = true;
      error = null;
    } else {
      loadingMore = true;
    }

    const params: { category?: string; agentClass?: string; limit: number; offset: number } = {
      limit: LIMIT,
      offset,
    };
    if (activeCategory) params.category = activeCategory;
    if (activeClass) params.agentClass = activeClass;

    getSoulLibrary(params)
      .then((res) => {
        if (reset) {
          data = res;
        } else {
          // Append results for load-more
          data = data
            ? { ...res, souls: [...data.souls, ...res.souls] }
            : res;
        }
        currentOffset = offset + res.souls.length;
        loading = false;
        loadingMore = false;
      })
      .catch((err) => {
        error = (err as Error).message;
        loading = false;
        loadingMore = false;
      });
  }

  // On mount: load categories, then load souls
  $effect(() => {
    if (!browser) return;
    getSoulCategories()
      .then((res) => { categories = res.categories; })
      .catch(() => { /* categories stay empty, filters still work */ });
    loadSouls(true);
  });

  function selectCategory(cat: string) {
    activeCategory = cat;
    loadSouls(true);
  }

  function selectClass(cls: string) {
    activeClass = cls;
    loadSouls(true);
  }

  function loadMore() {
    loadSouls(false);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function agentClassColor(cls: string | null): string {
    switch (cls) {
      case 'Artisan':    return 'var(--teal)';
      case 'Understudy': return 'var(--amber)';
      case 'Novice':     return 'var(--violet-light)';
      case 'Retired':    return 'var(--rose)';
      default:           return 'var(--text-faint)';
    }
  }

  function soulLabel(soul: SoulLibraryEntry): string {
    if (soul.isArchetype && soul.archetypeName) {
      return `Archetype: ${soul.archetypeName}`;
    }
    return soul.taskCategory ?? 'Uncategorized';
  }
</script>

<svelte:head>
  <title>Soul Library | Akasa</title>
</svelte:head>

<div class="sl-page">
  <div class="sl-header">
    <div class="sec-label">Soul Library</div>
    <h1>Behavioral constitutions.</h1>
    <p class="sl-subtitle">Browse every soul in the DNA library — archetypes and evolved constitutions across task categories.</p>
  </div>

  <!-- Filter chips: categories -->
  <div class="sl-filters">
    <div class="sl-filter-row">
      <span class="sl-filter-label">Category</span>
      <div class="sl-chips">
        <button
          class="sl-chip {activeCategory === '' ? 'sl-chip-active' : ''}"
          onclick={() => selectCategory('')}
        >All</button>
        {#each categories as cat}
          <button
            class="sl-chip {activeCategory === cat ? 'sl-chip-active' : ''}"
            onclick={() => selectCategory(cat)}
          >{cat}</button>
        {/each}
      </div>
    </div>

    <div class="sl-filter-row">
      <span class="sl-filter-label">Class</span>
      <div class="sl-chips">
        <button
          class="sl-chip {activeClass === '' ? 'sl-chip-active' : ''}"
          onclick={() => selectClass('')}
        >All</button>
        {#each AGENT_CLASSES as cls}
          <button
            class="sl-chip {activeClass === cls ? 'sl-chip-active' : ''}"
            style="--chip-active-color: {agentClassColor(cls)}"
            onclick={() => selectClass(cls)}
          >{cls}</button>
        {/each}
      </div>
    </div>
  </div>

  {#if loading}
    <div class="sl-loading">Loading soul library...</div>
  {:else if error}
    <div class="sl-error">
      <span class="sl-error-title">Unable to load souls</span>
      <span class="sl-error-detail">{error}</span>
    </div>
  {:else if !data || data.souls.length === 0}
    <div class="sl-empty">
      <p>No souls found{activeCategory || activeClass ? ' matching the selected filters' : ''}.</p>
      {#if activeCategory || activeClass}
        <button class="sl-clear-btn" onclick={() => { activeCategory = ''; activeClass = ''; loadSouls(true); }}>
          Clear filters
        </button>
      {/if}
    </div>
  {:else}
    <div class="sl-meta">
      Showing {data.souls.length} of {data.total} soul{data.total !== 1 ? 's' : ''}
    </div>

    <div class="sl-grid">
      {#each data.souls as soul (soul.id)}
        <div class="sl-card">
          <div class="sl-card-top">
            <span class="sl-category">{soulLabel(soul)}</span>
            <span class="sl-gen-badge">Gen {soul.generation}</span>
          </div>

          <div class="sl-card-badges">
            {#if soul.agentClass}
              <span class="sl-class-badge" style="color: {agentClassColor(soul.agentClass)}; border-color: {agentClassColor(soul.agentClass)}40">
                {soul.agentClass}
              </span>
            {:else}
              <span class="sl-class-badge sl-class-null">No class</span>
            {/if}

            {#if soul.isArchetype}
              <span class="sl-archetype-badge">Archetype</span>
            {/if}
          </div>

          <div class="sl-card-score">
            <span class="sl-score-label">Score</span>
            <span class="sl-score-value">
              {soul.compositeScore != null ? soul.compositeScore.toFixed(2) : '—'}
            </span>
          </div>

          <div class="sl-card-footer">
            <span class="sl-date">{formatDate(soul.createdAt)}</span>
          </div>
        </div>
      {/each}
    </div>

    {#if data.hasMore}
      <div class="sl-load-more">
        <button class="sl-load-btn" onclick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .sl-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 100px 24px 60px;
  }

  .sl-header {
    margin-bottom: 40px;
  }

  .sl-header h1 {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text);
    margin: 8px 0 12px;
    line-height: 1.1;
  }

  .sl-subtitle {
    font-size: 15px;
    color: var(--text-muted);
    font-weight: 300;
    max-width: 560px;
    line-height: 1.6;
  }

  /* ── Filters ── */
  .sl-filters {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 32px;
  }

  .sl-filter-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .sl-filter-label {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-faint);
    min-width: 60px;
    flex-shrink: 0;
  }

  .sl-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .sl-chip {
    padding: 4px 12px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 400;
    cursor: pointer;
    transition: all 0.15s;
  }

  .sl-chip:hover {
    border-color: var(--violet-light);
    color: var(--violet-light);
  }

  .sl-chip-active {
    background: var(--chip-active-color, var(--violet));
    border-color: var(--chip-active-color, var(--violet));
    color: white;
  }

  /* ── States ── */
  .sl-loading,
  .sl-empty {
    padding: 60px 0;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
  }

  .sl-error {
    padding: 24px;
    background: rgba(244, 63, 94, 0.08);
    border: 1px solid rgba(244, 63, 94, 0.2);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sl-error-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--rose);
  }

  .sl-error-detail {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  .sl-clear-btn {
    margin-top: 12px;
    padding: 6px 16px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .sl-clear-btn:hover {
    border-color: var(--violet-light);
    color: var(--violet-light);
  }

  .sl-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-faint);
    letter-spacing: 0.05em;
    margin-bottom: 20px;
  }

  /* ── Grid ── */
  .sl-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  @media (max-width: 960px) {
    .sl-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 600px) {
    .sl-grid {
      grid-template-columns: 1fr;
    }
  }

  /* ── Soul card ── */
  .sl-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: border-color 0.15s;
  }

  .sl-card:hover {
    border-color: rgba(167, 139, 250, 0.3);
  }

  .sl-card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }

  .sl-category {
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
    line-height: 1.4;
    flex: 1;
    min-width: 0;
    word-break: break-word;
  }

  .sl-gen-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-faint);
    letter-spacing: 0.05em;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .sl-card-badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .sl-class-badge {
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid var(--border);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .sl-class-null {
    color: var(--text-faint);
  }

  .sl-archetype-badge {
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid rgba(167, 139, 250, 0.3);
    background: rgba(124, 58, 237, 0.1);
    font-size: 11px;
    color: var(--violet-light);
    letter-spacing: 0.02em;
  }

  .sl-card-score {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sl-score-label {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-faint);
  }

  .sl-score-value {
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--text);
    font-weight: 400;
  }

  .sl-card-footer {
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }

  .sl-date {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-faint);
    letter-spacing: 0.04em;
  }

  /* ── Load more ── */
  .sl-load-more {
    display: flex;
    justify-content: center;
    margin-top: 32px;
  }

  .sl-load-btn {
    padding: 8px 28px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .sl-load-btn:hover:not(:disabled) {
    border-color: var(--violet-light);
    color: var(--violet-light);
  }

  .sl-load-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
