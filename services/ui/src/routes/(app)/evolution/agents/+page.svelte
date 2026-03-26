<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="agents-page">
  <h1 class="page-title">Agent Fleet</h1>

  {#if data.agents.length === 0}
    <div class="empty-state">
      <p class="empty-title">No agents yet</p>
      <p class="empty-body">Run an execution to start building your fleet.</p>
    </div>
  {:else}
    <div class="agent-list">
      {#each data.agents as agent}
        <a href="/evolution/{agent.botId}" class="agent-row">
          <span class="agent-id">{agent.botId.slice(0, 8)}</span>
          <span class="agent-class badge-{agent.currentClass.toLowerCase()}">{agent.currentClass}</span>
          <span class="agent-category">{agent.taskCategory ?? '—'}</span>
          {#if agent.compositeScore}
            <span class="agent-score">{parseFloat(agent.compositeScore).toFixed(2)}</span>
          {:else}
            <span class="agent-score muted">—</span>
          {/if}
          {#if agent.isPioneer}
            <span class="pioneer-badge">PIONEER</span>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .agents-page {
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
    flex-shrink: 0;
    min-width: 80px;
  }

  .agent-class {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    padding: 2px 6px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .badge-novice     { color: var(--bo-faint); background: rgba(124, 58, 237, 0.08); }
  .badge-understudy { color: var(--bo-violet); background: rgba(124, 58, 237, 0.15); }
  .badge-artisan    { color: var(--bo-amber); background: rgba(245, 158, 11, 0.15); }
  .badge-retired    { color: var(--bo-faint); background: rgba(255, 255, 255, 0.05); }

  .agent-category {
    font-size: 12px;
    color: var(--bo-faint);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .agent-score {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--bo-text);
    flex-shrink: 0;
  }

  .agent-score.muted {
    color: var(--bo-faint);
  }

  .pioneer-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-amber);
    border: 1px solid var(--bo-amber);
    padding: 1px 4px;
    border-radius: 2px;
    flex-shrink: 0;
  }
</style>
