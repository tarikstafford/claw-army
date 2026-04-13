<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const CLASSES = ['All', 'Novice', 'Understudy', 'Artisan', 'Retired'] as const;
  type SortKey = 'recent' | 'score';
  type ViewMode = 'list' | 'grid';

  let viewMode = $state<ViewMode>('list');
  let filterClass = $state<string>('All');
  let sortKey = $state<SortKey>('recent');

  const filteredAgents = $derived.by(() => {
    let result = [...data.agents];

    if (filterClass !== 'All') {
      result = result.filter((a) => a.currentClass === filterClass);
    }

    result.sort((a, b) => {
      if (sortKey === 'score') {
        const scoreA = a.compositeScore ? parseFloat(a.compositeScore) : -1;
        const scoreB = b.compositeScore ? parseFloat(b.compositeScore) : -1;
        return scoreB - scoreA;
      }
      const dateA = a.lastVerdictAt ? new Date(a.lastVerdictAt).getTime() : 0;
      const dateB = b.lastVerdictAt ? new Date(b.lastVerdictAt).getTime() : 0;
      return dateB - dateA;
    });

    return result;
  });

  const classCounts = $derived.by(() => {
    const counts: Record<string, number> = { All: data.agents.length };
    for (const agent of data.agents) {
      counts[agent.currentClass] = (counts[agent.currentClass] ?? 0) + 1;
    }
    return counts;
  });

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
</script>

