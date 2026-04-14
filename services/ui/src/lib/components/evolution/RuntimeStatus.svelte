<script lang="ts">
  import { onMount } from 'svelte';

  let { botId }: { botId: string } = $props();

  let runtimeState = $state<{
    sessionId: string | null;
    lastRunStatus: string | null;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedInputTokens: number;
    totalCostCents: number;
    budgetMonthlyCents: number;
    spentMonthlyCents: number;
    budgetUtilization: number | null;
    lastError: string | null;
    updatedAt: string;
  } | null>(null);

  let loading = $state(true);

  function relativeTime(ts: string): string {
    const diffMs = Date.now() - new Date(ts).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  }

  const budgetColor = $derived(
    runtimeState?.budgetUtilization == null ? 'var(--text)' :
    runtimeState.budgetUtilization >= 100 ? 'var(--accent-rose)' :
    runtimeState.budgetUtilization >= 80 ? 'var(--karma)' :
    'var(--text)'
  );

  onMount(() => {
    async function poll() {
      try {
        const res = await fetch(`/api/akasa/evolution/bots/${botId}/runtime`);
        if (res.ok) {
          const data = await res.json();
          runtimeState = data; // null if no data
        }
      } catch { /* silent */ }
      loading = false;
    }
    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  });
</script>

<div class="runtime-status">
  {#if loading}
    <span class="placeholder-text">Loading...</span>
  {:else if runtimeState === null}
    <span class="placeholder-text">No runtime data</span>
  {:else}
    <div class="status-row">
      <div class="status-item">
        <span class="stat-label">STATUS</span>
        <span class="stat-value">{runtimeState.lastRunStatus ?? '—'}</span>
      </div>

      <div class="status-divider"></div>

      <div class="status-item">
        <span class="stat-label">TOKENS</span>
        <span class="stat-value stat-muted">
          IN {runtimeState.totalInputTokens.toLocaleString()} / OUT {runtimeState.totalOutputTokens.toLocaleString()} / CACHED {runtimeState.totalCachedInputTokens.toLocaleString()}
        </span>
      </div>

      <div class="status-divider"></div>

      <div class="status-item">
        <span class="stat-label">COST</span>
        <span class="stat-value stat-amber">${(runtimeState.totalCostCents / 100).toFixed(2)}</span>
      </div>

      {#if runtimeState.budgetUtilization !== null}
        <div class="status-divider"></div>
        <div class="status-item">
          <span class="stat-label">BUDGET</span>
          <span class="stat-value" style="color: {budgetColor}">{runtimeState.budgetUtilization}% used</span>
        </div>
      {/if}

      <div class="status-divider"></div>

      <div class="status-item">
        <span class="stat-label">HEARTBEAT</span>
        <span class="stat-caption">{relativeTime(runtimeState.updatedAt)}</span>
      </div>

      {#if runtimeState.lastError}
        <div class="status-divider"></div>
        <div class="status-item">
          <span class="stat-label error-label">ERROR</span>
          <span class="stat-error">{runtimeState.lastError.slice(0, 60)}{runtimeState.lastError.length > 60 ? '…' : ''}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .runtime-status {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-sm) var(--space-md);
    min-height: 36px;
    display: flex;
    align-items: center;
  }

  .placeholder-text {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
  }

  .status-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-sm);
    width: 100%;
  }

  .status-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
  }

  .stat-value {
    font-family: var(--font-label);
    font-size: 7px;
    color: var(--text);
  }

  .stat-muted {
    color: var(--text-muted);
  }

  .stat-amber {
    color: var(--karma);
  }

  .stat-caption {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }

  .error-label {
    color: var(--accent-rose);
  }

  .stat-error {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--accent-rose);
  }

  .status-divider {
    width: 1px;
    height: 20px;
    background: var(--border);
    flex-shrink: 0;
  }
</style>
