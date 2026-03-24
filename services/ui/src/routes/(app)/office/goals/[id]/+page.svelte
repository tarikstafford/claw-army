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

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<div class="goal-detail">
  <div class="back-row">
    <a href="/office/goals" class="back-link">&larr; Goals</a>
  </div>

  <div class="goal-header">
    <h1 class="goal-name">{data.goal.title}</h1>
    <span class="status-badge" style="color: {getStatusColor(data.goal.status)}">
      {getStatusLabel(data.goal.status)}
    </span>
  </div>

  {#if data.goal.description}
    <div class="goal-description t-body">
      {data.goal.description}
    </div>
  {/if}

  <div class="goal-meta">
    <div class="meta-row">
      <span class="meta-label">Status</span>
      <span class="meta-value" style="color: {getStatusColor(data.goal.status)}">{getStatusLabel(data.goal.status)}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Created</span>
      <span class="meta-value">{formatDate(data.goal.createdAt)}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Last updated</span>
      <span class="meta-value">{formatDate(data.goal.updatedAt)}</span>
    </div>
  </div>
</div>

<style>
  .goal-detail {
    max-width: 800px;
  }

  .back-row {
    margin-bottom: var(--space-xl);
  }

  .back-link {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.15s;
  }

  .back-link:hover {
    color: var(--fo-plum);
  }

  .goal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-lg);
    margin-bottom: var(--space-xl);
    flex-wrap: wrap;
  }

  .goal-name {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--fo-plum);
    margin: 0;
    flex: 1;
  }

  .status-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
  }

  .goal-description {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.8;
    margin-bottom: var(--space-xl);
  }

  .goal-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    border-top: 1px solid var(--fo-border);
    padding-top: var(--space-xl);
  }

  .meta-row {
    display: flex;
    gap: var(--space-xl);
  }

  .meta-label {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    width: 120px;
    flex-shrink: 0;
  }

  .meta-value {
    font-family: var(--font-body);
    font-size: 13px;
  }

  :global(body.back-office) .back-link:hover {
    color: var(--bo-vb);
  }

  :global(body.back-office) .goal-name {
    color: var(--bo-text);
  }

  :global(body.back-office) .goal-meta {
    border-top-color: var(--bo-border);
  }
</style>
