<script lang="ts">
  interface BenchmarkRow {
    id: string;
    taskCategory: string;
    pioneerBotId: string;
    baselineCompositeScore: string;
    confirmedRunCount: number;
    thinDataFlag: boolean;
    benchmarkMature: boolean;
    createdAt: string;
  }

  let { benchmark }: { benchmark: BenchmarkRow } = $props();

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
</script>

<div class="benchmark-card">
  <div class="card-top-row">
    <span class="category-name">{benchmark.taskCategory}</span>
    <div class="pioneer-info">
      <span class="pioneer-badge">PIONEER</span>
      <span class="pioneer-caption">First in {benchmark.taskCategory} · {formatDate(benchmark.createdAt)}</span>
    </div>
  </div>

  <div class="card-middle-row">
    <div class="score-block">
      <span class="score-label">Baseline Score</span>
      <span class="score-value">{parseFloat(benchmark.baselineCompositeScore).toFixed(2)}</span>
    </div>
    <div class="runs-block">
      <span class="runs-label">Confirmed Runs</span>
      <span class="runs-value">{benchmark.confirmedRunCount}</span>
    </div>
  </div>

  {#if benchmark.benchmarkMature}
    <div class="card-bottom-row">
      <span class="confirmed-tag">CONFIRMED</span>
    </div>
  {:else if benchmark.thinDataFlag}
    <div class="card-bottom-row">
      <p class="thin-data-caption">Fewer than 3 confirmed runs — benchmark unverified</p>
    </div>
  {/if}
</div>

<style>
  .benchmark-card {
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-left: 3px solid var(--bo-amber);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .card-top-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .category-name {
    font-size: 13px;
    color: var(--bo-text);
    font-family: var(--font-body);
    font-weight: 400;
  }

  .pioneer-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-xs);
    flex-shrink: 0;
  }

  .pioneer-badge {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-amber);
    background: rgba(251, 191, 36, 0.10);
    border: 1px solid rgba(251, 191, 36, 0.32);
    padding: 3px 7px;
    border-radius: 3px;
    white-space: nowrap;
  }

  .pioneer-caption {
    font-size: 11px;
    color: var(--bo-caption);
    font-family: var(--font-body);
    text-align: right;
  }

  .card-middle-row {
    display: flex;
    gap: var(--space-xl);
  }

  .score-block,
  .runs-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .score-label,
  .runs-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    text-transform: uppercase;
  }

  .score-value {
    font-size: 13px;
    color: var(--bo-text);
    font-family: var(--font-body);
  }

  .runs-value {
    font-size: 11px;
    color: var(--bo-caption);
    font-family: var(--font-body);
  }

  .card-bottom-row {
    display: flex;
    align-items: center;
  }

  .confirmed-tag {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-teal);
    text-transform: uppercase;
  }

  .thin-data-caption {
    font-size: 11px;
    color: var(--bo-caption);
    font-style: italic;
    margin: 0;
    font-family: var(--font-body);
  }
</style>
