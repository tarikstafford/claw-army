<script lang="ts">
  import BenchmarkCard from '$lib/components/evolution/BenchmarkCard.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const stats = $derived.by(() => {
    if (data.benchmarks.length === 0) return null;
    const scores = data.benchmarks.map((b) => parseFloat(b.baselineCompositeScore) || 0);
    const totalRuns = data.benchmarks.reduce((sum, b) => sum + b.confirmedRunCount, 0);
    const matureBenchmarks = data.benchmarks.filter((b) => b.benchmarkMature).length;
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const highestScore = Math.max(...scores);
    return {
      categoryCount: data.benchmarks.length,
      totalRuns,
      matureBenchmarks,
      avgScore,
      highestScore,
    };
  });
</script>

<div class="benchmarks-page">
  <div class="page-header">
    <h1 class="page-title">Category Benchmarks</h1>
    {#if stats}
      <div class="benchmark-stats">
        <div class="stat-item">
          <span class="stat-value">{stats.categoryCount}</span>
          <span class="stat-label">Categories</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-value">{stats.totalRuns}</span>
          <span class="stat-label">Total Runs</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-value">{stats.matureBenchmarks}</span>
          <span class="stat-label">Confirmed</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-value">{stats.avgScore.toFixed(2)}</span>
          <span class="stat-label">Avg Score</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-value">{stats.highestScore.toFixed(2)}</span>
          <span class="stat-label">Highest</span>
        </div>
      </div>
    {/if}
  </div>

  {#if data.benchmarks.length === 0}
    <div class="empty-state">
      <p class="empty-heading">No benchmarks established</p>
      <p class="empty-body">Run executions to establish pioneer baselines per task category.</p>
    </div>
  {:else}
    <div class="benchmark-list">
      {#each data.benchmarks as benchmark (benchmark.id)}
        <BenchmarkCard {benchmark} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .benchmarks-page {
    max-width: 900px;
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-lg);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0;
  }

  .benchmark-stats {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .stat-value {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 500;
    color: var(--bo-text);
  }

  .stat-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    text-transform: uppercase;
  }

  .stat-divider {
    width: 1px;
    height: 24px;
    background: var(--bo-border);
  }

  .empty-state {
    padding: var(--space-2xl);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
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

  .benchmark-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
</style>
