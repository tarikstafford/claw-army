<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'active': return 'active';
      case 'completed': return 'completed';
      case 'paused': return 'paused';
      default: return status.toLowerCase();
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'var(--fo-gold, #B8965A)';
      case 'completed': return 'var(--bo-teal, #2DD4BF)';
      case 'paused': return 'var(--text-muted)';
      default: return 'var(--text-muted)';
    }
  }
</script>

<div class="goals-page">
  <div class="page-header">
    <h1 class="page-title">Goals</h1>
  </div>

  {#if data.goals.length === 0}
    <div class="empty-state" aria-busy="false">
      <span class="empty-eyebrow">NO GOALS</span>
      <p class="empty-heading">Nothing here yet.</p>
      <p class="empty-body">No goals yet. Create a goal to track your crew's objectives.</p>
    </div>
  {:else}
    <div class="goals-list">
      {#each data.goals as goal}
        <a href="/office/goals/{goal.id}" class="goal-card">
          <div class="goal-card-top">
            <span class="goal-status" style="color: {getStatusColor(goal.status)}">{getStatusLabel(goal.status)}</span>
          </div>
          <h3 class="goal-title">{goal.title}</h3>
          {#if goal.description}
            <p class="goal-desc">{goal.description}</p>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .goals-page {
    max-width: 900px;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-xl);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(26px, 3.5vw, 38px);
    font-weight: 600;
    line-height: 1.1;
    color: var(--fo-plum);
    margin: 0;
  }

  .goals-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .goal-card {
    display: block;
    padding: var(--space-lg);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, transform 0.15s;
  }

  .goal-card:hover {
    border-color: var(--fo-plum-m);
    transform: translateY(-1px);
  }

  .goal-card-top {
    margin-bottom: var(--space-sm);
  }

  .goal-status {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
  }

  .goal-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--fo-plum);
    margin: 0 0 var(--space-sm);
  }

  .goal-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
    padding: var(--space-3xl) 0;
  }

  .empty-eyebrow {
    font-family: var(--font-label);
    font-size: 6px;
    color: var(--text-muted);
    letter-spacing: 0.10em;
  }

  .empty-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .empty-body {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

</style>
