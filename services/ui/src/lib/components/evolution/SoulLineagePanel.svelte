<script lang="ts">
  import LineageTree from '$lib/components/evolution/LineageTree.svelte';

  interface SoulNode {
    id: string;
    label: string;
    generation: number;
    isArchetype: boolean;
    isPioneer: boolean;
    parentSoulId: string | null;
    children?: SoulNode[];
  }

  interface SoulContent {
    id: string;
    soulContent: string | null;
    archetypeName: string | null;
    generation: number;
  }

  let { nodes }: { nodes: SoulNode[] } = $props();

  let selectedNodeId = $state<string | null>(null);
  let soulContentMap = $state<Record<string, SoulContent>>({});
  let loadingContent = $state(false);

  const selectedNode = $derived(
    selectedNodeId ? nodes.find(n => n.id === selectedNodeId) ?? null : null
  );

  const selectedSoulContent = $derived(
    selectedNodeId ? soulContentMap[selectedNodeId] ?? null : null
  );

  function parseSoulSections(content: string): Array<{ header: string; body: string }> {
    const parts = content.split(/^## /m);
    return parts
      .filter(p => p.trim())
      .map(p => {
        const newlineIdx = p.indexOf('\n');
        if (newlineIdx === -1) return { header: p.trim(), body: '' };
        return {
          header: p.slice(0, newlineIdx).trim(),
          body: p.slice(newlineIdx + 1).trim(),
        };
      });
  }

  const soulSections = $derived(
    selectedSoulContent?.soulContent
      ? parseSoulSections(selectedSoulContent.soulContent)
      : []
  );

  async function handleNodeClick(childId: string, parentId: string) {
    if (childId === selectedNodeId) {
      selectedNodeId = null;
      return;
    }
    selectedNodeId = childId;
    if (!soulContentMap[childId]) {
      await loadSoulContent(childId);
    }
  }

  async function loadSoulContent(soulId: string) {
    loadingContent = true;
    try {
      const res = await fetch(`/api/akasa/souls/${soulId}`);
      if (res.ok) {
        const content = await res.json() as SoulContent;
        soulContentMap = { ...soulContentMap, [soulId]: content };
      }
    } catch { /* silent */ }
    finally {
      loadingContent = false;
    }
  }

  function formatDate(ts: string): string {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
</script>

<div class="soul-lineage-panel">
  <div class="lineage-section">
    <h3 class="section-title">Lineage Tree</h3>
    {#if nodes.length > 0}
      <div class="lineage-container">
        <LineageTree {nodes} ondiffnode={handleNodeClick} />
      </div>
    {:else}
      <p class="no-data-text">No lineage data available</p>
    {/if}
  </div>

  {#if selectedNode}
    <div class="soul-content-section">
      <div class="soul-header">
        <h3 class="section-title">
          {selectedNode.isArchetype ? selectedNode.label : `Generation ${selectedNode.generation}`}
        </h3>
        {#if selectedNode.isArchetype}
          <span class="archetype-tag">ARCHETYPE</span>
        {/if}
        {#if selectedNode.isPioneer}
          <span class="pioneer-tag">PIONEER</span>
        {/if}
      </div>

      {#if loadingContent}
        <div class="soul-loading">
          <p class="loading-text">Loading soul content...</p>
        </div>
      {:else if selectedSoulContent?.soulContent}
        <div class="soul-viewer">
          {#if soulSections.length === 0}
            <p class="soul-body-text">{selectedSoulContent.soulContent}</p>
          {:else}
            {#each soulSections as section}
              <div class="soul-section-block">
                <h4 class="soul-section-header">{section.header}</h4>
                {#if section.body}
                  <p class="soul-body-text">{section.body}</p>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      {:else}
        <p class="no-data-text">No soul document available for this node</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .soul-lineage-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-md);
  }

  .lineage-container {
    background: var(--bo-card);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    overflow-x: auto;
  }

  .soul-content-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .soul-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .archetype-tag,
  .pioneer-tag {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    padding: 2px 6px;
    border-radius: 3px;
    display: inline-block;
  }

  .archetype-tag {
    color: var(--bo-amber);
    border: 1px solid rgba(251, 191, 36, 0.32);
    background: rgba(251, 191, 36, 0.10);
  }

  .pioneer-tag {
    color: var(--bo-teal);
    border: 1px solid rgba(45, 212, 191, 0.32);
    background: rgba(45, 212, 191, 0.10);
  }

  .soul-loading {
    padding: var(--space-lg);
    text-align: center;
  }

  .loading-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
  }

  .soul-viewer {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
  }

  .soul-section-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .soul-section-header {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 600;
    color: var(--bo-violet);
    margin: 0;
  }

  .soul-body-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-muted);
    white-space: pre-wrap;
    margin: 0;
    line-height: 1.7;
  }

  .no-data-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-faint);
    padding: var(--space-xl);
    text-align: center;
    margin: 0;
  }
</style>
