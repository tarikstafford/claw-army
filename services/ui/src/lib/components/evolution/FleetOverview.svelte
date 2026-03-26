<script lang="ts">
  interface FleetSummary {
    classCounts: { Novice: number; Understudy: number; Artisan: number; Retired: number };
    totalBots: number;
    averageCompositeScore: string | null;
    pendingVerdictCount: number;
    scoreHistory: Array<{ date: string; score: string }>;
  }

  interface AgentRow {
    botId: string;
    currentClass: string;
    compositeScore: string | null;
    isPioneer: boolean;
    taskCategory: string;
    lastVerdictAt: string | null;
  }

  const CLASS_COLORS: Record<string, string> = {
    Artisan: 'var(--bo-amber)',
    Understudy: 'var(--bo-vb)',
    Novice: 'var(--bo-muted)',
    Retired: 'var(--bo-faint)',
  };

  const CLASS_ORDER = ['Novice', 'Understudy', 'Artisan', 'Retired'] as const;

  let { fleet, agents = [] }: { fleet: FleetSummary | null; agents?: AgentRow[] } = $props();

  let maxScore = $derived(
    fleet && fleet.scoreHistory.length > 0
      ? Math.max(...fleet.scoreHistory.map((e) => parseFloat(e.score) || 0))
      : 0
  );
</script>

<!-- Section 1: Class Distribution Grid -->
{#if fleet === null}
  <div class="class-grid skeleton-grid">
    {#each [0, 1, 2, 3] as _}
      <div class="class-cell skeleton-cell"></div>
    {/each}
  </div>
{:else if fleet.totalBots === 0}
  <div class="empty-state">
    <p class="empty-title">No agents yet</p>
    <p class="empty-body">Run an execution to start building your fleet.</p>
  </div>
{:else}
  <div class="class-grid">
    {#each CLASS_ORDER as cls}
      {@const count = fleet.classCounts[cls] ?? 0}
      {@const isArtisan = cls === 'Artisan'}
      {@const isRetired = cls === 'Retired'}
      <div
        class="class-cell"
        class:artisan={isArtisan}
        class:retired={isRetired}
      >
        <span
          class="class-count"
          style="color: {CLASS_COLORS[cls]}"
        >{count}</span>
        <span
          class="class-name"
          style="color: {CLASS_COLORS[cls]}"
        >{cls.toUpperCase()}</span>
      </div>
    {/each}
  </div>

  <!-- Section 1b: Composite Score Trend -->
  <div class="score-trend">
    <div class="score-current">
      <span class="score-label">AVG COMPOSITE SCORE</span>
      <span class="score-value">
        {fleet.averageCompositeScore ? parseFloat(fleet.averageCompositeScore).toFixed(2) : '—'}
      </span>
    </div>
    <div class="sparkline-wrap">
      {#if fleet.scoreHistory.length >= 2}
        <div class="sparkline" aria-hidden="true">
          {#each fleet.scoreHistory as entry, i}
            {@const barHeight = maxScore > 0 ? (parseFloat(entry.score) / maxScore) * 100 : 2}
            {@const isLast = i === fleet.scoreHistory.length - 1}
            <div
              class="sparkline-bar"
              style="height: {barHeight}%; background: {isLast ? 'var(--bo-amber)' : 'var(--bo-violet)'};"
            ></div>
          {/each}
        </div>
        <span class="sparkline-caption">Last {fleet.scoreHistory.length} days</span>
      {:else}
        <span class="sparkline-caption">Not enough data for trend</span>
      {/if}
    </div>
  </div>
{/if}

<!-- Section 2: Agent List -->
{#if agents.length > 0}
  <div class="agent-list">
    {#each agents as agent}
      <a href="/evolution/{agent.botId}" class="agent-row">
        <span class="agent-id">{agent.botId.slice(0, 8)}</span>
        <span
          class="agent-class-badge"
          style="color: {CLASS_COLORS[agent.currentClass] ?? 'var(--bo-muted)'};"
        >{agent.currentClass.toUpperCase()}</span>
        <span class="agent-score">
          {agent.compositeScore ? parseFloat(agent.compositeScore).toFixed(2) : '—'}
        </span>
        {#if agent.isPioneer}
          <span class="pioneer-badge">PIONEER</span>
        {/if}
      </a>
    {/each}
  </div>
{/if}

<style>
  @keyframes pulse-skeleton {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
  }

  /* Class Distribution Grid */
  .class-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
  }

  .class-cell {
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    transition: transform 0.15s ease, border-color 0.15s ease;
  }

  .class-cell:hover {
    transform: translateY(-1px);
  }

  .class-cell.artisan {
    border-color: rgba(251, 191, 36, 0.32);
  }

  .class-cell.retired {
    opacity: 0.6;
  }

  .class-count {
    font-family: var(--font-label);
    font-size: 20px;
    line-height: 1;
    display: block;
  }

  .class-name {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    display: block;
  }

  /* Skeleton */
  .skeleton-grid {
    margin-bottom: var(--space-xl);
  }

  .skeleton-cell {
    background: var(--bo-card);
    border-radius: var(--radius-sm);
    height: 90px;
    animation: pulse-skeleton 1.2s ease-in-out infinite;
    border: none;
  }

  /* Empty state */
  .empty-state {
    padding: var(--space-2xl);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    text-align: center;
    margin-bottom: var(--space-xl);
  }

  .empty-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-sm);
  }

  .empty-body {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
  }

  /* Score trend */
  .score-trend {
    display: flex;
    align-items: flex-end;
    gap: var(--space-xl);
    margin-bottom: var(--space-xl);
    padding: var(--space-lg);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
  }

  .score-current {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .score-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-caption);
    display: block;
  }

  .score-value {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-text);
    display: block;
  }

  .sparkline-wrap {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-xs);
  }

  .sparkline {
    display: flex;
    align-items: flex-end;
    gap: 1px;
    height: 32px;
  }

  .sparkline-bar {
    width: 3px;
    border-radius: 1px 1px 0 0;
    min-height: 2px;
    flex-shrink: 0;
  }

  .sparkline-caption {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-caption);
  }

  /* Agent list */
  .agent-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .agent-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    text-decoration: none;
    transition: background 0.15s ease;
  }

  .agent-row:hover {
    background: rgba(236, 232, 255, 0.04);
  }

  .agent-id {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-text);
  }

  .agent-class-badge {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
  }

  .agent-score {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-muted);
    margin-left: auto;
  }

  .pioneer-badge {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-amber);
    background: rgba(251, 191, 36, 0.10);
    border: 1px solid rgba(251, 191, 36, 0.32);
    padding: 3px 7px;
    border-radius: 3px;
  }
</style>
