<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="benchmarks-page">
  <h1 class="page-title">Category Benchmarks</h1>

  {#if data.benchmarks.length === 0}
    <div class="empty-state">
      <p class="empty-title">No benchmarks yet</p>
      <p class="empty-body">Benchmarks are established when the first bot achieves a breakthrough in a task category.</p>
    </div>
  {:else}
    <div class="benchmark-list">
      {#each data.benchmarks as benchmark}
        <div class="benchmark-card">
          <div class="benchmark-header">
            <span class="benchmark-category">{benchmark.taskCategory}</span>
            <div class="benchmark-flags">
              {#if benchmark.thinDataFlag}
                <span class="flag thin-data">THIN DATA</span>
              {/if}
              {#if benchmark.benchmarkMature}
                <span class="flag mature">MATURE</span>
              {/if}
            </div>
          </div>
          <div class="benchmark-stats">
            <div class="stat">
              <span class="stat-label">Pioneer Score</span>
              <span class="stat-value">{parseFloat(benchmark.baselineCompositeScore).toFixed(2)}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Confirmed Runs</span>
              <span class="stat-value">{benchmark.confirmedRunCount}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .benchmarks-page {
    max-width: 900px;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-xl);
  }

  .empty-state {
    padding: var(--space-2xl);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .empty-title {
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

  .benchmark-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .benchmark-card {
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-md) var(--space-lg, var(--space-xl));
  }

  .benchmark-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md);
  }

  .benchmark-category {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 600;
    color: var(--bo-text);
  }

  .benchmark-flags {
    display: flex;
    gap: var(--space-xs);
  }

  .flag {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .thin-data {
    color: var(--bo-amber);
    border: 1px solid var(--bo-amber);
    background: rgba(245, 158, 11, 0.08);
  }

  .mature {
    color: var(--bo-violet);
    border: 1px solid var(--bo-violet);
    background: rgba(124, 58, 237, 0.08);
  }

  .benchmark-stats {
    display: flex;
    gap: var(--space-xl);
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .stat-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
  }

  .stat-value {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
  }
</style>
