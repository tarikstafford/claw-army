<script lang="ts">
  import { browser } from '$app/environment';
  import { getNegativeSignals } from '$lib/api';
  import type { NegativeSignalsResponse } from '$lib/types';

  let data = $state<NegativeSignalsResponse | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let activeFailureType = $state('');
  let currentOffset = $state(0);
  let loadingMore = $state(false);

  const LIMIT = 50;
  const FAILURE_TYPES = ['retirement', 'budget_overrun', 'guardrail_violation', 'quality_floor_breach'] as const;

  function loadSignals(reset: boolean) {
    const offset = reset ? 0 : currentOffset;
    if (reset) {
      currentOffset = 0;
      loading = true;
      error = null;
    } else {
      loadingMore = true;
    }

    getNegativeSignals({
      failureType: activeFailureType || undefined,
      limit: LIMIT,
      offset,
    })
      .then((res) => {
        if (reset) {
          data = res;
        } else {
          data = data
            ? { ...res, signals: [...data.signals, ...res.signals] }
            : res;
        }
        currentOffset = offset + res.signals.length;
        loading = false;
        loadingMore = false;
      })
      .catch((err) => {
        error = (err as Error).message;
        loading = false;
        loadingMore = false;
      });
  }

  $effect(() => {
    if (!browser) return;
    loadSignals(true);
  });

  function setFailureType(ft: string) {
    activeFailureType = ft;
    loadSignals(true);
  }

  function nsFailureBadgeClass(failureType: string): string {
    if (failureType === 'retirement') return 'ns-badge-rose';
    if (failureType === 'budget_overrun') return 'ns-badge-amber';
    if (failureType === 'guardrail_violation') return 'ns-badge-red';
    if (failureType === 'quality_floor_breach') return 'ns-badge-violet';
    return 'ns-badge-default';
  }

  function nsFormatDate(ts: string): string {
    return new Date(ts).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function nsTruncate(text: string | null, maxLen = 120): string {
    if (!text) return '—';
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  }
</script>

<svelte:head>
  <title>Negative Signal Register | Akasa</title>
</svelte:head>

<div class="ns-page">
  <h1>Negative Signal Register</h1>
  <p class="ns-subtitle">Failed and retired soul records — patterns of directive failure.</p>

  <!-- Filter chips -->
  <div class="ns-filters">
    <button
      class="ns-chip"
      class:ns-chip-active={activeFailureType === ''}
      onclick={() => setFailureType('')}
    >All</button>
    {#each FAILURE_TYPES as ft}
      <button
        class="ns-chip"
        class:ns-chip-active={activeFailureType === ft}
        onclick={() => setFailureType(ft)}
      >{ft.replace(/_/g, ' ')}</button>
    {/each}
  </div>

  {#if loading}
    <div class="ns-loading">Loading negative signals...</div>
  {:else if error}
    <div class="ns-error">{error}</div>
  {:else if !data || data.signals.length === 0}
    <div class="ns-empty">No negative signals recorded yet.</div>
  {:else}
    <div class="ns-table-wrap">
      <table class="ns-table">
        <thead>
          <tr>
            <th>Failure Type</th>
            <th>Task Category</th>
            <th>Generation</th>
            <th>Directive Failure Summary</th>
            <th>Registered At</th>
            <th>Execution</th>
          </tr>
        </thead>
        <tbody>
          {#each data.signals as signal (signal.id)}
            <tr>
              <td>
                <span class="ns-badge {nsFailureBadgeClass(signal.failureType)}">
                  {signal.failureType.replace(/_/g, ' ')}
                </span>
              </td>
              <td class="ns-category">{signal.taskCategory ?? '—'}</td>
              <td class="ns-gen">{signal.generation ?? '—'}</td>
              <td class="ns-summary" title={signal.directiveFailureSummary ?? ''}>
                {nsTruncate(signal.directiveFailureSummary)}
              </td>
              <td class="ns-date">{nsFormatDate(signal.registeredAt)}</td>
              <td>
                {#if signal.executionId}
                  <a href="/executions/{signal.executionId}/report" class="ns-exec-link">
                    {signal.executionId.slice(0, 8)}
                  </a>
                {:else}
                  <span class="ns-none">—</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="ns-footer">
      <span class="ns-total">{data.total} total signal{data.total !== 1 ? 's' : ''}</span>
      {#if data.hasMore}
        <button
          class="ns-load-more"
          onclick={() => loadSignals(false)}
          disabled={loadingMore}
        >
          {loadingMore ? 'Loading...' : 'Load More'}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .ns-page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 96px 36px 80px;
    background: var(--bg);
    min-height: 100vh;
  }

  @media (max-width: 600px) {
    .ns-page {
      padding: 88px 20px 60px;
    }
  }

  h1 {
    margin: 0 0 0.25rem;
    font-size: 1.75rem;
    color: var(--text);
  }

  .ns-subtitle {
    margin: 0 0 1.5rem;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  /* Filter chips */
  .ns-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .ns-chip {
    padding: 0.3rem 0.8rem;
    border-radius: 9999px;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-muted);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    text-transform: capitalize;
  }

  .ns-chip:hover {
    background: var(--bg-3);
    color: var(--text);
  }

  .ns-chip-active {
    background: rgba(124,58,237,0.15);
    color: var(--violet-bright);
    border-color: var(--violet-bright);
  }

  .ns-loading {
    color: var(--text-muted);
    padding: 2rem 0;
    text-align: center;
  }

  .ns-error {
    padding: 0.875rem 1rem;
    background: var(--error-dim);
    border: 1px solid var(--error);
    border-radius: 0.5rem;
    color: var(--error);
    font-size: 0.9rem;
  }

  .ns-empty {
    color: var(--text-faint);
    font-style: italic;
    padding: 2rem 0;
    text-align: center;
    font-size: 0.95rem;
  }

  /* Table */
  .ns-table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }

  .ns-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .ns-table thead th {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-faint);
    font-weight: 600;
    padding: 0.75rem 1rem;
    text-align: left;
    background: var(--bg-3);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  .ns-table tbody tr {
    border-bottom: 1px solid var(--bg-3);
    background: var(--bg-card);
    transition: background 0.1s;
  }

  .ns-table tbody tr:last-child {
    border-bottom: none;
  }

  .ns-table tbody tr:hover {
    background: var(--bg-3);
  }

  .ns-table td {
    padding: 0.75rem 1rem;
    color: var(--text-muted);
    vertical-align: middle;
  }

  .ns-badge {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    text-transform: capitalize;
  }

  .ns-badge-rose    { background: rgba(244,63,94,0.14); color: #fb7185; }
  .ns-badge-amber   { background: rgba(251,191,36,0.14); color: var(--amber); }
  .ns-badge-red     { background: rgba(248,113,113,0.14); color: var(--error); }
  .ns-badge-violet  { background: rgba(124,58,237,0.18); color: var(--violet-bright); }
  .ns-badge-default { background: var(--bg-3); color: var(--text-muted); }

  .ns-category {
    font-size: 0.83rem;
    color: var(--text);
  }

  .ns-gen {
    font-family: var(--font-mono);
    font-size: 0.83rem;
    color: var(--teal);
    white-space: nowrap;
  }

  .ns-summary {
    max-width: 360px;
    font-size: 0.82rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ns-date {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--text-faint);
    white-space: nowrap;
  }

  .ns-exec-link {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--violet-bright);
    text-decoration: none;
  }

  .ns-exec-link:hover {
    text-decoration: underline;
  }

  .ns-none {
    color: var(--text-faint);
  }

  .ns-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 1rem;
    padding-top: 0.75rem;
  }

  .ns-total {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--text-faint);
  }

  .ns-load-more {
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.4rem 1.2rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.1s;
  }

  .ns-load-more:hover:not(:disabled) {
    background: var(--bg-3);
  }

  .ns-load-more:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