<div class="agents-page">
  <div class="page-header">
    <div class="header-left">
      <h1 class="page-title">Agent Fleet</h1>
      <span class="agent-count">{data.agents.length} agent{data.agents.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="view-toggle">
      <button
        class="toggle-btn"
        class:active={viewMode === 'list'}
        onclick={() => (viewMode = 'list')}
        aria-label="List view"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2" width="12" height="2" rx="1" fill="currentColor"/>
          <rect x="1" y="6" width="12" height="2" rx="1" fill="currentColor"/>
          <rect x="1" y="10" width="12" height="2" rx="1" fill="currentColor"/>
        </svg>
      </button>
      <button
        class="toggle-btn"
        class:active={viewMode === 'grid'}
        onclick={() => (viewMode = 'grid')}
        aria-label="Grid view"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor"/>
          <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor"/>
          <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor"/>
          <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor"/>
        </svg>
      </button>
    </div>
  </div>

  <div class="controls-bar">
    <div class="filter-chips">
      {#each CLASSES as cls}
        {#if classCounts[cls] !== undefined}
          <button
            class="filter-chip"
            class:active={filterClass === cls}
            onclick={() => (filterClass = cls)}
          >
            {cls.toUpperCase()}
            <span class="chip-count">{classCounts[cls]}</span>
          </button>
        {/if}
      {/each}
    </div>
    <div class="sort-controls">
      <span class="sort-label">SORT</span>
      <button
        class="sort-btn"
        class:active={sortKey === 'recent'}
        onclick={() => (sortKey = 'recent')}
      >
        RECENT
      </button>
      <button
        class="sort-btn"
        class:active={sortKey === 'score'}
        onclick={() => (sortKey = 'score')}
      >
        SCORE
      </button>
    </div>
  </div>

  {#if data.agents.length === 0}
    <div class="empty-state">
      <p class="empty-title">No agents yet</p>
      <p class="empty-body">Run an execution to start building your fleet.</p>
    </div>
  {:else if filteredAgents.length === 0}
    <div class="empty-state">
      <p class="empty-title">No agents in this class</p>
      <p class="empty-body">Try a different filter.</p>
    </div>
  {:else if viewMode === 'list'}
    <div class="agent-list">
      {#each filteredAgents as agent (agent.botId)}
        <a href="/evolution/{agent.botId}" class="agent-row">
          <span class="agent-id">{agent.botId.slice(0, 8)}</span>
          <span class="agent-class badge-{agent.currentClass.toLowerCase()}">{agent.currentClass}</span>
          <span class="agent-category">{agent.taskCategory ?? '—'}</span>
          {#if agent.compositeScore}
            <span class="agent-score">{parseFloat(agent.compositeScore).toFixed(2)}</span>
          {:else}
            <span class="agent-score muted">—</span>
          {/if}
          <span class="agent-date">{formatDate(agent.lastVerdictAt)}</span>
          {#if agent.isPioneer}
            <span class="pioneer-badge">PIONEER</span>
          {/if}
        </a>
      {/each}
    </div>
  {:else}
    <div class="agent-grid">
      {#each filteredAgents as agent (agent.botId)}
        <a href="/evolution/{agent.botId}" class="agent-card">
          <div class="card-header">
            <span class="agent-id">{agent.botId.slice(0, 8)}</span>
            {#if agent.isPioneer}
              <span class="pioneer-badge">PIONEER</span>
            {/if}
          </div>
          <div class="card-body">
            <span class="agent-class badge-{agent.currentClass.toLowerCase()}">{agent.currentClass}</span>
            <span class="agent-category">{agent.taskCategory ?? '—'}</span>
          </div>
          <div class="card-footer">
            {#if agent.compositeScore}
              <span class="agent-score">{parseFloat(agent.compositeScore).toFixed(2)}</span>
            {:else}
              <span class="agent-score muted">—</span>
            {/if}
            <span class="agent-date">{formatDate(agent.lastVerdictAt)}</span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .agents-page {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-left {
    display: flex;
    align-items: baseline;
    gap: var(--space-md);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0;
  }

  .agent-count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--bo-faint);
  }

  .view-toggle {
    display: flex;
    gap: 2px;
    background: var(--bo-bg);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: 2px;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--bo-faint);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-btn:hover {
    color: var(--bo-text);
  }

  .toggle-btn.active {
    background: var(--bo-card);
    color: var(--bo-text);
  }

  .controls-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-md);
  }

  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .filter-chip {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    background: transparent;
    border: 1px solid var(--bo-border);
    padding: 4px 10px;
    border-radius: 3px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: all 0.15s ease;
  }

  .filter-chip:hover {
    color: var(--bo-text);
    border-color: var(--bo-bhi);
  }

  .filter-chip.active {
    color: var(--bo-text);
    background: rgba(124, 58, 237, 0.15);
    border-color: var(--bo-violet);
  }

  .chip-count {
    font-family: var(--font-mono);
    font-size: 8px;
    opacity: 0.6;
  }

  .sort-controls {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .sort-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
  }

  .sort-btn {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 3px;
    transition: all 0.15s ease;
  }

  .sort-btn:hover {
    color: var(--bo-text);
  }

  .sort-btn.active {
    color: var(--bo-violet);
    background: rgba(124, 58, 237, 0.12);
  }

  .empty-state {
    padding: var(--space-2xl);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .empty-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-sm);
  }

  .empty-body {
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
  }

  /* List view */
  .agent-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .agent-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    text-decoration: none;
    transition: background 0.15s ease;
  }

  .agent-row:hover {
    background: rgba(236, 232, 255, 0.04);
  }

  .agent-id {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--bo-faint);
    flex-shrink: 0;
    min-width: 80px;
  }

  .agent-class {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    padding: 2px 6px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .badge-novice     { color: var(--bo-faint); background: rgba(124, 58, 237, 0.08); }
  .badge-understudy { color: var(--bo-violet); background: rgba(124, 58, 237, 0.15); }
  .badge-artisan    { color: var(--bo-amber); background: rgba(245, 158, 11, 0.15); }
  .badge-retired    { color: var(--bo-faint); background: rgba(255, 255, 255, 0.05); }

  .agent-category {
    font-size: 12px;
    color: var(--bo-faint);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .agent-score {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--bo-text);
    flex-shrink: 0;
  }

  .agent-score.muted {
    color: var(--bo-faint);
  }

  .agent-date {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--bo-faint);
    flex-shrink: 0;
    min-width: 70px;
    text-align: right;
  }

  .pioneer-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-amber);
    border: 1px solid var(--bo-amber);
    padding: 1px 4px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  /* Grid view */
  .agent-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-md);
  }

  .agent-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-md);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .agent-card:hover {
    border-color: var(--bo-bhi);
    transform: translateY(-2px);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
    padding-top: var(--space-sm);
    border-top: 1px solid var(--bo-border);
  }
</style>
