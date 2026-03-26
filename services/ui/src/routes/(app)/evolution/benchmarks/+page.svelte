<script lang="ts">
  import BenchmarkCard from '$lib/components/evolution/BenchmarkCard.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="benchmarks-page">
  <h1 class="page-title">Category Benchmarks</h1>

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
    padding: var(--space-2xl) var(--space-xl) var(--space-xl);
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
