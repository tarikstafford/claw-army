<script lang="ts">
  import type { BudgetOverview } from '$lib/api';

  let {
    budget,
    visible = true,
  }: {
    budget: BudgetOverview | null;
    visible?: boolean;
  } = $props();

  const THRESHOLDS = [
    { percent: 90, label: '90%', class: 'danger' },
    { percent: 75, label: '75%', class: 'warning' },
    { percent: 50, label: '50%', class: 'caution' },
  ] as const;

  let activeThreshold = $derived.by(() => {
    if (!budget || budget.dailyBudgetCents === 0) return null;
    const pct = (budget.spentTodayCents / budget.dailyBudgetCents) * 100;
    for (const t of THRESHOLDS) {
      if (pct >= t.percent) return t;
    }
    return null;
  });

  let remainingCents = $derived(budget?.remainingTodayCents ?? 0);
  let dailyBudget = $derived(budget?.dailyBudgetCents ?? 0);

  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }
</script>

{#if visible && activeThreshold && budget}
  <div class="alert-banner {activeThreshold.class}" role="alert">
    <span class="alert-icon">
      {#if activeThreshold.class === 'danger'}
        &#9888;
      {:else if activeThreshold.class === 'warning'}
        &#9888;
      {:else}
        &#9432;
      {/if}
    </span>
    <span class="alert-text">
      You've reached {activeThreshold.label} of your daily budget
      ({formatCents(budget.spentTodayCents)} of {formatCents(dailyBudget)}).
      {#if remainingCents > 0}
        {formatCents(remainingCents)} remaining.
      {:else}
        Budget exceeded.
      {/if}
    </span>
  </div>
{/if}

<style>
  .alert-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    margin-bottom: var(--space-md);
  }

  .alert-banner.caution {
    background: rgba(251, 191, 36, 0.12);
    border: 1px solid rgba(251, 191, 36, 0.35);
  }

  .alert-banner.warning {
    background: rgba(251, 146, 60, 0.12);
    border: 1px solid rgba(251, 146, 60, 0.35);
  }

  .alert-banner.danger {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.35);
  }

  :global(body.back-office) .alert-banner.caution {
    background: rgba(251, 191, 36, 0.15);
    border-color: rgba(251, 191, 36, 0.40);
  }

  :global(body.back-office) .alert-banner.warning {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.40);
  }

  :global(body.back-office) .alert-banner.danger {
    background: rgba(220, 38, 38, 0.20);
    border-color: rgba(220, 38, 38, 0.45);
  }

  .alert-icon {
    font-size: 14px;
    flex-shrink: 0;
    line-height: 1.4;
  }

  .caution .alert-icon {
    color: var(--fo-gold, #B8860B);
  }

  .warning .alert-icon {
    color: var(--fo-orange, #F97316);
  }

  .danger .alert-icon {
    color: var(--fo-rose, #E53535);
  }

  :global(body.back-office) .caution .alert-icon {
    color: var(--bo-amber);
  }

  :global(body.back-office) .warning .alert-icon {
    color: #FB923C;
  }

  :global(body.back-office) .danger .alert-icon {
    color: #EF4444;
  }

  .alert-text {
    font-family: var(--font-body);
    font-size: 13px;
    line-height: 1.5;
    color: var(--text);
  }

  :global(body.back-office) .alert-text {
    color: var(--bo-text);
  }

  .caution .alert-text {
    color: var(--text);
  }

  .warning .alert-text {
    color: var(--text);
  }

  .danger .alert-text {
    color: var(--text);
  }
</style>
