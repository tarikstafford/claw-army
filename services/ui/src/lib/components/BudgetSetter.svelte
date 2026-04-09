<script lang="ts">
  import type { BudgetOverview, BudgetUpdateInput } from '$lib/api';
  import { updateBudget } from '$lib/api';

  let {
    budget,
    companyId,
    onUpdate,
  }: {
    budget: BudgetOverview;
    companyId: string;
    onUpdate?: (updated: BudgetOverview) => void;
  } = $props();

  const PRESETS = [
    { label: '$10/day', dailyCents: 1000 },
    { label: '$50/day', dailyCents: 5000 },
    { label: '$100/day', dailyCents: 10000 },
  ];

  let dailyBudgetCents = $state(budget.dailyBudgetCents);
  let monthlyBudgetCents = $state(budget.monthlyTotalCents > 0 ? budget.monthlyTotalCents : 50000);
  let isUpdating = $state(false);
  let showCustom = $state(false);
  let customDaily = $state(5000);
  let customMonthly = $state(50000);

  let dailySpent = $derived(budget.spentTodayCents);
  let dailyPct = $derived(
    budget.dailyBudgetCents > 0
      ? Math.min((dailySpent / budget.dailyBudgetCents) * 100, 100)
      : 0
  );
  let monthlyPct = $derived(
    monthlyBudgetCents > 0
      ? Math.min((budget.monthlyTotalCents / monthlyBudgetCents) * 100, 100)
      : 0
  );

  function selectPreset(cents: number) {
    dailyBudgetCents = cents;
    showCustom = false;
  }

  function enableCustom() {
    showCustom = true;
    dailyBudgetCents = customDaily;
    monthlyBudgetCents = customMonthly;
  }

  async function saveBudget() {
    if (isUpdating) return;
    isUpdating = true;
    try {
      const input: BudgetUpdateInput = {
        dailyBudgetCents: showCustom ? customDaily : dailyBudgetCents,
        monthlyBudgetCents: showCustom ? customMonthly : monthlyBudgetCents,
      };
      const updated = await updateBudget(companyId, input);
      dailyBudgetCents = updated.dailyBudgetCents;
      monthlyBudgetCents = updated.monthlyTotalCents;
      if (!showCustom) {
        customDaily = updated.dailyBudgetCents;
        customMonthly = updated.monthlyTotalCents;
      }
      onUpdate?.(updated);
    } catch (err) {
      console.error('[BudgetSetter] failed to update budget:', err);
    } finally {
      isUpdating = false;
    }
  }

  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(0)}`;
  }
</script>

<div class="budget-setter">
  <div class="setter-header">
    <h3 class="setter-title">Budget Controls</h3>
    {#if !showCustom}
      <div class="presets">
        {#each PRESETS as preset}
          <button
            class="preset-btn"
            class:active={dailyBudgetCents === preset.dailyCents}
            onclick={() => selectPreset(preset.dailyCents)}
          >
            {preset.label}
          </button>
        {/each}
        <button class="preset-btn" onclick={enableCustom}>Custom</button>
      </div>
    {:else}
      <div class="custom-inputs">
        <label class="custom-label">
          Daily
          <input
            type="range"
            min="100"
            max="50000"
            step="100"
            bind:value={customDaily}
            class="budget-slider"
          />
          <span class="custom-value">{formatCents(customDaily)}</span>
        </label>
        <label class="custom-label">
          Monthly
          <input
            type="range"
            min="1000"
            max="500000"
            step="1000"
            bind:value={customMonthly}
            class="budget-slider"
          />
          <span class="custom-value">{formatCents(customMonthly)}</span>
        </label>
      </div>
    {/if}
  </div>

  <div class="budget-bars">
    <div class="bar-row">
      <span class="bar-label">Today</span>
      <div class="bar-track">
        <div
          class="bar-fill"
          class:warn={dailyPct >= 75}
          class:danger={dailyPct >= 90}
          style="width: {dailyPct}%"
        ></div>
      </div>
      <span class="bar-value">{formatCents(dailySpent)} / {formatCents(showCustom ? customDaily : dailyBudgetCents)}</span>
    </div>

    <div class="bar-row">
      <span class="bar-label">Month</span>
      <div class="bar-track">
        <div
          class="bar-fill month-fill"
          class:warn={monthlyPct >= 75}
          class:danger={monthlyPct >= 90}
          style="width: {monthlyPct}%"
        ></div>
      </div>
      <span class="bar-value">{formatCents(budget.monthlyTotalCents)} / {formatCents(showCustom ? customMonthly : monthlyBudgetCents)}</span>
    </div>
  </div>

  <button class="save-btn" onclick={saveBudget} disabled={isUpdating}>
    {isUpdating ? 'Saving...' : 'Apply Budget'}
  </button>
</div>

<style>
  .budget-setter {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 16px;
  }

  .setter-header {
    margin-bottom: 16px;
  }

  .setter-title {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 10px 0;
  }

  .presets {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .preset-btn {
    font-family: var(--font-body);
    font-size: 11px;
    padding: 5px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .preset-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .custom-inputs {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .custom-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }

  .budget-slider {
    flex: 1;
    height: 4px;
    appearance: none;
    background: var(--border);
    border-radius: 2px;
    cursor: pointer;
  }

  .budget-slider::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
  }

  .custom-value {
    min-width: 40px;
    text-align: right;
    font-family: var(--font-label);
    font-size: 10px;
    color: var(--text);
  }

  .budget-bars {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 14px;
  }

  .bar-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .bar-label {
    font-family: var(--font-label);
    font-size: 8px;
    color: var(--text-muted);
    width: 40px;
    flex-shrink: 0;
  }

  .bar-track {
    flex: 1;
    height: 6px;
    background: var(--bg2);
    border-radius: 3px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .bar-fill.warn {
    background: var(--bo-amber);
  }

  .bar-fill.danger {
    background: var(--bo-rose);
  }

  .bar-value {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    min-width: 90px;
    text-align: right;
  }

  .save-btn {
    width: 100%;
    padding: 8px 14px;
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 500;
    border-radius: var(--radius-sm);
    border: none;
    background: var(--accent);
    color: white;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .save-btn:hover:not(:disabled) {
    opacity: 0.85;
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(body.back-office) .bar-fill {
    background: var(--bo-violet);
  }

  :global(body.back-office) .bar-fill.warn {
    background: var(--bo-amber);
  }

  :global(body.back-office) .bar-fill.danger {
    background: var(--bo-rose);
  }
</style>
