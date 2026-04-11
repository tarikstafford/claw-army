<script lang="ts">
  import FleetOverview from '$lib/components/evolution/FleetOverview.svelte';
  import VerdictConfirm from '$lib/components/evolution/VerdictConfirm.svelte';
  import DelegationFlow from '$lib/components/evolution/DelegationFlow.svelte';

  type TabId = 'overview' | 'delegations';

  let { data } = $props();
  let activeTab = $state<TabId>('overview');
  let pendingVerdicts = $state(data.pendingVerdicts ?? []);
  let selectedIds = $state(new Set<string>());
  let batchLoading = $state(false);
  let batchProgress = $state<string | null>(null);
  let calibrationWarning = $state<string | null>(null);

  const allSelected = $derived(
    pendingVerdicts.length > 0 && pendingVerdicts.every((v: any) => selectedIds.has(v.id)),
  );

  async function checkCalibration(): Promise<boolean> {
    try {
      const res = await fetch('/api/verdicts/calibration?userId=user');
      if (res.ok) {
        const cal = await res.json();
        if (cal.warningTriggered) {
          calibrationWarning =
            'Your approval rate is above 95%. Are you sure you want to confirm all selected verdicts?';
          return false;
        }
      }
    } catch {
    }
    calibrationWarning = null;
    return true;
  }

  async function handleBatchAction(action: 'confirm' | 'reject') {
    if (selectedIds.size === 0) return;

    if (action === 'confirm') {
      const safe = await checkCalibration();
      if (!safe && !confirm(calibrationWarning)) return;
    }

    batchLoading = true;
    batchProgress = `Processing ${selectedIds.size} verdict${selectedIds.size > 1 ? 's' : ''}...`;

    try {
      const res = await fetch('/api/akasa/verdicts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verdictIds: Array.from(selectedIds),
          action,
          userId: 'user',
          timeOnScreenMs: 0,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        const confirmedIds = result.processed
          .filter((r: any) => r.success && r.action === 'confirmed')
          .map((r: any) => r.id);
        const rejectedIds = result.processed
          .filter((r: any) => r.success && r.action === 'rejected')
          .map((r: any) => r.id);

        pendingVerdicts = pendingVerdicts.filter(
          (v: any) => !confirmedIds.includes(v.id) && !rejectedIds.includes(v.id),
        );
        selectedIds = new Set();
      }
    } catch {
    } finally {
      batchLoading = false;
      batchProgress = null;
      calibrationWarning = null;
    }
  }

  function handleVerdictAction(action: 'confirmed' | 'rejected', id: string) {
    pendingVerdicts = pendingVerdicts.filter((v: any) => v.id !== id);
    selectedIds.delete(id);
    selectedIds = new Set(selectedIds);
  }

  function toggleSelectAll() {
    if (allSelected) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(pendingVerdicts.map((v: any) => v.id));
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedIds = next;
  }
</script>

<div class="fleet-page">
  {#if data.fleet === null && data.agents.length === 0}
    <p class="error-state">Failed to load fleet data. Refresh to retry.</p>
  {/if}

  <!-- Tab Navigation -->
  <nav class="tab-nav">
    <button
      class="tab-btn"
      class:active={activeTab === 'overview'}
      onclick={() => (activeTab = 'overview')}
    >
      Overview
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === 'delegations'}
      onclick={() => (activeTab = 'delegations')}
    >
      Delegations
      {#if data.delegations?.stats?.totalDelegations > 0}
        <span class="tab-badge">{data.delegations.stats.totalDelegations}</span>
      {/if}
    </button>
  </nav>

  {#if activeTab === 'overview'}
    <!-- Section 1: Class Distribution Grid + Score Trend -->
    <FleetOverview fleet={data.fleet} agents={data.agents} />

    <!-- Section 2: Pending Verdicts -->
    {#if pendingVerdicts.length > 0}
    <section class="pending-section">
      <div class="pending-header">
        <h2 class="section-heading">Awaiting Your Decision</h2>
        <div class="batch-actions">
          <label class="select-all-label">
            <input
              type="checkbox"
              checked={allSelected}
              indeterminate={selectedIds.size > 0 && !allSelected}
              onchange={toggleSelectAll}
            />
            <span>{allSelected ? 'Deselect all' : 'Select all'}</span>
          </label>
          <button
            class="btn-batch-confirm"
            disabled={selectedIds.size === 0 || batchLoading}
            onclick={() => handleBatchAction('confirm')}
          >
            {batchLoading ? 'Processing...' : `Confirm Selected (${selectedIds.size})`}
          </button>
          <button
            class="btn-batch-reject"
            disabled={selectedIds.size === 0 || batchLoading}
            onclick={() => handleBatchAction('reject')}
          >
            Reject Selected ({selectedIds.size})
          </button>
        </div>
      </div>

      {#if batchProgress}
        <div class="batch-progress">{batchProgress}</div>
      {/if}

      <div class="pending-list">
        {#each pendingVerdicts as v (v.id)}
          <VerdictConfirm
            verdict={v}
            onaction={handleVerdictAction}
            selected={selectedIds.has(v.id)}
            onselect={toggleSelect}
          />
        {/each}
      </div>
    </section>
    {/if}
  {:else if activeTab === 'delegations'}
    <DelegationFlow
      chains={data.delegations?.chains ?? []}
      stats={data.delegations?.stats}
    />
  {/if}
</div>

<style>
  .fleet-page {
    padding: var(--space-2xl) var(--space-xl) var(--space-xl);
    max-width: 960px;
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .error-state {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-muted);
    margin: 0;
  }

  .tab-nav {
    display: flex;
    gap: var(--space-xs);
    border-bottom: 1px solid var(--bo-border);
    padding-bottom: 0;
  }

  .tab-btn {
    position: relative;
    background: transparent;
    border: none;
    padding: var(--space-sm) var(--space-lg) var(--space-md);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    color: var(--bo-muted);
    cursor: pointer;
    transition: color 0.15s ease;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .tab-btn::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: transparent;
    transition: background 0.15s ease;
  }

  .tab-btn:hover {
    color: var(--bo-text);
  }

  .tab-btn.active {
    color: var(--bo-text);
  }

  .tab-btn.active::after {
    background: var(--bo-violet);
  }

  .tab-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    background: rgba(124, 58, 237, 0.15);
    color: var(--bo-vb);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
  }

  .pending-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .section-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0;
  }

  .pending-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .pending-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-md);
  }

  .batch-actions {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .select-all-label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-muted);
    cursor: pointer;
  }

  .select-all-label input {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .btn-batch-confirm {
    min-height: 44px;
    padding: 0 var(--space-lg);
    background: var(--bo-card);
    border: 1px solid var(--bo-violet);
    color: var(--bo-violet);
    font-family: var(--font-body);
    font-size: 13px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .btn-batch-confirm:hover:not(:disabled) {
    background: rgba(124, 58, 237, 0.12);
  }

  .btn-batch-confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-batch-reject {
    min-height: 44px;
    padding: 0 var(--space-lg);
    background: var(--bo-card);
    border: 1px solid var(--error);
    color: var(--error);
    font-family: var(--font-body);
    font-size: 13px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-batch-reject:hover:not(:disabled) {
    background: rgba(248, 113, 113, 0.10);
  }

  .btn-batch-reject:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .batch-progress {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-muted);
    padding: var(--space-sm) 0;
  }
</style>
