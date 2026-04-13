<script lang="ts">
  import MechanicCard from '$lib/components/MechanicCard.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
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

  {#if !data.agents}
    <div class="skeleton-grid">
      <LoadingSkeleton type="card" />
      <LoadingSkeleton type="card" />
      <LoadingSkeleton type="card" />
    </div>
  {:else if data.agents.length === 0}
    <EmptyState
      icon="◈"
      eyebrow="NO AGENTS"
      title="No agents yet."
      description="Add your first agent to start building your crew."
      ctaLabel="Add agent"
      href="/office/agents/new"
      variant="front-office"
    />
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
    color: #fff;
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

  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-xl);
  }
</style>
