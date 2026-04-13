<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const statusOptions = [
    { value: '', label: 'All' },
    { value: 'running', label: 'Running' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'paused', label: 'Paused' },
    { value: 'stopped', label: 'Cancelled' },
  ];

  const sortOptions = [
    { value: 'date', label: 'Date' },
    { value: 'duration', label: 'Duration' },
  ];

  function getStatusColor(status: string): string {
    switch (status) {
      case 'running': return 'var(--bo-teal, #2DD4BF)';
      case 'completed': return 'var(--success, #059669)';
      case 'failed': return 'var(--error, #f87171)';
      case 'paused': return 'var(--bo-amber, #FBBF24)';
      case 'stopped': return 'var(--text-muted)';
      case 'pre_flight': return 'var(--bo-violet, #7C3AED)';
      case 'queued': return 'var(--bo-vb, #A78BFA)';
      default: return 'var(--text-muted)';
    }
  }

  function formatDate(iso: string | Date): string {
    const date = typeof iso === 'string' ? new Date(iso) : iso;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDuration(start: string | Date, end: string | Date | null): string {
    const startDate = typeof start === 'string' ? new Date(start) : start;
    const endDate = end ? (typeof end === 'string' ? new Date(end) : end) : new Date();
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ${diffSec % 60}s`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr}h ${diffMin % 60}m`;
  }

  function buildUrl(status: string, sort: string, order: string): string {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (sort) params.set('sort', sort);
    if (order) params.set('order', order);
    return `/office/executions?${params}`;
  }
</script>

<div class="executions-page">
  <div class="page-header">
    <h1 class="page-title">Runs</h1>
  </div>

  <div class="filters">
    <div class="filter-group">
      <label for="status-filter" class="filter-label">STATUS</label>
      <select
        id="status-filter"
        class="filter-select"
        value={data.filters.status ?? ''}
        onchange={(e) => {
          const value = (e.target as HTMLSelectElement).value;
          window.location.href = buildUrl(value, data.filters.sort ?? 'date', data.filters.order ?? 'desc');
        }}
      >
        {#each statusOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <label for="sort-filter" class="filter-label">SORT BY</label>
      <select
        id="sort-filter"
        class="filter-select"
        value={data.filters.sort ?? 'date'}
        onchange={(e) => {
          const value = (e.target as HTMLSelectElement).value;
          window.location.href = buildUrl(data.filters.status ?? '', value, data.filters.order ?? 'desc');
        }}
      >
        {#each sortOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <label for="order-filter" class="filter-label">ORDER</label>
      <select
        id="order-filter"
        class="filter-select"
        value={data.filters.order ?? 'desc'}
        onchange={(e) => {
          const value = (e.target as HTMLSelectElement).value;
          window.location.href = buildUrl(data.filters.status ?? '', data.filters.sort ?? 'date', value);
        }}
      >
        <option value="desc">Descending</option>
        <option value="asc">Ascending</option>
      </select>
    </div>
  </div>

  {#if data.executions.length === 0}
    <div class="empty-state">
      <span class="empty-eyebrow">NO EXECUTIONS</span>
      <p class="empty-heading">Nothing here yet.</p>
      <p class="empty-body">Start an execution to see your runs here.</p>
    </div>
  {:else}
    <div class="executions-list">
      {#each data.executions as execution}
        <a href="/office/executions/{execution.id}" class="execution-card">
          <div class="execution-card-top">
            <span class="execution-status" style="color: {getStatusColor(execution.status)}">
              {execution.status.replace('_', ' ').toUpperCase()}
            </span>
            <span class="execution-date">{formatDate(execution.createdAt)}</span>
          </div>
          <h3 class="execution-objective">{execution.objective}</h3>
          <div class="execution-meta">
            <span class="meta-item">
              <span class="meta-label">Bots</span>
              <span class="meta-value">{execution.activeBotCount ?? 0}/{execution.maxBots}</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">Duration</span>
              <span class="meta-value">{formatDuration(execution.createdAt, execution.updatedAt)}</span>
            </span>
            {#if execution.budgetCapCents}
              <span class="meta-item">
                <span class="meta-label">Budget</span>
                <span class="meta-value">${(execution.budgetCapCents / 100).toFixed(2)}</span>
              </span>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .executions-page {
    max-width: 900px;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-xl);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(26px, 3.5vw, 38px);
    font-weight: 600;
    line-height: 1.1;
    color: var(--fo-plum);
    margin: 0;
  }

  .filters {
    display: flex;
    gap: var(--space-lg);
    margin-bottom: var(--space-xl);
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .filter-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
  }

  .filter-select {
    font-family: var(--font-body);
    font-size: 13px;
    padding: var(--space-sm) var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    color: var(--text);
    cursor: pointer;
    min-width: 140px;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--fo-plum);
  }

  .executions-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .execution-card {
    display: block;
    padding: var(--space-lg);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, transform 0.15s;
  }

  .execution-card:hover {
    border-color: var(--fo-plum-m);
    transform: translateY(-1px);
  }

  .execution-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-sm);
  }

  .execution-status {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
  }

  .execution-date {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
  }

  .execution-objective {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--fo-plum);
    margin: 0 0 var(--space-md);
  }

  .execution-meta {
    display: flex;
    gap: var(--space-xl);
    flex-wrap: wrap;
  }

  .meta-item {
    display: flex;
    gap: var(--space-sm);
    align-items: center;
  }

  .meta-label {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
  }

  .meta-value {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
    padding: var(--space-3xl) 0;
  }

  .empty-eyebrow {
    font-family: var(--font-label);
    font-size: 6px;
    color: var(--text-muted);
    letter-spacing: 0.10em;
  }

  .empty-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .empty-body {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }
</style>