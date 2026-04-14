<script lang="ts">
  import MechanicCard from '$lib/components/MechanicCard.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function getStatusTag(status: string | null | undefined): string {
    switch (status) {
      case 'working': return 'WORKING';
      case 'complete':
      case 'done': return 'DONE';
      default: return 'IDLE';
    }
  }

  function getAdapterLabel(adapter: string | null | undefined): string {
    if (!adapter) return '';
    return adapter.toUpperCase();
  }
</script>

<div class="agents-page">
  <div class="page-header">
    <h1 class="page-title">Agents</h1>
    <a href="/office/agents/new" class="btn-primary">Add agent</a>
  </div>

  {#if data.agents.length === 0}
    <div class="empty-state" aria-busy="false">
      <span class="empty-eyebrow">NO AGENTS</span>
      <p class="empty-heading">No agents yet.</p>
      <p class="empty-body">No agents yet. Add your first agent to start working.</p>
      <a href="/office/agents/new" class="btn-primary">Add agent</a>
    </div>
  {:else}
    <div class="agents-grid">
      {#each data.agents as agent}
        <a href="/office/agents/{agent.id}" class="agent-card-link">
          <MechanicCard
            tag={getStatusTag(agent.status)}
            title={agent.name}
            summary={agent.description ?? getAdapterLabel(agent.adapter)}
            ctaLabel="VIEW AGENT →"
          />
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .agents-page {
    max-width: 1200px;
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

  .btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 10px 18px;
    background: var(--fo-plum);
    color: white;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    border-radius: var(--radius-md);
    transition: background 0.15s;
    border: none;
    cursor: pointer;
  }

  .btn-primary:hover {
    background: var(--fo-plum-m);
  }

  .agents-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-xl);
  }

  .agent-card-link {
    text-decoration: none;
    display: block;
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
    color: var(--fo-plum);
    margin: 0;
  }

  .empty-body {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .page-title,
  .empty-heading {
    color: var(--text);
  }
</style>
