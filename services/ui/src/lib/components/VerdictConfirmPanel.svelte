<script lang="ts">
  import { confirmVerdict, rejectVerdict } from '$lib/api';
  import type { VerdictDetail } from '$lib/types';

  let {
    verdict,
    userId,
    onResolved,
    onClose,
  }: {
    verdict: VerdictDetail;
    userId: string;
    onResolved: () => void;
    onClose: () => void;
  } = $props();

  let submitting = $state(false);
  let error = $state<string | null>(null);
  let arrivedAt = $state(Date.now());

  async function doConfirm() {
    if (submitting) return;
    submitting = true;
    try {
      const timeOnScreenMs = Date.now() - arrivedAt;
      await confirmVerdict(verdict.id, { userId, timeOnScreenMs });
      onResolved();
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
      await rejectVerdict(verdict.id, { userId, timeOnScreenMs });
      onResolved();
    } catch (err) {
      error = (err as Error).message;
    } finally {
      submitting = false;
    }
  }

  function verdictTypeBadgeStyle(type: string): string {
    switch (type) {
      case 'Promote': return 'background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;';
      case 'Retire': return 'background:#fef2f2;color:#dc2626;border:1px solid #fecaca;';
      default: return 'background:#f3f4f6;color:#6b7280;border:1px solid #e5e7eb;';
    }
  }
</script>

<!-- Backdrop -->
<div
  class="backdrop"
  onclick={onClose}
  role="presentation"
></div>

<!-- Panel -->
<aside class="panel">
  <!-- Header -->
  <div class="panel-header">
    <h2 class="panel-title">Verdict Review</h2>
    <button class="close-btn" onclick={onClose} aria-label="Close verdict panel">
      ✕
    </button>
  </div>

  <!-- Body -->
  <div class="panel-body">
    <!-- Verdict type badge + confidence -->
    <div class="verdict-row">
      <span class="verdict-type-badge" style={verdictTypeBadgeStyle(verdict.verdictType)}>
        {verdict.verdictType}
      </span>
      <span class="confidence-score">
        {(Number(verdict.weightedConfidenceScore) * 100).toFixed(0)}% confidence
      </span>
    </div>

    <!-- Verdict summary -->
    <p class="verdict-summary">{verdict.verdictSummary}</p>

    <!-- Evidence section -->
    <div class="evidence-section">
      {#if verdict.hasUnresolvedDevilsAdvocate && verdict.devilsAdvocateOutput}
        <h3 class="evidence-heading">Devil's Advocate Challenges</h3>
        <p class="evidence-note">This verdict has unresolved challenges. Review carefully before deciding.</p>
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
        <h3 class="evidence-heading">Performance Evidence</h3>
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
          <h3 class="evidence-heading">Soul Analysis</h3>
          <p class="evidence-text">{verdict.soulAnalystOutput.summary}</p>
        </div>
      {/if}
    </div>

    <!-- Error display -->
    {#if error}
      <div class="error-banner">{error}</div>
    {/if}

    <!-- Action buttons — only when pending (CONF-02) -->
    {#if verdict.status === 'pending'}
      <div class="verdict-actions">
        <button
          class="action-btn reject-btn"
          disabled={submitting}
          onclick={doReject}
        >
          Reject — Your feedback teaches the army
        </button>
        <button
          class="action-btn confirm-btn"
          disabled={submitting}
          onclick={doConfirm}
        >
          Confirm Verdict
        </button>
      </div>
    {:else}
      <div class="already-resolved">
        This verdict has already been {verdict.status}.
      </div>
    {/if}
  </div>
</aside>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 100;
  }

  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 520px;
    background: #fff;
    color: #111827;
    z-index: 101;
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
    animation: slideIn 0.25s ease-out;
    outline: none;
  }

  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  .panel-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #111827;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    line-height: 1;
    transition: background 0.1s;
  }

  .close-btn:hover {
    background: #f3f4f6;
    color: #111827;
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
  }

  /* Verdict type badge + confidence */
  .verdict-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .verdict-type-badge {
    display: inline-block;
    padding: 0.2rem 0.65rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .confidence-score {
    font-size: 0.85rem;
    font-weight: 600;
    color: #374151;
  }

  /* Summary */
  .verdict-summary {
    font-size: 0.9375rem;
    line-height: 1.6;
    color: #4b5563;
    margin: 0 0 1.5rem;
  }

  /* Evidence */
  .evidence-section {
    border-top: 1px solid #e5e7eb;
    padding-top: 1.25rem;
    margin-bottom: 1.25rem;
  }

  .evidence-heading {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6b7280;
    margin: 0 0 0.75rem;
  }

  .evidence-note {
    font-size: 0.875rem;
    color: #d97706;
    margin: 0 0 1rem;
  }

  .evidence-text {
    font-size: 0.9rem;
    line-height: 1.6;
    color: #4b5563;
    margin: 0 0 1rem;
  }

  /* Challenge cards — light mode */
  .challenge-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
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
  }

  .severity-strong {
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
  }

  .severity-moderate {
    color: #d97706;
    background: #fffbeb;
    border: 1px solid #fde68a;
  }

  .severity-weak {
    color: #6b7280;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
  }

  .challenge-claim {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.5rem;
    line-height: 1.5;
  }

  .challenge-counter {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
    line-height: 1.5;
  }

  /* Metrics grid */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .metric-item {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    padding: 0.625rem 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .metric-key {
    font-size: 0.65rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  .metric-val {
    font-size: 0.875rem;
    font-weight: 700;
    color: #111827;
    font-variant-numeric: tabular-nums;
  }

  /* Soul section */
  .soul-section {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid #e5e7eb;
  }

  /* Error */
  .error-banner {
    padding: 0.75rem 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.5rem;
    color: #dc2626;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  /* Action buttons (CONF-03 — equal visual weight) */
  .verdict-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid #e5e7eb;
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
  }

  .reject-btn {
    background: #92400e;
    border-color: #92400e;
    color: #fef3c7;
  }

  .reject-btn:hover:not(:disabled) {
    background: #a14b0f;
  }

  .confirm-btn {
    background: #6366f1;
    border-color: #6366f1;
    color: #fff;
  }

  .confirm-btn:hover:not(:disabled) {
    background: #5457d4;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Already resolved */
  .already-resolved {
    margin-top: 1.5rem;
    padding: 0.875rem 1rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: #6b7280;
    font-style: italic;
  }
</style>
