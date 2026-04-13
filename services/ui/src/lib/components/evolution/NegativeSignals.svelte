<script lang="ts">
  interface NegativeSignal {
    id: string;
    soulId: string;
    botId: string;
    executionId: string | null;
    failureType: string;
    directiveFailureSummary: string | null;
    registeredAt: string;
    taskCategory: string | null;
    generation: number | null;
  }

  let { botId }: { botId: string } = $props();

  let signals = $state<NegativeSignal[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let total = $state(0);
  let hasMore = $state(false);
  let offset = $state(0);
  let limit = $state(50);

  let selectedFailureType = $state<string | null>(null);

  const FAILURE_TYPES = ['retirement', 'budget_overrun', 'guardrail_violation', 'quality_floor_breach'];

  const FAILURE_COLORS: Record<string, string> = {
    retirement: 'var(--bo-rose)',
    budget_overrun: 'var(--bo-amber)',
    guardrail_violation: 'var(--bo-rose)',
    quality_floor_breach: 'var(--bo-amber)',
  };

  const filteredSignals = $derived(
    selectedFailureType
      ? signals.filter(s => s.failureType === selectedFailureType)
      : signals
  );

  function formatTimestamp(ts: string): string {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function loadSignals(resetOffset = true) {
    loading = true;
    error = null;
    if (resetOffset) offset = 0;
    try {
      let url = `/api/negative-signals?limit=${limit}&offset=${offset}`;
      if (selectedFailureType) {
        url += `&failureType=${selectedFailureType}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load negative signals');
      const data = await res.json() as { signals: NegativeSignal[]; total: number; hasMore: boolean };
      if (resetOffset) {
        signals = data.signals.filter(s => s.botId === botId);
      } else {
        signals = [...signals, ...data.signals.filter(s => s.botId === botId)];
      }
      total = data.total;
      hasMore = data.hasMore;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    offset += limit;
    await loadSignals(false);
  }

  $effect(() => {
    loadSignals();
  });
</script>

<div class="negative-signals">
  <div class="signals-toolbar">
    <select class="filter-select" bind:value={selectedFailureType} onchange={() => loadSignals()}>
      <option value={null}>All Failure Types</option>
      {#each FAILURE_TYPES as type}
        <option value={type}>{type.replace('_', ' ').toUpperCase()}</option>
      {/each}
    </select>
  </div>

  {#if loading && signals.length === 0}
    <div class="signals-empty">
      <p class="empty-body">Loading negative signals...</p>
    </div>
  {:else if error}
    <div class="signals-empty">
      <p class="empty-heading error-text">{error}</p>
    </div>
  {:else if filteredSignals.length === 0}
    <div class="signals-empty">
      <p class="empty-heading">No negative signals</p>
      <p class="empty-body">Failure patterns and mutation blacklists will appear here after retirement or demotion.</p>
    </div>
  {:else}
    <div class="signals-table-wrapper">
      <table class="signals-table">
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Failure Type</th>
            <th scope="col">Task Category</th>
            <th scope="col">Generation</th>
            <th scope="col">Summary</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredSignals as signal (signal.id)}
            <tr class="signal-row">
              <td class="cell-time">{formatTimestamp(signal.registeredAt)}</td>
              <td class="cell-type">
                <span
                  class="type-badge"
                  style="color: {FAILURE_COLORS[signal.failureType] ?? 'var(--bo-muted)'}"
                >
                  {signal.failureType.replace('_', ' ').toUpperCase()}
                </span>
              </td>
              <td class="cell-category">{signal.taskCategory ?? '—'}</td>
              <td class="cell-gen">
                {signal.generation !== null ? `Gen ${signal.generation}` : '—'}
              </td>
              <td class="cell-summary">
                {signal.directiveFailureSummary ?? '—'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if hasMore}
      <div class="load-more">
        <button class="load-more-btn" onclick={loadMore} disabled={loading}>
          {loading ? 'Loading...' : 'Load More'}
        </button>
        <span class="load-more-info">{signals.length} of {total}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .negative-signals {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .signals-toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .filter-select {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-text);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-sm);
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--bo-violet);
  }

  .signals-empty {
    padding: var(--space-xl);
    text-align: center;
  }

  .empty-heading {
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

  .error-text {
    color: var(--bo-rose);
  }

  .signals-table-wrapper {
    overflow-x: auto;
  }

  .signals-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 600px;
  }

  .signals-table th {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--bo-faint);
    text-align: left;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--bo-border);
    white-space: nowrap;
  }

  .signals-table td {
    font-size: 12px;
    color: var(--bo-text);
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-family: var(--font-body);
  }

  .signal-row:hover {
    background: rgba(236, 232, 255, 0.04);
  }

  .cell-time {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--bo-caption);
    white-space: nowrap;
  }

  .type-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
  }

  .cell-category {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-muted);
  }

  .cell-gen {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-caption);
  }

  .cell-summary {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-rose);
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .load-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    padding: var(--space-md);
  }

  .load-more-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-violet);
    background: none;
    border: 1px solid var(--bo-violet);
    border-radius: var(--radius-sm);
    padding: var(--space-sm) var(--space-lg);
    cursor: pointer;
    transition: background 0.15s;
  }

  .load-more-btn:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.10);
  }

  .load-more-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .load-more-info {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-faint);
  }
</style>
