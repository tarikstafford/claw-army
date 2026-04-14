<script lang="ts">
  import type { MutationType } from './MutationDiff.svelte';

  interface LedgerRow {
    executionId: string;
    executionDate: string;
    compositeScore: string;
    scoreDelta: string | null;
    verdictType: string;
    status: string;
    mutationApplied: boolean;
    keepDiscard: 'keep' | 'discard' | 'pending';
    soulId: string | null;
  }

  let { rows, ondiff }: { rows: LedgerRow[]; ondiff?: (soulId: string, parentId: string, mutationType: MutationType) => void } = $props();

  const VERDICT_COLORS: Record<string, string> = {
    Promote: 'var(--accent)',
    Maintain: 'var(--text-muted)',
    Monitor: 'var(--accent-teal)',
    Demote: 'var(--accent-rose)',
    Retire: 'var(--error)',
  };

  function formatDelta(delta: string | null): { text: string; color: string } {
    if (delta === null) return { text: '—', color: 'var(--muted)' };
    const val = parseFloat(delta);
    if (isNaN(val)) return { text: '—', color: 'var(--muted)' };
    if (val > 0) return { text: `+${val.toFixed(2)}`, color: 'var(--accent-teal)' };
    if (val < 0) return { text: val.toFixed(2), color: 'var(--accent-rose)' };
    return { text: '—', color: 'var(--muted)' };
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function outcomeColor(keepDiscard: 'keep' | 'discard' | 'pending'): string {
    if (keepDiscard === 'keep') return 'var(--accent-teal)';
    if (keepDiscard === 'discard') return 'var(--accent-rose)';
    return 'var(--muted)';
  }

  function outcomeLabel(keepDiscard: 'keep' | 'discard' | 'pending'): string {
    if (keepDiscard === 'keep') return 'KEEP';
    if (keepDiscard === 'discard') return 'DISCARD';
    return 'PENDING';
  }

  async function handleMutationClick(soulId: string) {
    if (!ondiff) return;
    try {
      const res = await fetch(`/api/akasa/souls/${soulId}`);
      if (res.ok) {
        const soul = await res.json();
        if (soul.parentSoulId) {
          const detected = detectMutationTypeFromSoul(soul);
          ondiff(soulId, soul.parentSoulId, detected);
        }
      }
    } catch { /* silent */ }
  }

  function detectMutationTypeFromSoul(soul: { soulContent?: string; parentSoulId?: string | null }): MutationType {
    return 'substitution';
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
                style="color: {VERDICT_COLORS[row.verdictType] ?? 'var(--text-muted)'}"
              >
                {row.verdictType.toUpperCase()}
              </span>
            </td>
            <td class="cell-status">{row.status}</td>
            <td class="cell-mutation">
              {#if row.mutationApplied && row.soulId}
                <button class="mutation-btn" onclick={() => row.soulId && handleMutationClick(row.soulId)}>
                  Yes
                </button>
              {:else}
                —
              {/if}
            </td>
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
    color: var(--text);
    margin: 0 0 var(--space-sm);
  }

  .empty-body {
    font-size: 13px;
    color: var(--muted);
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
    color: var(--muted);
    text-align: left;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  .ledger-table td {
    font-size: 13px;
    color: var(--text);
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-family: var(--font-body);
  }

  .cell-date {
    color: var(--text-muted);
    font-size: 11px;
    white-space: nowrap;
  }

  .verdict-tag {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
  }

  .cell-mutation {
    color: var(--text-muted);
  }

  .mutation-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--accent);
    background: none;
    border: 1px solid var(--accent);
    border-radius: 3px;
    padding: 2px 6px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .mutation-btn:hover {
    background: rgba(139, 92, 246, 0.10);
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
