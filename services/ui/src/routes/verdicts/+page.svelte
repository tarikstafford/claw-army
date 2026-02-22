<script lang="ts">
  import { browser } from '$app/environment';
  import { getPendingVerdicts, getCalibration } from '$lib/api';
  import type { PendingVerdict, CalibrationData } from '$lib/types';

  let { data } = $props();

  let verdicts = $state<PendingVerdict[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let calibration = $state<CalibrationData | null>(null);

  let userId = $derived(data.session?.user?.email ?? 'operator');

  async function loadData() {
    try {
      [verdicts, calibration] = await Promise.all([
        getPendingVerdicts(),
        getCalibration(userId),
      ]);
      error = null;
    } catch (err) {
      error = (err as Error).message;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (!browser) return;
    loadData();
    const interval = setInterval(loadData, 15_000);
    return () => clearInterval(interval);
  });

  function truncate(str: string, n = 120) {
    return str.length > n ? str.slice(0, n) + '…' : str;
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
</script>

<svelte:head>
  <title>Verdicts | Claw Army</title>
</svelte:head>

<div class="page">
  <div class="page-header">
    <div>
      <h1>Pending Verdicts</h1>
      <p class="subtitle">Promote and Retire verdicts require your review.</p>
    </div>
  </div>

  {#if calibration?.warningTriggered}
    <div class="calibration-warning">
      <strong>Calibration Notice:</strong> You have confirmed {calibration.confirmed} of {calibration.total} verdicts ({(calibration.rate * 100).toFixed(0)}%).
      A high confirmation rate may indicate rubber-stamping. Consider reviewing evidence more carefully.
    </div>
  {/if}

  {#if loading}
    <div class="loading">Loading verdicts...</div>
  {:else if error}
    <div class="error-banner">{error}</div>
  {:else if verdicts.length === 0}
    <p class="empty">No pending verdicts. All clear.</p>
  {:else}
    <div class="verdict-grid">
      {#each verdicts as v (v.id)}
        <a href="/verdicts/{v.id}" class="verdict-card">
          <div class="card-header">
            <span class="verdict-type-badge verdict-type-{v.verdictType.toLowerCase()}">{v.verdictType}</span>
            <span class="card-date">{formatDate(v.createdAt)}</span>
          </div>
          <div class="card-meta">
            <span class="meta-item">
              <span class="meta-label">Bot</span>
              <span class="meta-value">{v.botId.slice(0, 8)}</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">Confidence</span>
              <span class="meta-value">{(Number(v.weightedConfidenceScore) * 100).toFixed(0)}%</span>
            </span>
          </div>
          <p class="card-summary">{truncate(v.verdictSummary)}</p>
          {#if v.hasUnresolvedDevilsAdvocate}
            <div class="da-flag">Devil's Advocate — unresolved challenges</div>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    gap: 1rem;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
  }

  .subtitle {
    color: var(--text-secondary, #9ca3af);
    font-size: 0.875rem;
    margin: 0;
  }

  .calibration-warning {
    border: 1px solid #92400e;
    background: #1a1100;
    color: #fbbf24;
    border-radius: 0.5rem;
    padding: 0.875rem 1rem;
    font-size: 0.875rem;
    line-height: 1.5;
    margin-bottom: 1.5rem;
  }

  .loading {
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary, #9ca3af);
  }

  .error-banner {
    padding: 0.875rem 1rem;
    background: #1f0909;
    border: 1px solid #7f1d1d;
    border-radius: 0.5rem;
    color: #fca5a5;
    font-size: 0.875rem;
  }

  .empty {
    color: var(--text-secondary, #9ca3af);
    font-style: italic;
  }

  .verdict-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .verdict-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .verdict-card {
    display: block;
    background: var(--surface, #111827);
    border: 1px solid var(--border, #1f2937);
    border-radius: 0.5rem;
    padding: 1.25rem;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s;
  }

  .verdict-card:hover {
    border-color: #374151;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .verdict-type-badge {
    display: inline-block;
    padding: 0.2rem 0.55rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  .verdict-type-promote {
    color: #4ade80;
    background: #052e16;
    border: 1px solid #166534;
  }

  .verdict-type-retire {
    color: #f87171;
    background: #1f0909;
    border: 1px solid #7f1d1d;
  }

  .card-date {
    font-size: 0.75rem;
    color: var(--text-secondary, #9ca3af);
  }

  .card-meta {
    display: flex;
    gap: 1.25rem;
    margin-bottom: 0.75rem;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .meta-label {
    font-size: 0.65rem;
    color: var(--text-secondary, #9ca3af);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  .meta-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #f9fafb);
    font-variant-numeric: tabular-nums;
  }

  .card-summary {
    font-size: 0.875rem;
    color: var(--text-secondary, #9ca3af);
    line-height: 1.5;
    margin: 0;
  }

  .da-flag {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: #fbbf24;
    font-weight: 600;
  }
</style>
