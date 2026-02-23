<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getVerdict, confirmVerdict, rejectVerdict } from '$lib/api';
  import type { VerdictDetail } from '$lib/types';

  let { data } = $props();

  let verdict = $state<VerdictDetail | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let arrivedAt = $state(0);
  let submitting = $state(false);
  let evidenceLoaded = $state(false);

  let verdictId = $derived((page.params as Record<string, string>)['verdictId'] ?? '');
  let userId = $derived(data.session?.user?.email ?? 'operator');

  $effect(() => {
    if (!browser) return;
    arrivedAt = Date.now();
    getVerdict(verdictId)
      .then((v) => {
        verdict = v;
        evidenceLoaded = true;
      })
      .catch((err) => {
        error = (err as Error).message;
      })
      .finally(() => {
        loading = false;
      });
  });

  async function doConfirm() {
    if (submitting) return;
    submitting = true;
    try {
      const timeOnScreenMs = Date.now() - arrivedAt;
      await confirmVerdict(verdictId, { userId, timeOnScreenMs });
      goto('/verdicts');
    } catch (err) {
      error = (err as Error).message;
    } finally {
      submitting = false;
    }
  }

  async function doReject() {
    if (submitting) return;
    submitting = true;
    try {
      const timeOnScreenMs = Date.now() - arrivedAt;
      await rejectVerdict(verdictId, { userId, timeOnScreenMs });
      goto('/verdicts');
    } catch (err) {
      error = (err as Error).message;
    } finally {
      submitting = false;
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
</script>

<svelte:head>
  <title>Verdict | Akasa</title>
</svelte:head>

<div class="page">
  <div class="back-link-wrap">
    <a href="/verdicts" class="back-link">← Back to Verdicts</a>
  </div>

  {#if loading}
    <div class="loading">Loading verdict...</div>
  {:else if error}
    <div class="error-banner">{error}</div>
  {:else if verdict}
    <div class="verdict-detail">

      <!-- Verdict header -->
      <div class="verdict-header">
        <div class="header-left">
          <span class="verdict-type-badge verdict-type-{verdict.verdictType.toLowerCase()}">{verdict.verdictType}</span>
          {#if verdict.status !== 'pending'}
            <span class="status-notice status-{verdict.status}">{verdict.status}</span>
          {/if}
        </div>
        <div class="header-meta">
          <span class="meta-pair"><span class="meta-label">Bot</span> <span class="meta-value">{verdict.botId.slice(0, 8)}</span></span>
          <span class="meta-pair"><span class="meta-label">Execution</span> <span class="meta-value">{verdict.executionId.slice(0, 8)}</span></span>
          <span class="meta-pair"><span class="meta-label">Confidence</span> <span class="meta-value">{(Number(verdict.weightedConfidenceScore) * 100).toFixed(0)}%</span></span>
          <span class="meta-pair"><span class="meta-label">Created</span> <span class="meta-value">{formatDate(verdict.createdAt)}</span></span>
        </div>
      </div>

      <!-- Verdict summary -->
      <div class="summary-section">
        <h2>Verdict Summary</h2>
        <p class="summary-text">{verdict.verdictSummary}</p>
      </div>

      <!-- Evidence section — MUST render before action buttons (CONF-02) -->
      <div class="evidence-section">
        {#if verdict.hasUnresolvedDevilsAdvocate && verdict.devilsAdvocateOutput}
          <h2>Devil's Advocate Challenges</h2>
          <p class="evidence-note">This verdict has unresolved challenges. Review each carefully before deciding.</p>
          {#each verdict.devilsAdvocateOutput.challenges as challenge}
            <div class="challenge-card">
              <div class="challenge-header">
                <span class="severity-badge severity-{challenge.severity}">{challenge.severity}</span>
              </div>
              <p class="challenge-claim">{challenge.claim}</p>
              <p class="challenge-counter">{challenge.counterArgument}</p>
            </div>
          {/each}
        {:else if verdict.performanceJudgeOutput}
          <h2>Performance Evidence</h2>
          <p class="evidence-text">{verdict.performanceJudgeOutput.summary}</p>
          {#if verdict.performanceJudgeOutput.metrics && Object.keys(verdict.performanceJudgeOutput.metrics).length > 0}
            <div class="metrics-grid">
              {#each Object.entries(verdict.performanceJudgeOutput.metrics) as [key, val]}
                <div class="metric-item">
                  <span class="metric-key">{key}</span>
                  <span class="metric-val">{String(val)}</span>
                </div>
              {/each}
            </div>
          {/if}
        {/if}

        {#if verdict.soulAnalystOutput}
          <div class="soul-section">
            <h2>Soul Analysis</h2>
            <p class="evidence-text">{verdict.soulAnalystOutput.summary}</p>
          </div>
        {/if}
      </div>

      <!-- Action buttons — only rendered AFTER evidence is loaded (CONF-02) -->
      {#if evidenceLoaded && verdict.status === 'pending'}
        <div class="verdict-actions">
          <button
            class="action-btn reject-btn"
            disabled={submitting}
            onclick={doReject}
          >
            Reject — Your feedback teaches the soul
          </button>
          <button
            class="action-btn confirm-btn"
            disabled={submitting}
            onclick={doConfirm}
          >
            Confirm Verdict
          </button>
        </div>
      {:else if verdict.status !== 'pending'}
        <div class="already-resolved">
          This verdict has already been {verdict.status}.
        </div>
      {/if}

    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 800px;
    margin: 0 auto;
  }

  .back-link-wrap {
    margin-bottom: 1.5rem;
  }

  .back-link {
    font-size: 0.875rem;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.15s;
  }

  .back-link:hover {
    color: var(--text);
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

  .verdict-detail {
    max-width: 720px;
    margin: 0 auto;
  }

  /* Header */
  .verdict-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
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

  /* Promote → teal (soul lifecycle progression) */
  .verdict-type-promote {
    color: var(--teal);
    background: var(--teal-dim);
    border: 1px solid rgba(45,212,191,0.2);
  }

  /* Retire → rose (soul lifecycle end) */
  .verdict-type-retire {
    color: var(--rose);
    background: var(--rose-dim);
    border: 1px solid rgba(244,114,182,0.15);
  }

  /* Demote → amber (soul-mechanic intervention) */
  .verdict-type-demote {
    color: var(--amber);
    background: var(--amber-dim);
    border: 1px solid rgba(251,191,36,0.2);
  }

  /* Monitor / Maintain → violet-dim */
  .verdict-type-monitor,
  .verdict-type-maintain {
    color: var(--violet-bright);
    background: var(--violet-dim);
    border: 1px solid rgba(167,139,250,0.2);
  }

  .status-notice {
    display: inline-block;
    padding: 0.2rem 0.55rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.025em;
    text-transform: uppercase;
    font-family: var(--font-mono);
  }

  .status-confirmed {
    color: var(--teal);
    background: var(--teal-dim);
    border: 1px solid rgba(45,212,191,0.2);
  }

  .status-rejected {
    color: var(--amber);
    background: var(--amber-dim);
    border: 1px solid rgba(251,191,36,0.2);
  }

  .header-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .meta-pair {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .meta-label {
    font-size: 0.65rem;
    color: var(--text-faint);
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

  /* Summary */
  .summary-section {
    margin-bottom: 2rem;
  }

  .summary-section h2 {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0 0 0.75rem;
    font-family: var(--font-mono);
  }

  .summary-text {
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--text);
    margin: 0;
  }

  /* Evidence */
  .evidence-section {
    margin-top: 2rem;
    border-top: 1px solid var(--border);
    padding-top: 1.5rem;
  }

  .evidence-section h2 {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0 0 0.75rem;
    font-family: var(--font-mono);
  }

  .evidence-note {
    font-size: 0.875rem;
    color: var(--amber);
    margin: 0 0 1rem;
  }

  .evidence-text {
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--text);
    margin: 0 0 1rem;
  }

  /* Challenge cards */
  .challenge-card {
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 0.75rem;
  }

  .challenge-header {
    margin-bottom: 0.5rem;
  }

  .severity-badge {
    display: inline-block;
    padding: 0.15rem 0.45rem;
    border-radius: 9999px;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.025em;
    text-transform: uppercase;
    font-family: var(--font-mono);
  }

  /* Strong challenge → rose (high severity) */
  .severity-strong {
    color: var(--rose);
    background: var(--rose-dim);
    border: 1px solid rgba(244,114,182,0.15);
  }

  /* Moderate challenge → amber */
  .severity-moderate {
    color: var(--amber);
    background: var(--amber-dim);
    border: 1px solid rgba(251,191,36,0.2);
  }

  /* Weak challenge → muted */
  .severity-weak {
    color: var(--text-muted);
    background: rgba(236,232,255,0.05);
    border: 1px solid var(--border);
  }

  .challenge-claim {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 0.5rem;
    line-height: 1.5;
  }

  .challenge-counter {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* Metrics */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .metric-item {
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    padding: 0.625rem 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .metric-key {
    font-size: 0.65rem;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
    font-family: var(--font-mono);
  }

  .metric-val {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    font-family: var(--font-mono);
  }

  /* Soul section */
  .soul-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border);
  }

  .soul-section h2 {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0 0 0.75rem;
    font-family: var(--font-mono);
  }

  /* Action buttons (CONF-03 — equal visual weight) */
  .verdict-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border);
  }

  .action-btn {
    flex: 1;
    padding: 0.625rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 0.375rem;
    cursor: pointer;
    border: 1px solid;
    transition: background 0.15s;
    min-width: 200px;
  }

  /* Reject → amber treatment (soul-mechanic correction, not an error) */
  .reject-btn {
    background: var(--amber-dim);
    border-color: rgba(251,191,36,0.3);
    color: var(--amber);
  }

  .reject-btn:hover:not(:disabled) {
    background: rgba(251,191,36,0.2);
  }

  /* Confirm → violet (primary action) */
  .confirm-btn {
    background: var(--violet);
    border-color: var(--violet);
    color: white;
  }

  .confirm-btn:hover:not(:disabled) {
    background: var(--violet-bright);
    border-color: var(--violet-bright);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Already resolved notice */
  .already-resolved {
    margin-top: 2rem;
    padding: 0.875rem 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-muted);
    font-style: italic;
  }
</style>
