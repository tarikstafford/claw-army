<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import Accordion from '$lib/components/Accordion.svelte';
  import type { PendingVerdict } from '$lib/types.js';

  const VERDICT_COLORS: Record<string, string> = {
    Promote: 'var(--accent)',
    Maintain: 'var(--text-muted)',
    Monitor: 'var(--accent-teal)',
    Demote: 'var(--accent-rose)',
    Retire: 'var(--error)',
  };

  const CLASS_COLORS: Record<string, string> = {
    Artisan: 'var(--karma)',
    Understudy: 'var(--accent-m)',
    Novice: 'var(--text-muted)',
    Retired: 'var(--muted)',
  };

  let {
    verdict,
    onaction,
    selected = false,
    onselect,
  }: {
    verdict: PendingVerdict;
    onaction: (action: 'confirmed' | 'rejected', id: string) => void;
    selected?: boolean;
    onselect?: (id: string) => void;
  } = $props();

  let loading = $state(false);
  let error = $state<string | null>(null);
  let rejectModalOpen = $state(false);
  let fading = $state(false);

  const verdictColor = $derived(VERDICT_COLORS[verdict.verdictType] ?? 'var(--text-muted)');
  const confidenceDisplay = $derived(
    verdict.weightedConfidenceScore
      ? `${(parseFloat(verdict.weightedConfidenceScore) * 100).toFixed(0)}% confidence`
      : null
  );

  async function handleApprove() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`/api/akasa/verdicts/${verdict.id}/confirm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedBy: 'user' }),
      });
      if (!res.ok) throw new Error('Request failed');
      fading = true;
      setTimeout(() => onaction('confirmed', verdict.id), 200);
    } catch {
      error = 'Failed to approve verdict. Please try again.';
      loading = false;
    }
  }

  async function handleRejectConfirm() {
    loading = true;
    error = null;
    rejectModalOpen = false;
    try {
      const res = await fetch(`/api/akasa/verdicts/${verdict.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedBy: 'user' }),
      });
      if (!res.ok) throw new Error('Request failed');
      fading = true;
      setTimeout(() => onaction('rejected', verdict.id), 200);
    } catch {
      error = 'Failed to reject verdict. Please try again.';
      loading = false;
    }
  }
</script>

