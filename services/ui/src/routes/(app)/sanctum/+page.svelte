<script lang="ts">
  import MetricTile from '$lib/components/MetricTile.svelte';
  import KarmaCallout from '$lib/components/KarmaCallout.svelte';
  import BudgetSetter from '$lib/components/BudgetSetter.svelte';
  import SpendTrendChart from '$lib/components/SpendTrendChart.svelte';
  import StackedAreaChart from '$lib/components/StackedAreaChart.svelte';
  import type { PageData } from './$types';
  import type { BudgetOverview } from '$lib/api';

  let { data }: { data: PageData } = $props();

  let costSummary = $derived(data.costSummary);
  let costsByAgent = $derived(data.costsByAgent ?? []);
  let spendTrend = $derived(data.spendTrend ?? []);
  let spendTrendByAgent = $derived(data.spendTrendByAgent ?? []);
  let spendTrendByOp = $derived(data.spendTrendByOperation ?? []);
  let evolutionCost = $derived(data.evolutionCost ?? null);
  let budget = $state<BudgetOverview | null>(data.budget);

  function formatCents(cents: number | null | undefined): string {
    if (cents == null) return '—';
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatNumber(val: number | null | undefined): string {
    if (val == null) return '—';
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
    return String(val);
  }

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  let dailyCost = $derived(
    budget ? formatCents(budget.spentTodayCents) : formatCents(costSummary?.totalCents)
  );
  let totalTokens = $derived(
    formatNumber(costSummary?.totalTokens ?? costSummary?.breakdown?.tokens as number | undefined)
  );
  let budgetRemaining = $derived(
    budget ? formatCents(budget.remainingTodayCents) : '—'
  );
  let monthlyTotal = $derived(
    budget ? formatCents(budget.monthlyTotalCents) : '—'
  );

  let karmaText = $derived(
    costSummary?.karma != null
      ? `${costSummary.karma} karma accumulated`
      : budget?.karma != null
        ? `${budget.karma} karma accumulated`
        : null
  );

  let budgetPct = $derived(
    budget && budget.dailyBudgetCents > 0
      ? (budget.spentTodayCents / budget.dailyBudgetCents) * 100
      : null
  );

  let alertLevel = $derived(
    budgetPct === null ? null
    : budgetPct >= 90 ? 'exceeded'
    : budgetPct >= 75 ? 'danger'
    : budgetPct >= 50 ? 'warning'
    : null
  );

  function handleBudgetUpdate(updated: BudgetOverview) {
    budget = updated;
  }
</script>

<div class="sanctum-page">
  <!-- Page header -->
  <header class="page-header section">
    <h1 class="page-title">Sanctum</h1>
  </header>

  <!-- Karma callout (if available) -->
  {#if karmaText}
    <div class="section karma-section">
      <KarmaCallout text={karmaText} />
    </div>
  {/if}

  <!-- Cost alerts -->
  {#if alertLevel === 'exceeded'}
    <div class="section alert-banner danger">
      <span class="alert-icon">&#9888;</span>
      <span class="alert-text">Budget exceeded — consider pausing work or adjusting your budget cap.</span>
    </div>
  {:else if alertLevel === 'danger'}
    <div class="section alert-banner danger">
      <span class="alert-icon">&#9888;</span>
      <span class="alert-text">Approaching budget limit (90% used today)</span>
    </div>
  {:else if alertLevel === 'warning'}
    <div class="section alert-banner warning">
      <span class="alert-icon">&#9888;</span>
      <span class="alert-text">Budget usage at 50%+ — track your spend carefully</span>
    </div>
  {/if}

  <!-- Metric tile grid -->
  <section class="section metrics-section" aria-label="Cost metrics">
    <div class="metric-grid">
      <MetricTile label="DAILY COST" value={dailyCost} sub="today" />
      <MetricTile label="BUDGET LEFT" value={budgetRemaining} sub="today" />
      <MetricTile label="MONTHLY" value={monthlyTotal} />
      <MetricTile label="TOKENS" value={totalTokens} />
    </div>
  </section>

  <!-- Budget setter -->
  {#if budget}
    <section class="section budget-section" aria-label="Budget controls">
      <BudgetSetter {budget} companyId={data.companyId} onUpdate={handleBudgetUpdate} />
    </section>
  {/if}

  <!-- Spend trends -->
  {#if spendTrend.length > 0}
    <section class="section trends-section" aria-label="Spend trends">
      <h2 class="section-heading">Daily spend — last 30 days</h2>
      <div class="chart-container">
        <SpendTrendChart data={spendTrend} height={140} />
      </div>
    </section>
  {/if}

  <!-- Agent breakdown chart -->
  {#if spendTrendByAgent.length > 0}
    <section class="section trends-section" aria-label="Agent spend breakdown">
      <h2 class="section-heading">Spend by agent over time</h2>
      <div class="chart-container">
        <StackedAreaChart data={spendTrendByAgent} height={140} />
      </div>
    </section>
  {/if}

  <!-- Operation type breakdown chart -->
  {#if spendTrendByOp.length > 0}
    <section class="section trends-section" aria-label="Operation type breakdown">
      <h2 class="section-heading">Spend by operation type</h2>
      <div class="op-breakdown">
        {#each spendTrendByOp as op}
          <div class="op-row">
            <div class="op-bars">
              <div class="op-bar llm" style="width: {(op.llmCallsCents / (op.llmCallsCents + op.botHoursCents + op.toolInvocationsCents + 1)) * 100}%"></div>
              <div class="op-bar bot" style="width: {(op.botHoursCents / (op.llmCallsCents + op.botHoursCents + op.toolInvocationsCents + 1)) * 100}%"></div>
              <div class="op-bar tool" style="width: {(op.toolInvocationsCents / (op.llmCallsCents + op.botHoursCents + op.toolInvocationsCents + 1)) * 100}%"></div>
            </div>
            <span class="op-date">{formatDate(op.date)}</span>
            <span class="op-total">{formatCents(op.llmCallsCents + op.botHoursCents + op.toolInvocationsCents)}</span>
          </div>
        {/each}
      </div>
      <div class="op-legend">
        <span class="legend-item"><span class="legend-dot llm"></span>LLM calls</span>
        <span class="legend-item"><span class="legend-dot bot"></span>Bot-hours</span>
        <span class="legend-item"><span class="legend-dot tool"></span>Tool invocations</span>
      </div>
    </section>
  {/if}

  <!-- Costs by agent -->
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

  <!-- Evolution -->
  <section class="section evolution-section" aria-label="Evolution costs">
    <h2 class="section-heading">Evolution</h2>
    {#if evolutionCost}
      <div class="evolution-metrics">
        <div class="evo-stat">
          <span class="evo-label">Council evaluations</span>
          <span class="evo-value">{evolutionCost.councilEvaluations}</span>
        </div>
        <div class="evo-stat">
          <span class="evo-label">Total cost</span>
          <span class="evo-value">{formatCents(evolutionCost.totalCents)}</span>
        </div>
      </div>
    {:else}
      <p class="evolution-placeholder">Evolution metrics appear after your first evaluation cycle.</p>
    {/if}
  </section>
</div>

<style>
  .sanctum-page {
    width: 100%;
  }

  /* ── Page header ────────────────────────────────────── */
  .page-header {
    padding-bottom: var(--space-md);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(26px, 3.5vw, 38px);
    font-weight: 600;
    color: var(--ink);
    line-height: 1.1;
    margin: 0;
  }

  :global(body.back-office) .page-title {
    color: var(--bo-text);
  }

  /* ── Section layout ─────────────────────────────────── */
  .section {
    padding: 28px 40px;
  }

  .section-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.2;
    margin: 0 0 var(--space-lg) 0;
  }

  :global(body.back-office) .section-heading {
    color: var(--bo-text);
  }

  /* ── Alert banners ─────────────────────────────────── */
  .alert-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 40px;
    font-family: var(--font-body);
    font-size: 13px;
    border-radius: 0;
  }

  .alert-banner.warning {
    background: rgba(251, 191, 36, 0.12);
    border-bottom: 1px solid rgba(251, 191, 36, 0.3);
    color: var(--bo-amber);
  }

  .alert-banner.danger {
    background: rgba(244, 114, 182, 0.12);
    border-bottom: 1px solid rgba(244, 114, 182, 0.3);
    color: var(--bo-rose);
  }

  .alert-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  /* ── Karma section ──────────────────────────────────── */
  .karma-section {
    padding-top: 0;
  }

  /* ── Metric grid ─────────────────────────────────────── */
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-md);
  }

  /* ── Budget section ─────────────────────────────────── */
  .budget-section {
    padding-top: 0;
  }

  /* ── Trends section ─────────────────────────────────── */
  .trends-section {
    border-top: 1px solid var(--fo-border);
  }

  :global(body.back-office) .trends-section {
    border-top-color: var(--bo-border);
  }

  .chart-container {
    width: 100%;
  }

  /* ── Operation breakdown ─────────────────────────────── */
  .op-breakdown {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .op-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .op-bars {
    flex: 1;
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: var(--bg2);
  }

  .op-bar {
    height: 100%;
    transition: width 0.3s ease;
  }

  .op-bar.llm {
    background: var(--accent);
  }

  .op-bar.bot {
    background: var(--karma);
  }

  .op-bar.tool {
    background: var(--bo-teal);
  }

  .op-date {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    min-width: 60px;
  }

  .op-total {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text);
    min-width: 60px;
    text-align: right;
  }

  .op-legend {
    display: flex;
    gap: 16px;
    margin-top: 12px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  .legend-dot.llm {
    background: var(--accent);
  }

  .legend-dot.bot {
    background: var(--karma);
  }

  .legend-dot.tool {
    background: var(--bo-teal);
  }

  /* ── Costs table ─────────────────────────────────────── */
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
    color: var(--muted);
    letter-spacing: 0.10em;
    text-align: left;
    padding: 6px 10px 10px 0;
    border-bottom: 1px solid var(--fo-border);
    white-space: nowrap;
  }

  :global(body.back-office) .costs-table th {
    border-bottom-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .cost-row td {
    padding: 10px 10px 10px 0;
    border-bottom: 1px solid var(--fo-bg2, #EBE8E0);
    vertical-align: top;
  }

  :global(body.back-office) .cost-row td {
    border-bottom-color: rgba(124, 58, 237, 0.08);
  }

  .agent-name {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink);
    font-weight: 400;
  }

  :global(body.back-office) .agent-name {
    color: var(--bo-text);
  }

  .cost-value {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink);
  }

  :global(body.back-office) .cost-value {
    color: var(--bo-text);
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

  /* ── Evolution section ─────────────────────────────── */
  .evolution-section {
    border-top: 1px solid var(--fo-border);
  }

  :global(body.back-office) .evolution-section {
    border-top-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .evolution-metrics {
    display: flex;
    gap: 24px;
  }

  .evo-stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .evo-label {
    font-family: var(--font-label);
    font-size: 5px;
    color: var(--text-muted);
    letter-spacing: 0.10em;
  }

  .evo-value {
    font-family: var(--font-display);
    font-size: 22px;
    color: var(--text);
  }

  :global(body.back-office) .evo-value {
    color: var(--bo-text);
  }

  .evolution-placeholder {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--muted);
    margin: 0;
    line-height: 1.8;
  }
</style>
