<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { getRingLeaderManifest, confirmExecution, cancelExecution } from '$lib/api';
  import SoulTierBadge from '$lib/components/SoulTierBadge.svelte';
  import type { RingLeaderManifestResponse } from '$lib/types';

  let { data } = $props();
  const executionId = data.executionId;

  let manifest = $state<RingLeaderManifestResponse | null>(null);
  let confirming = $state(false);
  let cancelling = $state(false);
  let error = $state<string | null>(null);

  let assemblyComplete = $derived(
    manifest != null && manifest.manifests != null && manifest.manifests.length > 0
  );
  let assemblyFailed = $derived(manifest?.status === 'failed');

  // Poll for manifest readiness
  $effect(() => {
    if (!browser || assemblyComplete || assemblyFailed) return;
    const poll = () => {
      getRingLeaderManifest(executionId)
        .then(m => { manifest = m; })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  });

  async function handleConfirm() {
    confirming = true;
    error = null;
    try {
      await confirmExecution(executionId);
      goto(`/executions/${executionId}`);
    } catch (e) {
      error = 'Failed to confirm execution. Please try again.';
      confirming = false;
    }
  }

  async function handleCancel() {
    cancelling = true;
    error = null;
    try {
      await cancelExecution(executionId);
      goto('/executions');
    } catch (e) {
      error = 'Failed to cancel execution.';
      cancelling = false;
    }
  }

  function sourceLabel(source: string): string {
    if (source === 'library') return 'library';
    if (source === 'mutated') return 'mutated';
    return 'generated';
  }
</script>

<div class="page">
  <!-- Header -->
  <div class="header">
    <p class="section-label">Pre-Flight Review</p>
    <h1 class="page-title">Population Manifest</h1>
    <p class="exec-id">
      Execution&nbsp;<span class="exec-id-value">{executionId}</span>
    </p>
  </div>

  <!-- Status indicator -->
  <div class="status-bar">
    {#if assemblyFailed}
      <div class="status-chip status-failed">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="6.5" stroke="#f87171" stroke-width="1"/>
          <path d="M4.5 4.5L9.5 9.5M9.5 4.5L4.5 9.5" stroke="#f87171" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Assembly failed
      </div>
    {:else if assemblyComplete}
      <div class="status-chip status-ready">
        <span class="live-dot"></span>
        Manifest ready — review and confirm
      </div>
    {:else}
      <div class="status-chip status-assembling">
        <svg class="spinner" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5.5" stroke="rgba(251,191,36,0.3)" stroke-width="1.5"/>
          <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#fbbf24" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Assembling population manifest...
      </div>
    {/if}
  </div>

  <!-- Assembly failed state -->
  {#if assemblyFailed}
    <div class="error-card">
      <p class="error-card-msg">
        The Ring Leader could not assemble a population manifest for this execution.
        This may be due to insufficient souls in the library or an internal error.
      </p>
      <a href="/new-execution" class="error-link">Start a new execution</a>
    </div>
  {/if}

  <!-- Manifest display -->
  {#if assemblyComplete && manifest}
    <div class="manifest-list">
      {#each manifest.manifests as pop, i}
        <div class="manifest-card">
          <div class="card-header">
            <div class="card-header-left">
              <span class="task-index">Task {i + 1}</span>
              <p class="task-description">{pop.taskDescription}</p>
            </div>
            <div class="card-header-right">
              {#if pop.pioneerFlag}
                <span class="category-badge pioneer-badge">Pioneer</span>
              {/if}
              <span class="soul-count">{pop.assignedSouls.length} soul{pop.assignedSouls.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {#if pop.varianceIntent}
            <p class="variance-note">
              <span class="variance-label">Variance intent:</span>
              {pop.varianceIntent}
            </p>
          {/if}

          <div class="table-wrapper">
            <table class="soul-table">
              <thead>
                <tr>
                  <th>Soul ID</th>
                  <th>Class</th>
                  <th>Source</th>
                  <th>Diff. Score</th>
                  <th>Rationale</th>
                </tr>
              </thead>
              <tbody>
                {#each pop.assignedSouls as soul}
                  <tr>
                    <td class="td-mono td-id">{soul.soulId.slice(0, 8)}&hellip;</td>
                    <td>
                      <SoulTierBadge agentClass={soul.agentClass} />
                    </td>
                    <td>
                      <span class="source-badge source-{soul.source}">{sourceLabel(soul.source)}</span>
                    </td>
                    <td class="td-mono td-score">{soul.differentiationScore.toFixed(2)}</td>
                    <td class="td-rationale">{soul.selectionRationale}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          {#each pop.assignedSouls.filter(s => s.mutationApplied) as soul}
            <p class="mutation-note">
              <span class="mutation-label">Mutation ({soul.soulId.slice(0, 8)}):</span>
              {soul.mutationApplied}
            </p>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Inline error from confirm/cancel -->
  {#if error}
    <div class="inline-error">{error}</div>
  {/if}

  <!-- Spacer so action bar doesn't obscure content -->
  <div class="action-spacer"></div>
</div>

<!-- Sticky action bar -->
<div class="action-bar">
  <div class="action-inner">
    <button
      class="btn-cancel"
      onclick={handleCancel}
      disabled={cancelling || confirming}
    >
      {cancelling ? 'Cancelling...' : 'Cancel'}
    </button>
    <button
      class="btn-confirm"
      onclick={handleConfirm}
      disabled={!assemblyComplete || confirming || cancelling}
    >
      {#if confirming}
        <svg class="spinner" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
          <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Confirming...
      {:else}
        Confirm &amp; Launch
      {/if}
    </button>
  </div>
</div>

<style>
  /* ── Page layout ───────────────────────────────────── */
  .page {
    max-width: 960px;
    margin: 0 auto;
    padding: 40px var(--space-2xl) 160px;
  }

  /* ── Header ────────────────────────────────────────── */
  .header {
    margin-bottom: 32px;
  }

  .section-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--bo-faint);
    margin: 0 0 10px;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text);
    margin: 0 0 8px;
    line-height: 1.1;
  }

  .exec-id {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--bo-faint);
    margin: 0;
  }

  .exec-id-value {
    color: var(--text-muted);
  }

  /* ── Status bar ─────────────────────────────────────── */
  .status-bar {
    margin-bottom: 28px;
  }

  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.04em;
    padding: 8px 16px;
    border-radius: 3px;
  }

  .status-assembling {
    background: rgba(251, 191, 36, 0.08);
    border: 1px solid rgba(251, 191, 36, 0.2);
    color: #fbbf24;
  }

  .status-ready {
    background: rgba(45, 212, 191, 0.08);
    border: 1px solid rgba(45, 212, 191, 0.2);
    color: #2dd4bf;
  }

  .status-failed {
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid rgba(248, 113, 113, 0.2);
    color: #f87171;
  }

  .live-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #2dd4bf;
    flex-shrink: 0;
    animation: pulse-dot 2.5s ease-in-out infinite;
  }

  /* ── Error card (assembly failed) ──────────────────── */
  .error-card {
    background: var(--card);
    border: 1px solid rgba(248, 113, 113, 0.2);
    border-left: 3px solid #f87171;
    border-radius: 6px;
    padding: 24px 28px;
    margin-bottom: 32px;
  }

  .error-card-msg {
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 300;
    margin: 0 0 16px;
    line-height: 1.65;
  }

  .error-link {
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.08em;
    color: var(--accent-m);
    text-decoration: none;
  }

  .error-link:hover {
    color: var(--text);
  }

  /* ── Inline error (confirm/cancel errors) ──────────── */
  .inline-error {
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid rgba(248, 113, 113, 0.2);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    color: #f87171;
    margin-bottom: 16px;
  }

  /* ── Manifest cards ─────────────────────────────────── */
  .manifest-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 16px;
  }

  .manifest-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 24px;
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }

  .card-header-left {
    flex: 1;
    min-width: 0;
  }

  .card-header-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .task-index {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--bo-faint);
    display: block;
    margin-bottom: 6px;
  }

  .task-description {
    font-size: 15px;
    font-weight: 400;
    color: var(--text);
    margin: 0;
    line-height: 1.5;
  }

  .category-badge {
    font-family: var(--font-mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    padding: 3px 10px;
    border-radius: 3px;
    background: var(--accent-dim);
    color: var(--accent-m);
  }

  .pioneer-badge {
    background: rgba(251, 191, 36, 0.1);
    color: #fbbf24;
  }

  .soul-count {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    color: var(--bo-faint);
    white-space: nowrap;
  }

  /* ── Variance note ──────────────────────────────────── */
  .variance-note {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 16px;
    line-height: 1.5;
  }

  .variance-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--bo-faint);
    margin-right: 6px;
  }

  /* ── Soul table ─────────────────────────────────────── */
  .table-wrapper {
    overflow-x: auto;
    border-radius: 8px;
    border: 1px solid var(--border);
    margin-bottom: 0;
  }

  .soul-table {
    width: 100%;
    border-collapse: collapse;
  }

  .soul-table th {
    background: var(--bg3);
    font-family: var(--font-mono);
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--bo-faint);
    padding: 8px 12px;
    text-align: left;
    white-space: nowrap;
  }

  .soul-table td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
    color: var(--text);
    vertical-align: top;
  }

  .soul-table tr:last-child td {
    border-bottom: none;
  }

  .soul-table tbody tr:hover td {
    background: var(--card);
  }

  .td-mono {
    font-family: var(--font-mono);
  }

  .td-id {
    color: var(--text-muted);
    font-size: 12px;
  }

  .td-score {
    color: var(--text-muted);
    font-size: 12px;
  }

  .td-rationale {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 300;
    line-height: 1.55;
    max-width: 320px;
  }

  /* ── Source badges ──────────────────────────────────── */
  .source-badge {
    font-family: var(--font-mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    padding: 3px 8px;
    border-radius: 3px;
    white-space: nowrap;
  }

  .source-library {
    background: rgba(45, 212, 191, 0.10);
    color: #2dd4bf;
  }

  .source-generated {
    background: rgba(148, 110, 255, 0.12);
    color: var(--accent-m);
  }

  .source-mutated {
    background: rgba(251, 191, 36, 0.10);
    color: #fbbf24;
  }

  /* ── Mutation note ──────────────────────────────────── */
  .mutation-note {
    font-size: 12px;
    color: var(--text-muted);
    margin: 12px 0 0;
    line-height: 1.5;
  }

  .mutation-label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--bo-faint);
    margin-right: 6px;
  }

  /* ── Action bar ─────────────────────────────────────── */
  .action-spacer {
    height: 88px;
  }

  .action-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg2);
    border-top: 1px solid var(--border);
    z-index: 10;
    padding: 16px 36px;
  }

  .action-inner {
    max-width: 960px;
    margin: 0 auto;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
  }

  .btn-cancel {
    background: none;
    border: none;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 400;
    cursor: pointer;
    padding: 12px 20px;
    border-radius: 7px;
    transition: color 0.2s;
  }

  .btn-cancel:hover:not(:disabled) {
    color: var(--text);
  }

  .btn-cancel:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-confirm {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 13px 32px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 7px;
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.03em;
    cursor: pointer;
    box-shadow: 0 4px 28px rgba(124, 58, 237, 0.35);
    transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
  }

  .btn-confirm:hover:not(:disabled) {
    opacity: 0.88;
    transform: translateY(-1px);
    box-shadow: 0 6px 36px rgba(124, 58, 237, 0.45);
  }

  .btn-confirm:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  /* ── Spinner ────────────────────────────────────────── */
  .spinner {
    animation: spin 0.65s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* ── Responsive ─────────────────────────────────────── */
  @media (max-width: 600px) {
    .page {
      padding: 32px 20px 160px;
    }

    .action-bar {
      padding: 12px 20px;
    }

    .card-header {
      flex-direction: column;
    }

    .card-header-right {
      flex-wrap: wrap;
    }

    .td-rationale {
      max-width: 180px;
    }
  }
</style>
