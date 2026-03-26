<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="fleet-page">
  <h1 class="page-title">Fleet Overview</h1>

  {#if !data.fleet || data.fleet.totalBots === 0}
    <div class="empty-state">
      <p class="empty-title">No agents yet</p>
      <p class="empty-body">Run an execution to start building your fleet.</p>
    </div>
  {:else}
    <div class="class-grid">
      {#each Object.entries(data.fleet.classCounts) as [cls, count]}
        <div class="class-card">
          <span class="class-label">{cls}</span>
          <span class="class-count">{count}</span>
        </div>
      {/each}
    </div>

    {#if data.fleet.averageCompositeScore}
      <div class="stat-row">
        <span class="stat-label">Avg Composite Score</span>
        <span class="stat-value">{parseFloat(data.fleet.averageCompositeScore).toFixed(2)}</span>
      </div>
    {/if}
  {/if}

  {#if data.pendingVerdicts.length > 0}
    <section class="pending-section">
      <h2 class="section-title">Awaiting Your Decision</h2>
      <ul class="pending-list">
        {#each data.pendingVerdicts as verdict}
          <li class="pending-item">
            <span class="pending-type">{verdict.verdictType}</span>
            <span class="pending-summary">{verdict.verdictSummary}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if data.agents.length > 0}
    <section class="agents-section">
      <h2 class="section-title">Agents</h2>
      <div class="agent-list">
        {#each data.agents as agent}
          <a href="/evolution/{agent.botId}" class="agent-row">
            <span class="agent-id">{agent.botId.slice(0, 8)}</span>
            <span class="agent-class badge-{agent.currentClass.toLowerCase()}">{agent.currentClass}</span>
            {#if agent.compositeScore}
              <span class="agent-score">{parseFloat(agent.compositeScore).toFixed(2)}</span>
            {/if}
            {#if agent.isPioneer}
              <span class="pioneer-badge">PIONEER</span>
            {/if}
          </a>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .fleet-page {
    max-width: 900px;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-xl);
  }

  .empty-state {
    padding: var(--space-2xl);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .empty-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-sm);
  }

  .empty-body {
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
  }

  .class-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
  }

  .class-card {
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .class-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
  }

  .class-count {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 600;
    color: var(--bo-text);
  }

  .stat-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
  }

  .stat-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
  }

  .stat-value {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--bo-violet);
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-md);
  }

  .pending-section,
  .agents-section {
    margin-bottom: var(--space-xl);
  }

  .pending-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .pending-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
  }

  .pending-type {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-amber);
  }

  .pending-summary {
    font-size: 13px;
    color: var(--bo-text);
  }

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
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--bo-faint);
  }

  .agent-class {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .badge-novice     { color: var(--bo-faint); background: rgba(124, 58, 237, 0.08); }
  .badge-understudy { color: var(--bo-violet); background: rgba(124, 58, 237, 0.15); }
  .badge-artisan    { color: var(--bo-amber); background: rgba(245, 158, 11, 0.15); }
  .badge-retired    { color: var(--bo-faint); background: rgba(255, 255, 255, 0.05); }

  .agent-score {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--bo-text);
    margin-left: auto;
  }

  .pioneer-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-amber);
    border: 1px solid var(--bo-amber);
    padding: 1px 4px;
    border-radius: 2px;
  }
</style>
