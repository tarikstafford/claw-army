<script lang="ts">
  import { updateBudget } from '$lib/api.js';

  let {
    currentDailyBudgetCents = 0,
    currentMonthlyBudgetCents = 0,
    spentTodayCents = 0,
    monthlySpentCents = 0,
    companyId,
    onUpdate,
  }: {
    currentDailyBudgetCents?: number;
    currentMonthlyBudgetCents?: number;
    spentTodayCents?: number;
    monthlySpentCents?: number;
    companyId: string;
    onUpdate?: () => void;
  } = $props();

  const PRESETS = [
    { label: '$10/day', dailyCents: 1000 },
    { label: '$50/day', dailyCents: 5000 },
    { label: '$100/day', dailyCents: 10000 },
  ];

  let selectedPreset = $state<number | null>(null);
  let customDailyCents = $state(currentDailyBudgetCents);
  let customMonthlyCents = $state(currentMonthlyBudgetCents);
  let isUpdating = $state(false);
  let showCustom = $state(false);
  let errorMsg = $state<string | null>(null);

  const dailySpentRatio = $derived(
    currentDailyBudgetCents > 0 ? Math.min((spentTodayCents / currentDailyBudgetCents) * 100, 100) : 0
  );

  const monthlySpentRatio = $derived(
    currentMonthlyBudgetCents > 0 ? Math.min((monthlySpentCents / currentMonthlyBudgetCents) * 100, 100) : 0
  );

  function selectPreset(dailyCents: number) {
    selectedPreset = dailyCents;
    customDailyCents = dailyCents;
    showCustom = false;
  }

  function enableCustom() {
    selectedPreset = null;
    showCustom = true;
  }

  async function handleUpdate() {
    if (!companyId || isUpdating) return;
    isUpdating = true;
    errorMsg = null;
    try {
      await updateBudget(companyId, {
        dailyBudgetCents: customDailyCents,
        monthlyBudgetCents: customMonthlyCents,
      });
      onUpdate?.();
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Failed to update budget';
    } finally {
      isUpdating = false;
    }
  }

  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }
</script>

<div class="budget-setter">
  <div class="setter-header">
    <h3 class="setter-title">Budget Controls</h3>
  </div>

  <div class="budget-caps">
    <div class="cap-item">
      <div class="cap-label">Daily Cap</div>
      <div class="cap-value">{formatCents(currentDailyBudgetCents)}</div>
      <div class="cap-bar">
        <div class="cap-fill" style="width: {dailySpentRatio}%"></div>
      </div>
      <div class="cap-sub">{formatCents(spentTodayCents)} spent</div>
    </div>
    <div class="cap-item">
      <div class="cap-label">Monthly Cap</div>
      <div class="cap-value">{formatCents(currentMonthlyBudgetCents)}</div>
      <div class="cap-bar">
        <div class="cap-fill" style="width: {monthlySpentRatio}%"></div>
      </div>
      <div class="cap-sub">{formatCents(monthlySpentCents)} spent</div>
    </div>
  </div>

  <div class="presets">
    {#each PRESETS as preset}
      <button
        class="preset-btn"
        class:active={selectedPreset === preset.dailyCents}
        onclick={() => selectPreset(preset.dailyCents)}
      >
        {preset.label}
      </button>
    {/each}
    <button
      class="preset-btn"
      class:active={showCustom}
      onclick={() => enableCustom()}
    >
      Custom
    </button>
  </div>

  {#if showCustom}
    <div class="custom-inputs">
      <div class="input-group">
        <label for="daily-input">Daily ($)</label>
        <input
          id="daily-input"
          type="number"
          min="0"
          step="1"
          value={customDailyCents / 100}
          oninput={(e) => customDailyCents = Math.round(parseFloat(e.currentTarget.value || '0') * 100)}
          aria-label="Daily budget in dollars"
        />
      </div>
      <div class="input-group">
        <label for="monthly-input">Monthly ($)</label>
        <input
          id="monthly-input"
          type="number"
          min="0"
          step="1"
          value={customMonthlyCents / 100}
          oninput={(e) => customMonthlyCents = Math.round(parseFloat(e.currentTarget.value || '0') * 100)}
          aria-label="Monthly budget in dollars"
        />
      </div>
    </div>
  {/if}

  {#if errorMsg}
    <div class="error-msg">{errorMsg}</div>
  {/if}

  <button
    class="update-btn"
    onclick={handleUpdate}
    disabled={isUpdating}
  >
    {isUpdating ? 'Updating...' : 'Apply Budget'}
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
    margin-bottom: 14px;
  }

  .setter-title {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .budget-caps {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 14px;
  }

  .cap-item {
    background: var(--fo-bg2, #EBE8E0);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
  }

  .cap-label {
    font-family: var(--font-label);
    font-size: 5px;
    color: var(--text-muted);
    letter-spacing: 0.10em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .cap-value {
    font-family: var(--font-label);
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 6px;
  }

  .cap-bar {
    height: 4px;
    background: var(--fo-border);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 4px;
  }

  .cap-fill {
    height: 100%;
    background: var(--fo-violet, #7C3AED);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .cap-sub {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--text-muted);
  }

  .presets {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .preset-btn {
    font-family: var(--font-body);
    font-size: 11px;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-btn:hover {
    border-color: var(--fo-violet, #7C3AED);
    color: var(--text);
  }

  .preset-btn.active {
    background: var(--fo-violet, #7C3AED);
    border-color: var(--fo-violet, #7C3AED);
    color: white;
  }

  .custom-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 14px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .input-group label {
    font-family: var(--font-label);
    font-size: 5px;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .input-group input {
    font-family: var(--font-body);
    font-size: 13px;
    padding: 7px 9px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--text);
    width: 100%;
    box-sizing: border-box;
  }

  .input-group input:focus {
    outline: none;
    border-color: var(--fo-violet, #7C3AED);
  }

  .error-msg {
    font-family: var(--font-body);
    font-size: 11px;
    color: #dc2626;
    margin-bottom: 10px;
  }

  .update-btn {
    width: 100%;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    padding: 9px 16px;
    border-radius: var(--radius-sm);
    border: none;
    background: var(--fo-violet, #7C3AED);
    color: white;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .update-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .update-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
