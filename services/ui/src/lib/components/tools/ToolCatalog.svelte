<script lang="ts">
  import { TOOL_CATALOG, TOOL_CATEGORIES } from '$lib/tool-catalog';
  import ToolCard from './ToolCard.svelte';

  let {
    connections,
    onconnect,
    ondisconnect,
  }: {
    connections: Array<{ id: string; toolId: string; status: string; lastUsedAt: string | null }>;
    onconnect: (toolId: string) => void;
    ondisconnect: (connectionId: string, toolName: string) => void;
  } = $props();

  const connectedMap = $derived(new Map(connections.map(c => [c.toolId, c])));
</script>

{#each TOOL_CATEGORIES as category}
  <section class="category-section">
    <h2 class="category-heading">{category}</h2>
    <div class="tool-grid">
      {#each TOOL_CATALOG.filter(t => t.category === category) as tool}
        <ToolCard
          {tool}
          connection={connectedMap.get(tool.id) ?? null}
          {onconnect}
          {ondisconnect}
        />
      {/each}
    </div>
  </section>
{/each}

<style>
  .category-section + .category-section {
    margin-top: var(--space-xl);
  }

  .category-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-md) 0;
    line-height: 1.2;
  }

  .tool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-md);
  }
</style>
