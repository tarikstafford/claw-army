<script lang="ts">
  let {
    dailyBudgetCents = 0,
    spentTodayCents = 0,
    monthlyBudgetCents = 0,
    monthlySpentCents = 0,
  }: {
    dailyBudgetCents?: number;
    spentTodayCents?: number;
    monthlyBudgetCents?: number;
    monthlySpentCents?: number;
  } = $props();

  type AlertLevel = 'none' | 'warning' | 'danger' | 'critical';

  const dailyPct = $derived(
    dailyBudgetCents > 0 ? Math.round((spentTodayCents / dailyBudgetCents) * 100) : 0
  );

  const monthlyPct = $derived(
    monthlyBudgetCents > 0 ? Math.round((monthlySpentCents / monthlyBudgetCents) * 100) : 0
  );

  const dailyAlert = $derived(computeAlert(dailyPct));
  const monthlyAlert = $derived(computeAlert(monthlyPct));

  const activeAlert = $derived(
    dailyAlert.level === 'critical' || monthlyAlert.level === 'critical'
      ? 'critical'
      : dailyAlert.level === 'danger' || monthlyAlert.level === 'danger'
        ? 'danger'
        : dailyAlert.level === 'warning' || monthlyAlert.level === 'warning'
          ? 'warning'
          : 'none'
  );

  function computeAlert(pct: number): { level: AlertLevel; pct: number } {
    if (pct >= 90) return { level: 'critical', pct };
    if (pct >= 75) return { level: 'danger', pct };
    if (pct >= 50) return { level: 'warning', pct };
    return { level: 'none', pct };
  }

  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }
</script>

{#if activeAlert !== 'none'}
  <div
    class="alert-banner"
    class:alert-warning={activeAlert === 'warning'}
    class:alert-danger={activeAlert === 'danger'}
    class:alert-critical={activeAlert === 'critical'}
    role="alert"
  >
    <span class="alert-icon">
      {#if activeAlert === 'critical'}🚨{:else if activeAlert === 'danger'}⚠️{:else}💰{/if}
    </span>
    <span class="alert-text">
      {#if activeAlert === 'critical'}
        Budget exceeded! Daily spend {formatCents(spentTodayCents)} has reached {dailyPct}% of your {formatCents(dailyBudgetCents)} daily cap.
      {:else if activeAlert === 'danger'}
        Approaching budget limit: {dailyPct}% of daily budget used ({formatCents(spentTodayCents)} / {formatCents(dailyBudgetCents)}).
      {:else}
        Heads up: You've used {dailyPct}% of your daily budget ({formatCents(spentTodayCents)} / {formatCents(dailyBudgetCents)}).
      {/if}
    </span>
  </div>
{/if}

<style>
  .alert-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    margin-bottom: var(--space-md);
  }

  .alert-warning {
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid var(--fo-amber, #F59E0B);
  }

  .alert-danger {
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid var(--fo-rose, #F43F5E);
  }

  .alert-critical {
    background: rgba(220, 38, 38, 0.15);
    border: 1px solid #dc2626;
  }

  :global(body.back-office) .alert-warning {
    background: rgba(245, 158, 11, 0.08);
    border-color: var(--bo-amber, #F59E0B);
  }

  :global(body.back-office) .alert-danger {
    background: rgba(244, 63, 94, 0.08);
    border-color: var(--bo-rose, #F43F5E);
  }

  :global(body.back-office) .alert-critical {
    background: rgba(220, 38, 38, 0.08);
    border-color: #dc2626;
  }

  .alert-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .alert-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    line-height: 1.4;
  }
</style>
