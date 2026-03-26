<script lang="ts">
  interface LedgerRow {
    executionId: string;
    executionDate: string;
    compositeScore: string;
    scoreDelta: string | null;
    verdictType: string;
    status: string;
    mutationApplied: boolean;
    keepDiscard: 'keep' | 'discard' | 'pending';
  }

  let { rows }: { rows: LedgerRow[] } = $props();

  const VERDICT_COLORS: Record<string, string> = {
    Promote: 'var(--bo-violet)',
    Maintain: 'var(--bo-muted)',
    Monitor: 'var(--bo-teal)',
    Demote: 'var(--bo-rose)',
    Retire: 'var(--error)',
  };

  function formatDelta(delta: string | null): { text: string; color: string } {
    if (delta === null) return { text: '—', color: 'var(--bo-faint)' };
    const val = parseFloat(delta);
    if (isNaN(val)) return { text: '—', color: 'var(--bo-faint)' };
    if (val > 0) return { text: `+${val.toFixed(2)}`, color: 'var(--bo-teal)' };
    if (val < 0) return { text: val.toFixed(2), color: 'var(--bo-rose)' };
    return { text: '—', color: 'var(--bo-faint)' };
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function outcomeColor(keepDiscard: 'keep' | 'discard' | 'pending'): string {
    if (keepDiscard === 'keep') return 'var(--bo-teal)';
    if (keepDiscard === 'discard') return 'var(--bo-rose)';
    return 'var(--bo-faint)';
  }

  function outcomeLabel(keepDiscard: 'keep' | 'discard' | 'pending'): string {
    if (keepDiscard === 'keep') return 'KEEP';
    if (keepDiscard === 'discard') return 'DISCARD';
    return 'PENDING';
  }
</script>

{#if rows.length === 0}
  <div class="ledger-empty">
    <p class="empty-heading">No runs recorded</p>
    <p class="empty-body">Experiment data will appear after the first execution completes.</p>
  </div>
{:else}
  <div class="ledger-wrapper">
    <table class="ledger-table">
      <thead>
        <tr>
          <th scope="col">Run Date</th>
          <th scope="col">Score</th>
          <th scope="col">Delta</th>
          <th scope="col">Verdict</th>
          <th scope="col">Status</th>
          <th scope="col">Mutation</th>
          <th scope="col">Outcome</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.executionId)}
          {@const delta = formatDelta(row.scoreDelta)}
          <tr>
            <td class="cell-date">{formatDate(row.executionDate)}</td>
            <td class="cell-score">{parseFloat(row.compositeScore).toFixed(2)}</td>
            <td class="cell-delta" style="color: {delta.color}">{delta.text}</td>
            <td class="cell-verdict">
              <span
                class="verdict-tag"
                style="color: {VERDICT_COLORS[row.verdictType] ?? 'var(--bo-muted)'}"
              >
                {row.verdictType.toUpperCase()}
              </span>
            </td>
            <td class="cell-status">{row.status}</td>
            <td class="cell-mutation">{row.mutationApplied ? 'Yes' : '—'}</td>
            <td class="cell-outcome" style="color: {outcomeColor(row.keepDiscard)}">
              {outcomeLabel(row.keepDiscard)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .ledger-empty {
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

  .ledger-wrapper {
    overflow-x: auto;
  }

  .ledger-table {
    width: 100%;
    border-collapse: collapse;
  }

  .ledger-table th {
    font-family: var(--font-label);
    font-size: 6px;
    font-weight: 400;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--bo-faint);
    text-align: left;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--bo-border);
    white-space: nowrap;
  }

  .ledger-table td {
    font-size: 13px;
    color: var(--bo-text);
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-family: var(--font-body);
  }

  .cell-date {
    color: var(--bo-caption);
    font-size: 11px;
    white-space: nowrap;
  }

  .verdict-tag {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
  }

  .cell-mutation {
    color: var(--bo-muted);
  }

  .cell-outcome {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
  }

  .cell-delta {
    font-family: var(--font-body);
    font-size: 13px;
  }
</style>
