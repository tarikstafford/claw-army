<script lang="ts">
  import type { PageData } from './$types';
  import type { ExecutionStatus } from '$lib/api';
  import { EXECUTION_STATUSES } from '$lib/api';

  let { data }: { data: PageData } = $props();

  let executions = $derived(data.executions);
  let filters = $derived(data.filters);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDuration(startIso: string, endIso?: string | null): string {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    const seconds = Math.floor((end - start) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  function getStatusLabel(status: ExecutionStatus): string {
    switch (status) {
      case 'pre_flight': return 'PRE-FLIGHT';
      case 'queued': return 'QUEUED';
      case 'running': return 'RUNNING';
      case 'paused': return 'PAUSED';
      case 'stopped': return 'STOPPED';
      case 'completed': return 'COMPLETED';
      case 'failed': return 'FAILED';
      default: return status.toUpperCase();
    }
  }

  function getStatusColor(status: ExecutionStatus): string {
    switch (status) {
      case 'pre_flight': return 'var(--text-muted)';
      case 'queued': return 'var(--bo-amber)';
      case 'running': return 'var(--bo-teal)';
      case 'paused': return 'var(--fo-gold)';
      case 'stopped': return 'var(--text-muted)';
      case 'completed': return 'var(--success)';
      case 'failed': return 'var(--error)';
      default: return 'var(--text-muted)';
    }
  }

  function buildFilterUrl(key: string, value: string | null): string {
    const params = new URLSearchParams();
    if (filters.status && key !== 'status') params.set('status', filters.status);
    if (filters.sortBy && key !== 'sortBy') params.set('sortBy', filters.sortBy);
    if (filters.sortOrder && key !== 'sortOrder') params.set('sortOrder', filters.sortOrder);
    if (value && key !== 'status') params.set(key, value);
    const qs = params.toString();
    return `/office/executions${qs ? `?${qs}` : ''}`;
  }

  let currentStatus = $derived(filters.status);
  let currentSort = $derived(filters.sortBy ?? 'date');
  let currentOrder = $derived(filters.sortOrder ?? 'desc');
</script>

<div class="executions-page">
  <div class="page-header">
    <h1 class="page-title">Executions</h1>
  </div>

  <div class="filters-bar">
    <div class="filter-group">
      <span class="filter-label">STATUS</span>
      <div class="filter-pills">
        <a
          href={buildFilterUrl('status', null)}
          class="filter-pill"
          class:active={!currentStatus}
        >All</a>
        {#each EXECUTION_STATUSES as status}
          <a
            href={buildFilterUrl('status', status)}
            class="filter-pill"
            class:active={currentStatus === status}
          >{getStatusLabel(status)}</a>
        {/each}
      </div>
    </div>

    <div class="filter-group">
      <span class="filter-label">SORT</span>
      <div class="filter-pills">
        <a
          href={buildFilterUrl('sortBy', 'date')}
          class="filter-pill"
          class:active={currentSort === 'date'}
        >Date</a>
        <a
          href={buildFilterUrl('sortBy', 'duration')}
          class="filter-pill"
          class:active={currentSort === 'duration'}
        >Duration</a>
        <a
          href={buildFilterUrl('sortOrder', currentOrder === 'asc' ? 'desc' : 'asc')}
          class="filter-pill order-pill"
          class:asc={currentOrder === 'asc'}
          class:desc={currentOrder === 'desc'}
        >
          {currentOrder === 'asc' ? '↑' : '↓'}
        </a>
      </div>
    </div>
  </div>

  {#if executions.length === 0}
    <div class="empty-state" aria-busy="false">
      <span class="empty-eyebrow">NO EXECUTIONS</span>
      <p class="empty-heading">Nothing yet.</p>
      <p class="empty-body">No executions match your filters, or none have been launched yet.</p>
    </div>
  {:else}
    <div class="executions-list">
      {#each executions as execution (execution.id)}
        <a href="/office/executions/{execution.id}" class="execution-card">
          <div class="execution-header">
            <span
              class="status-badge"
              style="color: {getStatusColor(execution.status)}; border-color: {getStatusColor(execution.status)}"
            >
              {getStatusLabel(execution.status)}
            </span>
            <span class="execution-date">{formatDate(execution.createdAt)}</span>
          </div>
          <div class="execution-objective">{execution.objective}</div>
          <div class="execution-meta">
            <span class="meta-item">
              <span class="meta-icon">◈</span>
              {execution.maxBots} bots
            </span>
            {#if execution.activeBotCount != null}
              <span class="meta-item">
                <span class="meta-icon" style="color: var(--bo-teal)">●</span>
                {execution.activeBotCount} active
              </span>
            {/if}
            {#if execution.status === 'completed' || execution.status === 'failed'}
              <span class="meta-item">
                <span class="meta-icon">⏱</span>
                {formatDuration(execution.createdAt, execution.updatedAt)}
              </span>
            {:else if execution.status === 'running' || execution.status === 'paused'}
              <span class="meta-item">
                <span class="meta-icon">⏱</span>
                {formatDuration(execution.createdAt)}
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
    max-width: 1100px;
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
    color: var(--text);
    margin: 0;
  }

  .filters-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xl);
    margin-bottom: var(--space-xl);
    padding-bottom: var(--space-lg);
    border-bottom: 1px solid var(--border);
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .filter-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
    margin-right: var(--space-xs);
  }

  .filter-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .filter-pill {
    font-family: var(--font-body);
    font-size: 11px;
    padding: 5px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text-muted);
    text-decoration: none;
    transition: all 0.15s;
    cursor: pointer;
  }

  .filter-pill:hover {
    border-color: var(--accent);
    color: var(--text);
  }

  .filter-pill.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  .order-pill {
    min-width: 32px;
    text-align: center;
    font-family: var(--font-mono);
  }

  .executions-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .execution-card {
    display: block;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    text-decoration: none;
    transition: all 0.15s;
  }

  .execution-card:hover {
    border-color: var(--accent);
    box-shadow: 0 4px 16px rgba(14, 13, 11, 0.08);
    transform: translateY(-1px);
  }

  .execution-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-sm);
  }

  .status-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    padding: 3px 8px;
    border: 1px solid;
    border-radius: var(--radius-sm);
  }

  .execution-date {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }

  .execution-objective {
    font-family: var(--font-body);
    font-size: 15px;
    font-weight: 500;
    color: var(--text);
    margin-bottom: var(--space-md);
    line-height: 1.4;
  }

  .execution-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-lg);
  }

  .meta-item {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .meta-icon {
    font-size: 10px;
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
