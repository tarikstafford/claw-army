<script lang="ts">
  import { browser } from '$app/environment';
  import { getPendingVerdicts, getCalibration } from '$lib/api';
  import type { PendingVerdict, CalibrationData } from '$lib/types';

  let { data } = $props();

  let verdicts = $state<PendingVerdict[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let calibration = $state<CalibrationData | null>(null);
  let previousCount = $state<number | null>(null);
  let showNewVerdictsBanner = $state(false);

  let userId = $derived(data.session?.user?.email ?? 'operator');

  async function loadData() {
    try {
      [verdicts, calibration] = await Promise.all([
        getPendingVerdicts(),
        getCalibration(userId),
      ]);
      // Detect new verdicts
      if (previousCount !== null && verdicts.length > previousCount) {
        showNewVerdictsBanner = true;
        setTimeout(() => { showNewVerdictsBanner = false; }, 5000);
      }
      previousCount = verdicts.length;
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
  <title>Verdicts | Akasa</title>
</svelte:head>

<div class="page">
  <div class="page-header">
    <div>
      <div class="sec-label">Governance</div>
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

  {#if showNewVerdictsBanner}
    <div class="new-verdicts-banner">
      New verdicts have arrived. Review them below.
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
    padding: 40px 36px 80px;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 2rem;
    gap: 1rem;
  }

  h1 {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 600;
    letter-spacing: -0.025em;
    margin: 0 0 0.5rem;
    color: var(--text);
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 1rem;
    margin: 0;
    line-height: 1.6;
  }

  .calibration-warning {
    border: 1px solid rgba(251,191,36,0.3);
    background: rgba(251, 191, 36, 0.10);
    color: var(--karma);
    border-radius: 0.5rem;
    padding: 0.875rem 1rem;
    font-size: 0.875rem;
    line-height: 1.5;
    margin-bottom: 1.5rem;
  }

  .loading {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }

  .error-banner {
    padding: 0.875rem 1rem;
    background: var(--error-dim);
    border: 1px solid rgba(248,113,113,0.25);
    border-radius: 0.5rem;
    color: var(--error);
    font-size: 0.875rem;
  }

  .empty {
    color: var(--text-muted);
    font-style: italic;
  }

  .verdict-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (max-width: 960px) {
    .page { padding: 32px 20px 60px; }
  }

  @media (min-width: 768px) {
    .verdict-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .verdict-card {
    display: block;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 1.25rem;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.3s, transform 0.35s, box-shadow 0.35s;
  }

  .verdict-card:hover {
    border-color: var(--border);
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
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
    font-family: var(--font-mono);
  }

  /* Promote → teal (confirmed, progressing soul) */
  .verdict-type-promote {
    color: var(--bo-teal);
    background: rgba(45, 212, 191, 0.10);
    border: 1px solid rgba(45,212,191,0.2);
  }

  /* Retire → rose (soul lifecycle end) */
  .verdict-type-retire {
    color: var(--bo-rose);
    background: rgba(244, 114, 182, 0.08);
    border: 1px solid rgba(244,114,182,0.15);
  }

  /* Demote → amber (soul soul-mechanic intervention) */
  .verdict-type-demote {
    color: var(--karma);
    background: rgba(251, 191, 36, 0.10);
    border: 1px solid rgba(251,191,36,0.2);
  }

  /* Monitor / Maintain → violet-dim treatment */
  .verdict-type-monitor,
  .verdict-type-maintain {
    color: var(--accent-m);
    background: var(--accent-dim);
    border: 1px solid rgba(167,139,250,0.2);
  }

  .card-date {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
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
    color: var(--bo-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
    font-family: var(--font-mono);
  }

  .meta-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    font-family: var(--font-mono);
  }

  .card-summary {
    font-size: 0.875rem;
    color: var(--text-muted);
    line-height: 1.5;
    margin: 0;
  }

  .da-flag {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: var(--karma);
    font-weight: 600;
    font-family: var(--font-mono);
  }

  .new-verdicts-banner {
    border: 1px solid rgba(45,212,191,0.3);
    background: rgba(45, 212, 191, 0.10);
    color: var(--bo-teal);
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 1rem;
    animation: fadeIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
