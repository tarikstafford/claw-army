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

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDuration(start: string, end: string | null, status: string): string {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const seconds = Math.floor((endTime - startTime) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'pre_flight': return 'pre-flight';
      case 'queued': return 'queued';
      case 'running': return 'running';
      case 'paused': return 'paused';
      case 'stopped': return 'cancelled';
      case 'completed': return 'completed';
      case 'failed': return 'failed';
      default: return status;
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'running': return 'var(--bo-teal, #2DD4BF)';
      case 'completed': return 'var(--success, #059669)';
      case 'failed': return 'var(--error)';
      case 'paused': return 'var(--karma)';
      case 'stopped': return 'var(--text-muted)';
      case 'queued': return 'var(--bo-violet)';
      case 'pre_flight': return 'var(--bo-violet)';
      default: return 'var(--text-muted)';
    }
  }
</script>

<div class="executions-page">
  <div class="page-header">
    <h1 class="page-title">Runs</h1>
  </div>

  <div class="filters-bar">
    <div class="filter-group">
      <label class="filter-label" for="status-filter">Status</label>
      <select
        id="status-filter"
        class="filter-select"
        value={data.status}
        onchange={(e) => {
          const params = new URLSearchParams(window.location.search);
          if (e.currentTarget.value) {
            params.set('status', e.currentTarget.value);
          } else {
            params.delete('status');
          }
          window.location.href = `/office/executions?${params.toString()}`;
        }}
      >
        {#each statusOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>
  </div>

  {#if data.executions.length === 0}
    <div class="empty-state" aria-busy="false">
      <span class="empty-eyebrow">NO RUNS</span>
      <p class="empty-heading">Nothing here yet.</p>
      <p class="empty-body">No executions found. Start a new run from the chat interface.</p>
    </div>
  {:else}
    <div class="executions-table-wrap">
      <table class="executions-table">
        <thead>
          <tr>
            <th class="th-status">Status</th>
            <th class="th-objective">Objective</th>
            <th class="th-bots">Bots</th>
            <th class="th-duration">Duration</th>
            <th class="th-created">Started</th>
          </tr>
        </thead>
        <tbody>
          {#each data.executions as execution}
            <tr
              class="execution-row"
              onclick={() => { window.location.href = `/office/executions/${execution.id}`; }}
              role="link"
              tabindex="0"
              onkeydown={(e) => { if (e.key === 'Enter') window.location.href = `/office/executions/${execution.id}`; }}
            >
              <td class="td-status">
                <span class="status-label" style="color: {getStatusColor(execution.status)}">
                  {getStatusLabel(execution.status)}
                </span>
              </td>
              <td class="td-objective">
                <span class="objective-text" title={execution.objective}>
                  {execution.objective.length > 80 ? execution.objective.slice(0, 80) + '...' : execution.objective}
                </span>
              </td>
              <td class="td-bots">
                <span class="meta-text">{execution.activeBotCount ?? 0}/{execution.maxBots}</span>
              </td>
              <td class="td-duration">
                <span class="meta-text">
                  {execution.status === 'running' || execution.status === 'paused'
                    ? formatDuration(execution.createdAt, null, execution.status) + ' (ongoing)'
                    : formatDuration(execution.createdAt, execution.updatedAt, execution.status)}
                </span>
              </td>
              <td class="td-created">
                <span class="meta-text">{formatDate(execution.createdAt)}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
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
    color: var(--fo-plum);
    margin: 0;
  }

  .filters-bar {
    display: flex;
    gap: var(--space-lg);
    margin-bottom: var(--space-xl);
    padding: var(--space-md) 0;
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
  }

  .filter-select {
    font-family: var(--font-body);
    font-size: 13px;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
  }

  .executions-table-wrap {
    overflow-x: auto;
  }

  .executions-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-body);
    font-size: 13px;
  }

  .executions-table th {
    text-align: left;
    padding: 8px 12px;
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  .execution-row {
    cursor: pointer;
    transition: background 0.1s;
  }

  .execution-row:hover {
    background: var(--fo-bg2);
  }

  .executions-table td {
    padding: 12px 12px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }

  .status-label {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
  }

  .objective-text {
    color: var(--text);
  }

  .meta-text {
    color: var(--text-muted);
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