<div class="verdict-row" class:fading class:selected>
  <div class="verdict-main">
    {#if onselect}
      <input
        type="checkbox"
        class="verdict-checkbox"
        checked={selected}
        onchange={() => onselect?.(verdict.id)}
      />
    {/if}
    <div class="verdict-left">
      <div class="verdict-meta">
        <span class="bot-id">{verdict.botId.slice(0, 8)}</span>
        <span
          class="verdict-type-badge"
          style="color: {verdictColor}; border-color: {verdictColor};"
        >{verdict.verdictType.toUpperCase()}</span>
        {#if confidenceDisplay}
          <span class="confidence">{confidenceDisplay}</span>
        {/if}
      </div>
      {#if verdict.verdictSummary}
        <p class="verdict-summary">{verdict.verdictSummary}</p>
      {/if}
    </div>

    <div class="verdict-actions">
      <button
        class="btn-approve"
        disabled={loading}
        onclick={handleApprove}
        aria-label={`Approve verdict for bot ${verdict.botId.slice(0, 8)}`}
      >
        {loading ? '...' : 'Approve'}
      </button>
      <button
        class="btn-reject"
        disabled={loading}
        onclick={() => (rejectModalOpen = true)}
        aria-label={`Reject verdict for bot ${verdict.botId.slice(0, 8)}`}
      >
        Reject
      </button>
    </div>
  </div>

  {#if verdict.performanceJudgeOutput || verdict.soulAnalystOutput || verdict.devilsAdvocateOutput}
    <div class="evidence-section">
      {#if verdict.performanceJudgeOutput}
        <Accordion
          label="PERFORMANCE JUDGE"
          color="var(--accent)"
        >
          <pre class="evidence-json">{JSON.stringify(verdict.performanceJudgeOutput, null, 2)}</pre>
        </Accordion>
      {/if}
      {#if verdict.soulAnalystOutput}
        <Accordion
          label="SOUL ANALYST"
          color="var(--accent-teal)"
        >
          <pre class="evidence-json">{JSON.stringify(verdict.soulAnalystOutput, null, 2)}</pre>
        </Accordion>
      {/if}
      {#if verdict.devilsAdvocateOutput}
        <Accordion
          label="DEVIL'S ADVOCATE"
          color="var(--accent-rose)"
        >
          <pre class="evidence-json">{JSON.stringify(verdict.devilsAdvocateOutput, null, 2)}</pre>
        </Accordion>
      {/if}
    </div>
  {/if}

  {#if error}
    <p class="error-msg">{error}</p>
  {/if}
</div>

<Modal
  open={rejectModalOpen}
  title="Reject this verdict?"
  onclose={() => (rejectModalOpen = false)}
>
  <p class="modal-body-text">
    Rejecting a Promote verdict will prevent this agent from advancing.
    Rejecting a Retire verdict will keep the agent in its current class.
  </p>
  <div class="modal-footer">
    <button class="btn-modal-cancel" onclick={() => (rejectModalOpen = false)}>Cancel</button>
    <button class="btn-modal-reject" onclick={handleRejectConfirm}>Reject Verdict</button>
  </div>
</Modal>

<style>
  @keyframes fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  .verdict-row {
    background: var(--card);
    border: 1px solid var(--accent-m);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    transition: opacity 0.2s ease;
  }

  .verdict-row.fading {
    animation: fade-out 0.2s ease forwards;
  }

  .verdict-row.selected {
    border-color: var(--accent);
    background: rgba(124, 58, 237, 0.04);
  }

  .verdict-checkbox {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    cursor: pointer;
    accent-color: var(--accent);
    margin-top: 2px;
  }

  .verdict-main {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .verdict-left {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    flex: 1;
  }

  .verdict-meta {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .bot-id {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
  }

  .verdict-type-badge {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    border: 1px solid;
    padding: 3px 7px;
    border-radius: 3px;
  }

  .confidence {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }

  .verdict-summary {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .verdict-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-shrink: 0;
  }

  .btn-approve {
    min-height: 44px;
    padding: 0 var(--space-lg);
    background: var(--card);
    border: 1px solid var(--accent);
    color: var(--accent);
    font-family: var(--font-body);
    font-size: 13px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .btn-approve:hover:not(:disabled) {
    background: rgba(124, 58, 237, 0.12);
  }

  .btn-approve:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-reject {
    min-height: 44px;
    padding: 0 var(--space-lg);
    background: var(--card);
    border: 1px solid var(--error);
    color: var(--error);
    font-family: var(--font-body);
    font-size: 13px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-reject:hover:not(:disabled) {
    background: rgba(248, 113, 113, 0.10);
  }

  .btn-reject:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .evidence-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .evidence-json {
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    color: var(--text-muted);
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
    line-height: 1.5;
  }

  .error-msg {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--error);
    margin: 0;
  }

  /* Modal content */
  .modal-body-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 var(--space-lg);
    line-height: 1.6;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
  }

  .btn-modal-cancel {
    min-height: 44px;
    padding: 0 var(--space-lg);
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 13px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: border-color 0.15s ease;
  }

  .btn-modal-cancel:hover {
    border-color: var(--text-muted);
  }

  .btn-modal-reject {
    min-height: 44px;
    padding: 0 var(--space-lg);
    background: transparent;
    border: 1px solid var(--error);
    color: var(--error);
    font-family: var(--font-body);
    font-size: 13px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-modal-reject:hover {
    background: rgba(248, 113, 113, 0.10);
  }
</style>
