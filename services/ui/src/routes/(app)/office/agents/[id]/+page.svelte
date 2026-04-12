<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function getStatusLabel(status: string | null | undefined): string {
    switch (status) {
      case 'working': return 'working';
      case 'complete':
      case 'done': return 'done';
      default: return 'idle';
    }
  }

  function getStatusColor(status: string | null | undefined): string {
    switch (status) {
      case 'working': return 'var(--fo-gold)';
      case 'complete':
      case 'done': return 'var(--bo-teal)';
      default: return 'var(--text-muted)';
    }
  }

  function getTierLabel(adapter: string | null | undefined): string {
    if (!adapter) return '';
    if (adapter.includes('haiku') || adapter.includes('junior')) return 'JUNIOR';
    if (adapter.includes('sonnet') || adapter.includes('mid')) return 'MID';
    if (adapter.includes('opus') || adapter.includes('senior')) return 'SENIOR';
    return adapter.toUpperCase();
  }

  function getTierColor(adapter: string | null | undefined): string {
    if (!adapter) return 'var(--text-muted)';
    if (adapter.includes('haiku') || adapter.includes('junior')) return 'var(--tier-junior)';
    if (adapter.includes('sonnet') || adapter.includes('mid')) return 'var(--tier-mid)';
    if (adapter.includes('opus') || adapter.includes('senior')) return 'var(--tier-senior)';
    return 'var(--text-muted)';
  }
</script>

<div class="agent-detail">
  <div class="back-row">
    <a href="/office/agents" class="back-link">&larr; Agents</a>
  </div>

  <div class="agent-header">
    <h1 class="agent-name">{data.agent.name}</h1>
    <div class="agent-badges">
      <span class="status-badge" style="color: {getStatusColor(data.agent.status)}">
        <span class="status-dot" style="background: {getStatusColor(data.agent.status)}"></span>
        {getStatusLabel(data.agent.status)}
      </span>
      {#if data.agent.adapter}
        <span class="tier-badge" style="color: {getTierColor(data.agent.adapter)}">
          {getTierLabel(data.agent.adapter)}
        </span>
      {/if}
    </div>
  </div>

  {#if data.agent.description}
    <div class="agent-section">
      <span class="section-eyebrow">DESCRIPTION</span>
      <p class="agent-description">{data.agent.description}</p>
    </div>
  {/if}

  <div class="agent-meta">
    <div class="meta-row">
      <span class="meta-label">Adapter</span>
      <span class="meta-value">{data.agent.adapter ?? '—'}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Created</span>
      <span class="meta-value">{new Date(data.agent.createdAt).toLocaleDateString()}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Last updated</span>
      <span class="meta-value">{new Date(data.agent.updatedAt).toLocaleDateString()}</span>
    </div>
  </div>
</div>

<style>
  .agent-detail {
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

  .agent-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-lg);
    margin-bottom: var(--space-xl);
    flex-wrap: wrap;
  }

  .agent-name {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--fo-plum);
    line-height: 1.2;
    margin: 0;
  }

  .agent-badges {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-body);
    font-size: 13px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tier-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
  }

  .agent-section {
    margin-bottom: var(--space-xl);
  }

  .section-eyebrow {
    font-family: var(--font-label);
    font-size: 6px;
    color: var(--text-muted);
    letter-spacing: 0.10em;
    display: block;
    margin-bottom: var(--space-sm);
  }

  .agent-description {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.8;
    color: inherit;
    margin: 0;
  }

  .agent-meta {
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

  .agent-name {
    color: var(--text);
  }

  .agent-meta {
    border-top-color: var(--border);
  }
</style>
