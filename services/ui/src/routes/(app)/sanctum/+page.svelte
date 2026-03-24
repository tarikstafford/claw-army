<script lang="ts">
  import MetricTile from '$lib/components/MetricTile.svelte';
  import KarmaCallout from '$lib/components/KarmaCallout.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let costSummary = $derived(data.costSummary);
  let costsByAgent = $derived(data.costsByAgent ?? []);
  let budget = $derived(data.budget);

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

  <!-- Metric tile grid -->
  <section class="section metrics-section" aria-label="Cost metrics">
    <div class="metric-grid">
      <MetricTile label="DAILY COST" value={dailyCost} sub="today" />
      <MetricTile label="BUDGET LEFT" value={budgetRemaining} sub="today" />
      <MetricTile label="MONTHLY" value={monthlyTotal} />
      <MetricTile label="TOKENS" value={totalTokens} />
    </div>
  </section>

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

  <!-- Evolution placeholder -->
  <section class="section evolution-section" aria-label="Evolution">
    <h2 class="section-heading">Evolution</h2>
    <p class="evolution-placeholder">Coming in Phase 5</p>
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

  /* ── Evolution placeholder ──────────────────────────── */
  .evolution-section {
    border-top: 1px solid var(--fo-border);
  }

  :global(body.back-office) .evolution-section {
    border-top-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .evolution-placeholder {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--muted);
    margin: 0;
    line-height: 1.8;
  }
</style>
