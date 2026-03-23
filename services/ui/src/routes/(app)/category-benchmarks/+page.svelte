<script lang="ts">
  import { browser } from '$app/environment';
  import { getCategoryBenchmarks } from '$lib/api';
  import type { CategoryBenchmarksResponse } from '$lib/types';

  let data = $state<CategoryBenchmarksResponse | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!browser) return;
    getCategoryBenchmarks()
      .then((res) => { data = res; loading = false; })
      .catch((err) => { error = (err as Error).message; loading = false; });
  });

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function truncateId(id: string): string {
    return id.slice(0, 8) + '…';
  }
</script>

<svelte:head>
  <title>Category Benchmarks | Akasa</title>
</svelte:head>

<div class="cb-page">
  <div class="cb-header">
    <div class="sec-label">Category Benchmarks</div>
    <h1>Pioneer baselines.</h1>
    <p class="cb-subtitle">Per-category benchmark data — pioneer scores, maturity levels, and data quality flags.</p>
  </div>

  {#if loading}
    <div class="cb-loading">Loading category benchmarks...</div>
  {:else if error}
    <div class="cb-error">
      <span class="cb-error-title">Unable to load benchmarks</span>
      <span class="cb-error-detail">{error}</span>
    </div>
  {:else if !data || data.benchmarks.length === 0}
    <div class="cb-empty">
      <p>No category benchmarks recorded yet.</p>
      <p class="cb-empty-hint">Benchmarks are established when a pioneer bot completes a run in a new task category.</p>
    </div>
  {:else}
    <div class="cb-table-wrap">
      <table class="cb-table">
        <thead>
          <tr>
            <th>Task Category</th>
            <th>Baseline Score</th>
            <th>Confirmed Runs</th>
            <th>Pioneer Execution</th>
            <th>Maturity</th>
            <th>Thin Data</th>
            <th>Std Promotion</th>
            <th>Established</th>
          </tr>
        </thead>
        <tbody>
          {#each data.benchmarks as bm (bm.id)}
            <tr>
              <td class="cb-cell-category">{bm.taskCategory}</td>

              <td class="cb-cell-score">
                <span class="cb-score">{parseFloat(bm.baselineCompositeScore).toFixed(2)}</span>
              </td>

              <td class="cb-cell-runs">{bm.confirmedRunCount}</td>

              <td class="cb-cell-pioneer">
                <a
                  href="/executions/{bm.pioneerExecutionId}"
                  class="cb-link"
                  title={bm.pioneerExecutionId}
                >{truncateId(bm.pioneerExecutionId)}</a>
              </td>

              <td class="cb-cell-maturity">
                {#if bm.benchmarkMature}
                  <span class="cb-badge cb-badge-mature">Mature</span>
                {:else}
                  <span class="cb-badge cb-badge-immature">Immature</span>
                {/if}
              </td>

              <td class="cb-cell-thin">
                {#if bm.thinDataFlag}
                  <span class="cb-badge cb-badge-thin">Thin</span>
                {:else}
                  <span class="cb-badge cb-badge-ok">OK</span>
                {/if}
              </td>

              <td class="cb-cell-promotion">
                {#if bm.standardPromotion}
                  <span class="cb-check">Yes</span>
                {:else}
                  <span class="cb-dash">—</span>
                {/if}
              </td>

              <td class="cb-cell-date">{formatDate(bm.createdAt)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .cb-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 24px 60px;
  }

  .cb-header {
    margin-bottom: 40px;
  }

  .cb-header h1 {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text);
    margin: 8px 0 12px;
    line-height: 1.1;
  }

  .cb-subtitle {
    font-size: 15px;
    color: var(--text-muted);
    font-weight: 300;
    max-width: 560px;
    line-height: 1.6;
  }

  /* ── States ── */
  .cb-loading,
  .cb-empty {
    padding: 60px 0;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
  }

  .cb-empty-hint {
    margin-top: 8px;
    font-size: 12px;
    color: var(--bo-faint);
  }

  .cb-error {
    padding: 24px;
    background: rgba(244, 63, 94, 0.08);
    border: 1px solid rgba(244, 63, 94, 0.2);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cb-error-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--bo-rose);
  }

  .cb-error-detail {
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  /* ── Table ── */
  .cb-table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .cb-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .cb-table thead {
    background: rgba(255, 255, 255, 0.02);
  }

  .cb-table th {
    padding: 12px 16px;
    text-align: left;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--bo-faint);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  .cb-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }

  .cb-table tbody tr:last-child td {
    border-bottom: none;
  }

  .cb-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.015);
  }

  .cb-cell-category {
    color: var(--text);
    font-weight: 500;
    max-width: 200px;
    word-break: break-word;
  }

  .cb-score {
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--text);
  }

  .cb-cell-runs {
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  .cb-link {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent-m);
    text-decoration: none;
    transition: opacity 0.15s;
  }

  .cb-link:hover {
    opacity: 0.8;
  }

  /* ── Badges ── */
  .cb-badge {
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.03em;
  }

  .cb-badge-mature {
    background: rgba(45, 212, 191, 0.12);
    color: var(--bo-teal);
    border: 1px solid rgba(45, 212, 191, 0.25);
  }

  .cb-badge-immature {
    background: rgba(148, 163, 184, 0.08);
    color: var(--bo-faint);
    border: 1px solid var(--border);
  }

  .cb-badge-thin {
    background: rgba(251, 191, 36, 0.12);
    color: var(--karma);
    border: 1px solid rgba(251, 191, 36, 0.25);
  }

  .cb-badge-ok {
    background: rgba(148, 163, 184, 0.08);
    color: var(--bo-faint);
    border: 1px solid var(--border);
  }

  .cb-check {
    color: var(--bo-teal);
    font-size: 12px;
    font-weight: 500;
  }

  .cb-dash {
    color: var(--bo-faint);
    font-family: var(--font-mono);
  }

  .cb-cell-date {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--bo-faint);
    white-space: nowrap;
  }
</style>
