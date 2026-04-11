<script lang="ts">
  import type { BudgetOverview } from '$lib/api';
  import { updateBudget } from '$lib/api';

  let {
    budget,
    companyId,
    onUpdate,
  }: {
    budget: BudgetOverview | null;
    companyId: string;
    onUpdate?: (updated: BudgetOverview) => void;
  } = $props();

  const PRESETS = [
    { label: '$10/day', dailyCents: 1000 },
    { label: '$50/day', dailyCents: 5000 },
    { label: '$100/day', dailyCents: 10000 },
  ] as const;

  let dailyBudget = $state(budget?.dailyBudgetCents ?? 0);
  let monthlyBudget = $state(budget?.monthlyBudgetCents ?? 0);
  let customDailyCents = $state<string>('');
  let isCustom = $state(false);
  let isSaving = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (budget) {
      dailyBudget = budget.dailyBudgetCents;
      monthlyBudget = budget.monthlyBudgetCents ?? 0;
      customDailyCents = '';
      isCustom = !PRESETS.some(p => p.dailyCents === budget.dailyBudgetCents);
    }
  });

  function selectPreset(cents: number) {
    dailyBudget = cents;
    isCustom = false;
    customDailyCents = '';
  }

  function handleCustomChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    customDailyCents = val;
    const parsed = Math.round(parseFloat(val) * 100);
    if (!isNaN(parsed) && parsed >= 0) {
      dailyBudget = parsed;
    }
    isCustom = true;
  }

  async function handleSave() {
    if (!companyId) return;
    isSaving = true;
    error = null;
    try {
      const updated = await updateBudget(companyId, {
        dailyBudgetCents: dailyBudget,
        monthlyBudgetCents: monthlyBudget > 0 ? monthlyBudget : undefined,
      });
      onUpdate?.(updated);
    } catch (err) {
      error = (err as Error).message;
    } finally {
      isSaving = false;
    }
  }

  function formatDollars(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  let spendPercent = $derived(
    budget && budget.dailyBudgetCents > 0
      ? Math.round((budget.spentTodayCents / budget.dailyBudgetCents) * 100)
      : 0
  );
</script>

<div class="budget-setter">
  <div class="setter-header">
    <h3 class="setter-title">Budget Settings</h3>
    {#if budget}
      <span class="spend-indicator" class:warning={spendPercent >= 75} class:danger={spendPercent >= 90}>
        {spendPercent}% of daily budget used
      </span>
    {/if}
  </div>

  {#if error}
    <p class="error-msg">{error}</p>
  {/if}

  <div class="preset-row">
    {#each PRESETS as preset}
      <button
        class="preset-btn"
        class:active={dailyBudget === preset.dailyCents && !isCustom}
        onclick={() => selectPreset(preset.dailyCents)}
      >
        {preset.label}
      </button>
    {/each}
    <button
      class="preset-btn"
      class:active={isCustom}
      onclick={() => { isCustom = true; customDailyCents = String(dailyBudget / 100); }}
    >
      Custom
    </button>
  </div>

  {#if isCustom}
    <div class="custom-input-wrap">
      <span class="currency-prefix">$</span>
      <input
        type="number"
        class="custom-input"
        placeholder="0.00"
        min="0"
        step="1"
        value={customDailyCents}
        oninput={handleCustomChange}
      />
      <span class="input-suffix">/day</span>
    </div>
  {/if}

  <div class="monthly-section">
    <label class="field-label" for="monthly-budget">Monthly budget cap (optional)</label>
    <div class="monthly-input-wrap">
      <span class="currency-prefix">$</span>
      <input
        id="monthly-budget"
        type="number"
        class="custom-input"
        placeholder="0.00"
        min="0"
        step="1"
        value={monthlyBudget > 0 ? String(monthlyBudget / 100) : ''}
        oninput={(e) => {
          const val = (e.target as HTMLInputElement).value;
          monthlyBudget = Math.round(parseFloat(val || '0') * 100);
        }}
      />
      <span class="input-suffix">/month</span>
    </div>
  </div>

  <div class="current-vs-spend">
    <div class="cap-display">
      <span class="cap-label">Daily cap</span>
      <span class="cap-value">{formatDollars(dailyBudget)}</span>
    </div>
    <div class="cap-display">
      <span class="cap-label">Spent today</span>
      <span class="cap-value">{formatDollars(budget?.spentTodayCents ?? 0)}</span>
    </div>
    <div class="cap-display">
      <span class="cap-label">Remaining</span>
      <span class="cap-value">{formatDollars(budget?.remainingTodayCents ?? 0)}</span>
    </div>
  </div>

  <button class="save-btn" onclick={handleSave} disabled={isSaving}>
    {isSaving ? 'Saving...' : 'Save budget'}
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
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
  }

  .setter-title {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  :global(body.back-office) .setter-title {
    color: var(--bo-text);
  }

  .spend-indicator {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
  }

  .spend-indicator.warning {
    color: var(--fo-gold, #B8860B);
  }

  .spend-indicator.danger {
    color: var(--fo-rose, #E53535);
  }

  .error-msg {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--fo-rose, #E53535);
    margin: 0 0 var(--space-sm) 0;
  }

  .preset-row {
    display: flex;
    gap: var(--space-xs);
    margin-bottom: var(--space-md);
    flex-wrap: wrap;
  }

  .preset-btn {
    font-family: var(--font-label);
    font-size: 9px;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    background: var(--fo-bg2, #EBE8E0);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 6px 10px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  :global(body.back-office) .preset-btn {
    background: rgba(124, 58, 237, 0.08);
    border-color: var(--bo-border, rgba(124, 58, 237, 0.15));
    color: var(--bo-caption);
  }

  .preset-btn:hover {
    border-color: var(--fo-violet, #7C3AED);
    color: var(--fo-violet, #7C3AED);
  }

  .preset-btn.active {
    background: var(--fo-violet, #7C3AED);
    border-color: var(--fo-violet, #7C3AED);
    color: #ffffff;
  }

  .custom-input-wrap,
  .monthly-input-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: var(--space-md);
  }

  .currency-prefix {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
  }

  .custom-input {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    background: var(--fo-bg2, #EBE8E0);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 6px 8px;
    width: 80px;
  }

  :global(body.back-office) .custom-input {
    background: rgba(124, 58, 237, 0.08);
    border-color: var(--bo-border, rgba(124, 58, 237, 0.15));
    color: var(--bo-text);
  }

  .custom-input:focus {
    outline: none;
    border-color: var(--fo-violet, #7C3AED);
  }

  .input-suffix {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
  }

  .monthly-section {
    margin-bottom: var(--space-md);
  }

  .field-label {
    font-family: var(--font-label);
    font-size: 9px;
    letter-spacing: 0.05em;
    color: var(--muted);
    display: block;
    margin-bottom: var(--space-xs);
  }

  .current-vs-spend {
    display: flex;
    gap: var(--space-lg);
    margin-bottom: var(--space-md);
    padding: 10px;
    background: var(--fo-bg2, #EBE8E0);
    border-radius: var(--radius-sm);
  }

  :global(body.back-office) .current-vs-spend {
    background: rgba(124, 58, 237, 0.05);
  }

  .cap-display {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cap-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.08em;
    color: var(--muted);
  }

  .cap-value {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
  }

  :global(body.back-office) .cap-value {
    color: var(--bo-text);
  }

  .save-btn {
    width: 100%;
    font-family: var(--font-label);
    font-size: 10px;
    letter-spacing: 0.05em;
    color: #ffffff;
    background: var(--fo-violet, #7C3AED);
    border: none;
    border-radius: var(--radius-sm);
    padding: 10px;
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
</style>
