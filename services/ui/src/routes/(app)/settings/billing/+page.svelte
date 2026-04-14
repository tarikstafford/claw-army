<script lang="ts">
  import MetricTile from '$lib/components/MetricTile.svelte';
  import KarmaCallout from '$lib/components/KarmaCallout.svelte';
  import BudgetSetter from '$lib/components/BudgetSetter.svelte';
  import SpendTrendChart from '$lib/components/SpendTrendChart.svelte';
  import StackedAreaChart from '$lib/components/StackedAreaChart.svelte';
  import OperationBreakdownChart from '$lib/components/OperationBreakdownChart.svelte';
  import CostAlertBanner from '$lib/components/CostAlertBanner.svelte';
  import CostProjectionCard from '$lib/components/CostProjectionCard.svelte';
  import type { PageData } from './$types';
  import { subscribeWS } from '$lib/ws.js';
  import type { LiveEvent } from '$lib/ws.js';
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';

  let { data }: { data: PageData } = $props();

  let costSummary = $derived(data.costSummary);
  let costsByAgent = $derived(data.costsByAgent ?? []);
  let budget = $derived(data.budget);
  let spendTrends = $derived(data.spendTrends ?? []);
  let spendByAgent = $derived(data.spendByAgent ?? []);
  let spendByOperation = $derived(data.spendByOperation ?? []);
  let evolutionCosts = $derived(data.evolutionCosts);
  let costProjections = $derived(data.costProjections);

  function formatCents(cents: number | null | undefined): string {
    if (cents == null) return '\u2014';
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatNumber(val: number | null | undefined): string {
    if (val == null) return '\u2014';
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return String(val);
  }

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return '\u2014';
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  let dailyCost = $derived(
    budget ? formatCents(budget.spentTodayCents) : formatCents(costSummary?.totalCents)
  );
  let totalTokens = $derived(
    formatNumber(costSummary?.totalTokens ?? costSummary?.breakdown?.tokens as number | undefined)
  );
  let budgetRemaining = $derived(
    budget ? formatCents(budget.remainingTodayCents) : '\u2014'
  );
  let monthlyTotal = $derived(
    budget ? formatCents(budget.monthlyTotalCents) : '\u2014'
  );

  let karmaText = $derived(
    costSummary?.karma != null
      ? `${costSummary.karma} karma accumulated`
      : budget?.karma != null
        ? `${budget.karma} karma accumulated`
        : null
  );

  const companyId = $derived(data.companyId);

  let showBudgetSetter = $state(false);

  async function handleBudgetUpdate() {
    await invalidateAll();
  }

  onMount(() => {
    const unsub = subscribeWS((event: LiveEvent) => {
      if (event.type.startsWith('budget.')) {
        window.dispatchEvent(new CustomEvent('budget-event', { detail: event }));
      }
    });
    return unsub;
  });
</script>

<div class="sanctum-page">
  <header class="page-header section">
    <h1 class="page-title">Sanctum</h1>
  </header>

  {#if karmaText}
    <div class="section karma-section">
      <KarmaCallout text={karmaText} />
    </div>
  {/if}

  {#if budget}
    <section class="section alert-section">
      <CostAlertBanner
        dailyBudgetCents={budget.dailyBudgetCents}
        spentTodayCents={budget.spentTodayCents}
        monthlyBudgetCents={budget.monthlyBudgetCents ?? 0}
        monthlySpentCents={budget.monthlyTotalCents}
      />
    </section>
  {/if}

  <section class="section metrics-section" aria-label="Cost metrics">
    <div class="metric-grid">
      <MetricTile label="DAILY COST" value={dailyCost} sub="today" />
      <MetricTile label="BUDGET LEFT" value={budgetRemaining} sub="today" />
      <MetricTile label="MONTHLY" value={monthlyTotal} />
      <MetricTile label="TOKENS" value={totalTokens} />
    </div>
  </section>

  {#if costProjections}
    <section class="section projection-section" aria-label="Cost projections">
      <CostProjectionCard projection={costProjections} />
    </section>
  {/if}

  {#if budget && companyId}
    <section class="section budget-section" aria-label="Budget controls">
      <div class="budget-header">
        <h2 class="section-heading">Budget</h2>
        <button class="toggle-btn" onclick={() => showBudgetSetter = !showBudgetSetter}>
          {showBudgetSetter ? 'Hide controls' : 'Configure'}
        </button>
      </div>
      {#if showBudgetSetter}
        <BudgetSetter
          currentDailyBudgetCents={budget.dailyBudgetCents}
          currentMonthlyBudgetCents={budget.monthlyBudgetCents ?? 0}
          spentTodayCents={budget.spentTodayCents}
          monthlySpentCents={budget.monthlyTotalCents}
          companyId={companyId}
          onUpdate={handleBudgetUpdate}
        />
      {/if}
    </section>
  {/if}

  {#if spendTrends.length > 0}
    <section class="section trends-section" aria-label="Spend trends">
      <h2 class="section-heading">Spend — Last 30 Days</h2>
      <SpendTrendChart data={spendTrends} />
    </section>
  {/if}

  {#if spendByAgent.length > 0}
    <section class="section agent-trends-section" aria-label="Agent spend over time">
      <h2 class="section-heading">Spend by Agent</h2>
      <StackedAreaChart data={spendByAgent} />
    </section>
  {/if}

  {#if spendByOperation.length > 0}
    <section class="section operation-trends-section" aria-label="Spend by operation type">
      <h2 class="section-heading">Spend by Operation</h2>
      <OperationBreakdownChart data={spendByOperation} />
    </section>
  {/if}

  <section class="section costs-section" aria-label="Costs by agent">
    <h2 class="section-heading">Costs by agent</h2>
    {#if costsByAgent.length === 0}
      <p class="empty-state">No cost data yet. Costs appear as your crew works.</p>
    {:else}
      <div class="table-wrap">
        <table class="costs-table">
          <thead>
            <tr>
              <th class="col-agent">Agent</th>
              <th class="col-cost">Total cost</th>
              <th class="col-tokens">Tokens</th>
              <th class="col-active">Last active</th>
            </tr>
          </thead>
          <tbody>
            {#each costsByAgent as row (row.agentId)}
              <tr class="cost-row">
                <td class="col-agent">
                  <span class="agent-name">{row.agentName ?? row.agentId.slice(0, 8)}</span>
                </td>
                <td class="col-cost">
                  <span class="cost-value">{formatCents(row.totalCents)}</span>
                </td>
                <td class="col-tokens">
                  <span class="token-value">{formatNumber(row.tokenCount ?? row.tokens)}</span>
                </td>
                <td class="col-active">
                  <span class="active-value">{formatDate(row.lastActive ?? row.updatedAt)}</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <section class="section evolution-section" aria-label="Evolution">
    <h2 class="section-heading">Evolution</h2>
    {#if evolutionCosts}
      <div class="evolution-grid">
        <div class="evolution-metric">
          <span class="evo-label">Total evolution cost</span>
          <span class="evo-value">{formatCents(evolutionCosts.totalEvolutionCostCents)}</span>
        </div>
        <div class="evolution-metric">
          <span class="evo-label">Evolution runs</span>
          <span class="evo-value">{formatNumber(evolutionCosts.evolutionRunsCount)}</span>
        </div>
        <div class="evolution-metric">
          <span class="evo-label">Avg cost per run</span>
          <span class="evo-value">{formatCents(evolutionCosts.avgCostPerRunCents)}</span>
        </div>
      </div>
    {:else}
      <p class="evolution-placeholder">Evolution metrics will appear here as your agents evolve.</p>
    {/if}
  </section>
</div>

<style>
  .sanctum-page {
    width: 100%;
  }

  .page-header {
    padding-bottom: var(--space-md);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(26px, 3.5vw, 38px);
    font-weight: 600;
    color: var(--text);
    line-height: 1.1;
    margin: 0;
  }

  /* ── Section layout ─────────────────────────────────── */
  .section {
    padding: 28px 40px;
  }

  .section-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    line-height: 1.2;
    margin: 0 0 var(--space-lg) 0;
  }

  /* ── Karma section ──────────────────────────────────── */
  .karma-section {
    padding-top: 0;
  }

  .alert-section {
    padding-top: 0;
    padding-bottom: 0;
  }

  .projection-section {
    padding-top: 0;
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-md);
  }

  .budget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
  }

  .budget-header .section-heading {
    margin-bottom: 0;
  }

  .toggle-btn {
    font-family: var(--font-body);
    font-size: 12px;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-btn:hover {
    border-color: var(--fo-violet, #7C3AED);
    color: var(--text);
  }

  .table-wrap {
    overflow-x: auto;
  }

  .costs-table {
    width: 100%;
    border-collapse: collapse;
  }

  .costs-table th {
    font-family: var(--font-label);
    font-size: 5px;
    font-weight: 400;
    color: var(--text-muted);
    letter-spacing: 0.10em;
    text-align: left;
    padding: 6px 10px 10px 0;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  .cost-row td {
    padding: 10px 10px 10px 0;
    border-bottom: 1px solid var(--bg2);
    vertical-align: top;
  }

  .agent-name {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    font-weight: 400;
  }

  .cost-value {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
  }

  .token-value {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
  }

  .active-value {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
    font-style: italic;
  }

  .empty-state {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0;
    line-height: 1.5;
  }

  .evolution-section {
    border-top: 1px solid var(--border);
  }

  .evolution-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-md);
  }

  .evolution-metric {
    background: var(--card);
    border: 1px solid var(--border);
    padding: 12px 14px;
    border-radius: var(--radius-md);
  }

  .evo-label {
    font-family: var(--font-label);
    font-size: 5px;
    color: var(--text-muted);
    letter-spacing: 0.10em;
    display: block;
    margin-bottom: 7px;
  }

  .evo-value {
    font-family: var(--font-label);
    font-size: 18px;
    color: var(--text);
    line-height: 1;
    display: block;
  }

  .evolution-placeholder {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--muted);
    margin: 0;
    line-height: 1.8;
  }

  @media (max-width: 768px) {
    .section {
      padding: 20px 16px;
    }

    .metric-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-sm);
    }

    .evolution-grid {
      grid-template-columns: 1fr;
    }

    .table-wrap {
      margin: 0 calc(-1 * var(--space-md));
      padding: 0 var(--space-md);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .costs-table {
      min-width: 500px;
    }
  }

  @media (max-width: 480px) {
    .section {
      padding: 16px var(--space-sm);
    }

    .page-title {
      font-size: 24px;
    }

    .section-heading {
      font-size: 16px;
      margin-bottom: var(--space-md);
    }

    .metric-grid {
      grid-template-columns: 1fr 1fr;
      gap: var(--space-xs);
    }

    .evolution-grid {
      gap: var(--space-sm);
    }

    .evolution-metric {
      padding: 10px 12px;
    }

    .evo-value {
      font-size: 16px;
    }
  }
</style>
