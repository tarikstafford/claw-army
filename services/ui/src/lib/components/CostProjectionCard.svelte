<script lang="ts">
  import type { CostProjection, BurnTrend } from '$lib/api';

  let { projection }: { projection: CostProjection } = $props();

  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function trendLabel(t: BurnTrend): string {
    if (t === 'increasing') return 'Increasing';
    if (t === 'decreasing') return 'Decreasing';
    return 'Stable';
  }

  function trendArrow(t: BurnTrend): string {
    if (t === 'increasing') return '\u2191';
    if (t === 'decreasing') return '\u2193';
    return '\u2192';
  }

  let exhaustionText = $derived(
    projection.daysUntilBudgetExhaustion === null
      ? 'No limit'
      : projection.daysUntilBudgetExhaustion === 0
        ? 'Exhausted'
        : `${projection.daysUntilBudgetExhaustion}d`
  );

  let exhaustionUrgent = $derived(
    projection.daysUntilBudgetExhaustion !== null && projection.daysUntilBudgetExhaustion <= 3
  );

  let breakdownItems = $derived([
    { label: 'LLM Input', cents: projection.breakdown.llmInputTokensCents },
    { label: 'LLM Output', cents: projection.breakdown.llmOutputTokensCents },
    { label: 'Bot Hours', cents: projection.breakdown.botHoursCents },
    { label: 'Tool Calls', cents: projection.breakdown.toolInvocationsCents },
  ]);

  let breakdownTotal = $derived(
    breakdownItems.reduce((sum, item) => sum + item.cents, 0)
  );
</script>

<div class="projection-card">
  <div class="card-header">
    <h3 class="card-title">Cost Forecast</h3>
    <span class="window-badge">{projection.windowDays}d window</span>
  </div>

  <div class="projection-grid">
    <div class="projection-metric">
      <span class="metric-label">DAILY BURN</span>
      <span class="metric-value">{formatCents(projection.dailyBurnRateCents)}</span>
      <span class="metric-sub">per day avg</span>
    </div>

    <div class="projection-metric">
      <span class="metric-label">PROJECTED MONTHLY</span>
      <span class="metric-value">{formatCents(projection.projectedMonthlyCostCents)}</span>
      <span class="metric-sub">end of month</span>
    </div>

    <div class="projection-metric">
      <span class="metric-label">BUDGET RUNWAY</span>
      <span class="metric-value" class:urgent={exhaustionUrgent}>{exhaustionText}</span>
      <span class="metric-sub">at current rate</span>
    </div>

    <div class="projection-metric">
      <span class="metric-label">TREND</span>
      <span class="metric-value trend-value" data-trend={projection.trend}>
        <span class="trend-arrow">{trendArrow(projection.trend)}</span>
        {trendLabel(projection.trend)}
      </span>
      <span class="metric-sub">{projection.dataPoints} data points</span>
    </div>
  </div>

  {#if breakdownTotal > 0}
    <div class="breakdown">
      <span class="breakdown-heading">COST BREAKDOWN</span>
      <div class="breakdown-bar">
        {#each breakdownItems as item}
          {#if item.cents > 0}
            <div
              class="bar-segment"
              data-dimension={item.label}
              style="width: {(item.cents / breakdownTotal) * 100}%"
              title="{item.label}: {formatCents(item.cents)}"
            ></div>
          {/if}
        {/each}
      </div>
      <div class="breakdown-legend">
        {#each breakdownItems as item}
          {#if item.cents > 0}
            <span class="legend-item" data-dimension={item.label}>
              <span class="legend-dot" data-dimension={item.label}></span>
              {item.label} {formatCents(item.cents)}
            </span>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .projection-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 20px 22px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 18px;
  }

  .card-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--ink);
    margin: 0;
    line-height: 1.2;
  }

  :global(body.back-office) .card-title {
    color: var(--bo-text);
  }

  .window-badge {
    font-family: var(--font-label);
    font-size: 5px;
    color: var(--text-muted);
    letter-spacing: 0.10em;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 3px 8px;
  }

  .projection-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--space-md);
    margin-bottom: 18px;
  }

  .projection-metric {
    min-width: 0;
  }

  .metric-label {
    font-family: var(--font-label);
    font-size: 5px;
    color: var(--text-muted);
    letter-spacing: 0.10em;
    display: block;
    margin-bottom: 7px;
  }

  .metric-value {
    font-family: var(--font-label);
    font-size: 18px;
    color: var(--text);
    line-height: 1;
    display: block;
  }

  .metric-value.urgent {
    color: #D94F3D;
  }

  .metric-sub {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--text-muted);
    display: block;
    margin-top: 3px;
  }

  .trend-value {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .trend-arrow {
    font-size: 14px;
  }

  .trend-value[data-trend='increasing'] {
    color: #D94F3D;
  }

  .trend-value[data-trend='decreasing'] {
    color: #3D8C6E;
  }

  .trend-value[data-trend='stable'] {
    color: var(--text-muted);
  }

  .breakdown {
    border-top: 1px solid var(--fo-border);
    padding-top: 14px;
  }

  :global(body.back-office) .breakdown {
    border-top-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .breakdown-heading {
    font-family: var(--font-label);
    font-size: 5px;
    color: var(--text-muted);
    letter-spacing: 0.10em;
    display: block;
    margin-bottom: 10px;
  }

  .breakdown-bar {
    display: flex;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 10px;
    background: var(--fo-bg2, #EBE8E0);
  }

  :global(body.back-office) .breakdown-bar {
    background: rgba(124, 58, 237, 0.08);
  }

  .bar-segment {
    min-width: 3px;
    transition: width 0.3s ease;
  }

  .bar-segment[data-dimension='LLM Input'] {
    background: #7C3AED;
  }

  .bar-segment[data-dimension='LLM Output'] {
    background: #A78BFA;
  }

  .bar-segment[data-dimension='Bot Hours'] {
    background: #D4A843;
  }

  .bar-segment[data-dimension='Tool Calls'] {
    background: #6B7280;
  }

  .breakdown-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .legend-item {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .legend-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .legend-dot[data-dimension='LLM Input'] {
    background: #7C3AED;
  }

  .legend-dot[data-dimension='LLM Output'] {
    background: #A78BFA;
  }

  .legend-dot[data-dimension='Bot Hours'] {
    background: #D4A843;
  }

  .legend-dot[data-dimension='Tool Calls'] {
    background: #6B7280;
  }
</style>
