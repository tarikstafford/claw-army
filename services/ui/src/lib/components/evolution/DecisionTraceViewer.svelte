<script lang="ts">
  interface DecisionTrace {
    id: string;
    decisionType: string;
    directiveReferenced: string | null;
    attributionConfidence: string | null;
    outcome: string | null;
    decidedAt: string;
    executionId: string;
  }

  let { botId }: { botId: string } = $props();

  let traces = $state<DecisionTrace[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let total = $state(0);
  let hasMore = $state(false);
  let offset = $state(0);
  let limit = $state(50);

  let searchQuery = $state('');
  let selectedExecution = $state<string | null>(null);
  let selectedDecisionType = $state<string | null>(null);

  const DECISION_TYPES = ['tool_call', 'reasoning_branch', 'output_step'];
  const OUTCOME_COLORS: Record<string, string> = {
    success: 'var(--accent-teal)',
    failure: 'var(--accent-rose)',
    partial: 'var(--karma)',
  };

  const filteredBySearch = $derived(
    searchQuery
      ? traces.filter(t =>
          t.directiveReferenced?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.decisionType.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.outcome?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : traces
  );

  const filteredByExecution = $derived(
    selectedExecution
      ? filteredBySearch.filter(t => t.executionId === selectedExecution)
      : filteredBySearch
  );

  const filteredByType = $derived(
    selectedDecisionType
      ? filteredByExecution.filter(t => t.decisionType === selectedDecisionType)
      : filteredByExecution
  );

  const uniqueExecutions = $derived(
    [...new Set(traces.map(t => t.executionId))]
  );

  function formatTimestamp(ts: string): string {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function formatConfidence(conf: string | null): string {
    if (!conf) return '—';
    return (parseFloat(conf) * 100).toFixed(1) + '%';
  }

  async function loadTraces(resetOffset = true) {
    loading = true;
    error = null;
    if (resetOffset) offset = 0;
    try {
      const res = await fetch(`/api/decision-traces/${botId}?limit=${limit}&offset=${offset}`);
      if (!res.ok) throw new Error('Failed to load decision traces');
      const data = await res.json() as { traces: DecisionTrace[]; total: number; hasMore: boolean };
      if (resetOffset) {
        traces = data.traces;
      } else {
        traces = [...traces, ...data.traces];
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
    await loadTraces(false);
  }

  $effect(() => {
    loadTraces();
  });
</script>

<div class="trace-viewer">
  <div class="trace-toolbar">
    <input
      type="search"
      class="search-input"
      placeholder="Search traces..."
      bind:value={searchQuery}
    />

    <select class="filter-select" bind:value={selectedExecution}>
      <option value={null}>All Executions</option>
      {#each uniqueExecutions as exec}
        <option value={exec}>{exec.slice(0, 8)}...</option>
      {/each}
    </select>

    <select class="filter-select" bind:value={selectedDecisionType}>
      <option value={null}>All Types</option>
      {#each DECISION_TYPES as type}
        <option value={type}>{type.replace('_', ' ').toUpperCase()}</option>
      {/each}
    </select>
  </div>

  {#if loading && traces.length === 0}
    <div class="trace-empty">
      <p class="empty-body">Loading decision traces...</p>
    </div>
  {:else if error}
    <div class="trace-empty">
      <p class="empty-heading error-text">{error}</p>
    </div>
  {:else if filteredByType.length === 0}
    <div class="trace-empty">
      <p class="empty-heading">No traces captured</p>
      <p class="empty-body">Decision traces will appear here during execution.</p>
    </div>
  {:else}
    <div class="trace-table-wrapper">
      <table class="trace-table">
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Type</th>
            <th scope="col">Directive</th>
            <th scope="col">Confidence</th>
            <th scope="col">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredByType as trace (trace.id)}
            <tr class="trace-row">
              <td class="cell-time">{formatTimestamp(trace.decidedAt)}</td>
              <td class="cell-type">
                <span class="type-badge" style="color: var(--accent)">
                  {trace.decisionType.replace('_', ' ').toUpperCase()}
                </span>
              </td>
              <td class="cell-directive">
                {trace.directiveReferenced ?? '—'}
              </td>
              <td class="cell-confidence">
                {formatConfidence(trace.attributionConfidence)}
              </td>
              <td class="cell-outcome">
                {#if trace.outcome}
                  <span class="outcome-badge" style="color: {OUTCOME_COLORS[trace.outcome] ?? 'var(--text-muted)'}">
                    {trace.outcome.toUpperCase()}
                  </span>
                {:else}
                  —
                {/if}
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
        <span class="load-more-info">{traces.length} of {total}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .trace-viewer {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .trace-toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .search-input {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-sm) var(--space-md);
    min-width: 200px;
    transition: border-color 0.15s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .search-input::placeholder {
    color: var(--muted);
  }

  .filter-select {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--accent);
  }

  .trace-empty {
    padding: var(--space-xl);
    text-align: center;
  }

  .empty-heading {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 var(--space-sm);
  }

  .empty-body {
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }

  .error-text {
    color: var(--accent-rose);
  }

  .trace-table-wrapper {
    overflow-x: auto;
  }

  .trace-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 500px;
  }

  .trace-table th {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--muted);
    text-align: left;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  .trace-table td {
    font-size: 12px;
    color: var(--text);
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-family: var(--font-body);
  }

  .trace-row:hover {
    background: rgba(236, 232, 255, 0.04);
  }

  .cell-time {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .type-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
  }

  .cell-directive {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--accent-teal);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cell-confidence {
    font-size: 12px;
    color: var(--text-muted);
  }

  .outcome-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
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
    color: var(--accent);
    background: none;
    border: 1px solid var(--accent);
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
    color: var(--muted);
  }
</style>
