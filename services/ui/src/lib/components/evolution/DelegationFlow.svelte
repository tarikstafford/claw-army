<script lang="ts">
  import type { DelegationChain, DelegationStats } from '$lib/api';
  import { getDelegations } from '$lib/api';

  let {
    chains: initialChains = [],
    stats: initialStats = { totalDelegations: 0, successRate: 0, avgDepth: 0, executionCount: 0 },
  }: {
    chains?: DelegationChain[];
    stats?: DelegationStats;
  } = $props();

  let chains = $state(initialChains);
  let stats = $state(initialStats);
  let loading = $state(false);
  let filterExecution = $state('');
  let filterFrom = $state('');
  let filterTo = $state('');
  let expandedExecution = $state<string | null>(null);

  const STATUS_COLORS: Record<string, string> = {
    completed: 'var(--accent-teal)',
    claimed: 'var(--accent-m)',
    pending: 'var(--text-muted)',
    failed: 'var(--error, #F87171)',
  };

  async function applyFilters() {
    loading = true;
    try {
      const params: Record<string, string> = {};
      if (filterExecution) params['executionId'] = filterExecution;
      if (filterFrom) params['from'] = new Date(filterFrom).toISOString();
      if (filterTo) params['to'] = new Date(filterTo).toISOString();
      const result = await getDelegations(params);
      chains = result.chains;
      stats = result.stats;
    } catch {
      // Keep existing data on error
    } finally {
      loading = false;
    }
  }

  async function clearFilters() {
    filterExecution = '';
    filterFrom = '';
    filterTo = '';
    loading = true;
    try {
      const result = await getDelegations();
      chains = result.chains;
      stats = result.stats;
    } catch {
      // Keep existing data
    } finally {
      loading = false;
    }
  }

  function toggleExecution(executionId: string) {
    expandedExecution = expandedExecution === executionId ? null : executionId;
  }

  function truncate(str: string, max: number): string {
    return str.length > max ? str.slice(0, max) + '...' : str;
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="delegation-flow">
  <!-- Stats Bar -->
  <div class="stats-bar">
    <div class="stat-card">
      <span class="stat-value">{stats.totalDelegations}</span>
      <span class="stat-label">DELEGATIONS</span>
    </div>
    <div class="stat-card">
      <span class="stat-value" class:success={stats.successRate >= 70} class:warning={stats.successRate < 70 && stats.successRate >= 40} class:danger={stats.successRate < 40}>
        {stats.successRate}%
      </span>
      <span class="stat-label">SUCCESS RATE</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{stats.avgDepth}</span>
      <span class="stat-label">AVG DEPTH</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{stats.executionCount}</span>
      <span class="stat-label">EXECUTIONS</span>
    </div>
  </div>

  <!-- Filters -->
  <div class="filters">
    <div class="filter-group">
      <label class="filter-label" for="exec-filter">Execution ID</label>
      <input
        id="exec-filter"
        class="filter-input"
        type="text"
        placeholder="Filter by execution..."
        bind:value={filterExecution}
      />
    </div>
    <div class="filter-group">
      <label class="filter-label" for="from-filter">From</label>
      <input
        id="from-filter"
        class="filter-input"
        type="date"
        bind:value={filterFrom}
      />
    </div>
    <div class="filter-group">
      <label class="filter-label" for="to-filter">To</label>
      <input
        id="to-filter"
        class="filter-input"
        type="date"
        bind:value={filterTo}
      />
    </div>
    <div class="filter-actions">
      <button class="btn-filter" onclick={applyFilters} disabled={loading}>
        {loading ? 'Loading...' : 'Apply'}
      </button>
      <button class="btn-clear" onclick={clearFilters} disabled={loading}>Clear</button>
    </div>
  </div>

  <!-- Delegation Chains -->
  {#if chains.length === 0}
    <div class="empty-state">
      <p class="empty-title">No delegations found</p>
      <p class="empty-body">Run an execution to see delegation chains here.</p>
    </div>
  {:else}
    <div class="chains-list">
      {#each chains as chain (chain.executionId)}
        {@const completedCount = chain.delegations.filter((d) => d.status === 'completed').length}
        {@const totalCount = chain.delegations.length}
        {@const chainRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}
        <div class="chain-card" class:expanded={expandedExecution === chain.executionId}>
          <button class="chain-header" onclick={() => toggleExecution(chain.executionId)}>
            <div class="chain-meta">
              <span class="chain-objective">{truncate(chain.objective, 80)}</span>
              <span class="chain-id">{chain.executionId.slice(0, 8)}</span>
            </div>
            <div class="chain-summary">
              <span class="chain-count">{totalCount} task{totalCount !== 1 ? 's' : ''}</span>
              <span class="chain-rate" style="color: {chainRate >= 70 ? 'var(--accent-teal)' : chainRate >= 40 ? 'var(--karma)' : 'var(--error, #F87171)'}">
                {chainRate}% done
              </span>
              <span class="chain-chevron">{expandedExecution === chain.executionId ? '\u25B2' : '\u25BC'}</span>
            </div>
          </button>

          {#if expandedExecution === chain.executionId}
            <div class="chain-body">
              <div class="delegation-list">
                {#each chain.delegations as d (d.taskId)}
                  <div class="delegation-row">
                    <div class="delegation-connector">
                      <div class="connector-dot" style="background: {STATUS_COLORS[d.status] ?? 'var(--text-muted)'}"></div>
                      <div class="connector-line"></div>
                    </div>
                    <div class="delegation-content">
                      <div class="delegation-main">
                        <span class="delegation-desc">{truncate(d.description, 120)}</span>
                        <span class="delegation-status" style="color: {STATUS_COLORS[d.status] ?? 'var(--text-muted)'}">
                          {d.status.toUpperCase()}
                        </span>
                      </div>
                      <div class="delegation-details">
                        {#if d.assignedBotId}
                          <span class="detail-tag bot-tag">Bot {d.assignedBotId.slice(0, 8)}</span>
                        {:else}
                          <span class="detail-tag unassigned-tag">Unassigned</span>
                        {/if}
                        {#if d.botTier}
                          <span class="detail-tag tier-tag">{d.botTier}</span>
                        {/if}
                        {#if d.botCompositeScore}
                          <span class="detail-tag score-tag">Score: {parseFloat(d.botCompositeScore).toFixed(1)}</span>
                        {/if}
                        <span class="detail-time">{formatDate(d.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .delegation-flow {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  /* ── Stats Bar ── */
  .stats-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-md);
  }

  .stat-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-lg) var(--space-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
  }

  .stat-value {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 700;
    color: var(--text);
  }

  .stat-value.success { color: var(--accent-teal); }
  .stat-value.warning { color: var(--karma); }
  .stat-value.danger { color: var(--error, #F87171); }

  .stat-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }

  /* ── Filters ── */
  .filters {
    display: flex;
    align-items: flex-end;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    flex: 1;
    min-width: 140px;
  }

  .filter-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .filter-input {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-sm) var(--space-md);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .filter-input::placeholder {
    color: var(--text-muted);
  }

  .filter-input:focus {
    border-color: var(--accent);
  }

  .filter-input::-webkit-calendar-picker-indicator {
    filter: invert(0.7);
  }

  .filter-actions {
    display: flex;
    gap: var(--space-sm);
  }

  .btn-filter,
  .btn-clear {
    min-height: 36px;
    padding: 0 var(--space-lg);
    font-family: var(--font-body);
    font-size: 13px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .btn-filter {
    background: var(--card);
    border: 1px solid var(--accent);
    color: var(--accent);
  }

  .btn-filter:hover:not(:disabled) {
    background: rgba(124, 58, 237, 0.12);
  }

  .btn-clear {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
  }

  .btn-clear:hover:not(:disabled) {
    color: var(--text);
    border-color: var(--accent-m);
  }

  .btn-filter:disabled,
  .btn-clear:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Empty State ── */
  .empty-state {
    text-align: center;
    padding: var(--space-2xl) 0;
  }

  .empty-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 var(--space-xs);
  }

  .empty-body {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  /* ── Chain Cards ── */
  .chains-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .chain-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    transition: border-color 0.15s ease;
  }

  .chain-card:hover {
    border-color: var(--accent-m);
  }

  .chain-card.expanded {
    border-color: var(--accent);
  }

  .chain-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    gap: var(--space-md);
  }

  .chain-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .chain-objective {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chain-id {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
  }

  .chain-summary {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-shrink: 0;
  }

  .chain-count {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
  }

  .chain-rate {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
  }

  .chain-chevron {
    font-size: 10px;
    color: var(--text-muted);
  }

  /* ── Chain Body (expanded) ── */
  .chain-body {
    border-top: 1px solid var(--border);
    padding: var(--space-md) var(--space-lg) var(--space-lg);
  }

  .delegation-list {
    display: flex;
    flex-direction: column;
  }

  .delegation-row {
    display: flex;
    gap: var(--space-md);
    min-height: 48px;
  }

  .delegation-connector {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 16px;
    flex-shrink: 0;
    padding-top: 6px;
  }

  .connector-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-xl);
    flex-shrink: 0;
  }

  .connector-line {
    width: 1px;
    flex: 1;
    background: var(--border);
    margin-top: 2px;
  }

  .delegation-row:last-child .connector-line {
    display: none;
  }

  .delegation-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding-bottom: var(--space-md);
    min-width: 0;
  }

  .delegation-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-md);
  }

  .delegation-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    line-height: 1.5;
    flex: 1;
    min-width: 0;
  }

  .delegation-status {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.05em;
    flex-shrink: 0;
    padding-top: 3px;
  }

  .delegation-details {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .detail-tag {
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 1px var(--space-sm);
    border-radius: var(--radius-sm);
    background: rgba(148, 110, 255, 0.08);
    color: var(--accent-m);
  }

  .unassigned-tag {
    background: rgba(236, 232, 255, 0.06);
    color: var(--text-muted);
  }

  .tier-tag {
    background: rgba(251, 191, 36, 0.10);
    color: var(--karma);
  }

  .score-tag {
    background: rgba(45, 212, 191, 0.10);
    color: var(--accent-teal);
  }

  .detail-time {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    margin-left: auto;
  }

  @media (max-width: 640px) {
    .stats-bar {
      grid-template-columns: repeat(2, 1fr);
    }

    .filters {
      flex-direction: column;
      align-items: stretch;
    }

    .filter-group {
      min-width: unset;
    }

    .chain-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .chain-summary {
      width: 100%;
      justify-content: flex-start;
    }
  }
</style>
