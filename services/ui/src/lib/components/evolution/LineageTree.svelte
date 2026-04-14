<script lang="ts">
  import { hierarchy, tree } from 'd3-hierarchy';

  interface SoulNode {
    id: string;
    label: string;
    generation: number;
    isArchetype: boolean;
    isPioneer: boolean;
    parentSoulId: string | null;
    children?: SoulNode[];
  }

  let { nodes, ondiffnode }: { nodes: SoulNode[]; ondiffnode?: (childId: string, parentId: string) => void } = $props();
  let selectedNode: SoulNode | null = $state(null);

  const WIDTH = 480;
  const HEIGHT = 240;
  const NODE_R = 10;

  function buildTree(chain: SoulNode[]): SoulNode {
    if (chain.length === 0) {
      return { id: 'empty', label: '—', generation: 0, isArchetype: false, isPioneer: false, parentSoulId: null };
    }
    const root: SoulNode = { ...chain[0], children: [] };
    let current = root;
    for (let i = 1; i < chain.length; i++) {
      const item = chain[i];
      if (!item) break;
      const child: SoulNode = { ...item, children: [] };
      current.children = [child];
      current = child;
    }
    return root;
  }

  const treeRoot = $derived(buildTree(nodes));

  const layout = $derived.by(() => {
    const h = hierarchy(treeRoot);
    const t = tree<SoulNode>().size([WIDTH - 40, HEIGHT - 60]);
    t(h);
    return h;
  });

  const descendants = $derived(layout.descendants());
  const links = $derived(layout.links());

  function handleNodeClick(node: SoulNode) {
    if (node.data.parentSoulId && ondiffnode) {
      ondiffnode(node.data.id, node.data.parentSoulId);
    } else {
      selectedNode = selectedNode?.id === node.data.id ? null : node;
    }
  }

  function handleNodeKeydown(event: KeyboardEvent, node: SoulNode) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNodeClick(node);
    }
  }

  function handleViewDiffClick(node: SoulNode, e: MouseEvent) {
    e.stopPropagation();
    if (node.parentSoulId && ondiffnode) {
      ondiffnode(node.id, node.parentSoulId);
    }
  }

  let tooltipId = $derived(`lineage-tooltip-${nodes[0]?.id ?? 'root'}`);
</script>

{#if nodes.length > 0}
  <div class="lineage-tree-container">
    <svg
      width={WIDTH}
      height={HEIGHT}
      class="lineage-tree"
      role="img"
      aria-label="Soul lineage tree"
      style="overflow: visible;"
    >
      <g transform="translate(20,30)">
        <!-- Links -->
        {#each links as link (link.target.data.id)}
          <line
            class="tree-link"
            x1={link.source.x}
            y1={link.source.y}
            x2={link.target.x}
            y2={link.target.y}
          />
        {/each}

        <!-- Nodes -->
        {#each descendants as node (node.data.id)}
          <g
            class="tree-node"
            class:archetype={node.data.isArchetype}
            class:pioneer={node.data.isPioneer}
            transform="translate({node.x},{node.y})"
            role="button"
            tabindex="0"
            onclick={() => handleNodeClick(node.data)}
            onkeydown={(e) => handleNodeKeydown(e, node.data)}
            aria-describedby={selectedNode?.id === node.data.id ? tooltipId : undefined}
          >
            <circle r={NODE_R} />
            <text dy="1.4em" text-anchor="middle" class="node-label">{node.data.label}</text>
          </g>
        {/each}
      </g>
    </svg>

    <!-- Inline tooltip for selected node -->
    {#if selectedNode !== null}
      <div class="node-tooltip" role="tooltip" id={tooltipId}>
        <p class="tooltip-label">{selectedNode.label}</p>
        <p class="tooltip-gen">Generation {selectedNode.generation}</p>
        {#if selectedNode.isArchetype}
          <span class="tooltip-tag archetype-tag">Archetype</span>
        {/if}
        {#if selectedNode.isPioneer}
          <span class="tooltip-tag pioneer-tag">Pioneer</span>
        {/if}
        {#if selectedNode !== null}
          {#if selectedNode.parentSoulId && ondiffnode}
            <button class="view-diff-btn" onclick={(e) => handleViewDiffClick(selectedNode, e)}>
              View Diff
            </button>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .lineage-tree-container {
    position: relative;
    display: inline-block;
  }

  .lineage-tree {
    overflow: visible;
  }

  .tree-link {
    stroke: var(--border);
    stroke-width: 1px;
  }

  .tree-node circle {
    fill: var(--card);
    stroke: var(--accent-m);
    stroke-width: 1.5px;
    cursor: pointer;
    transition: stroke 0.15s;
  }

  .tree-node:hover circle,
  .tree-node:focus circle {
    stroke: var(--accent);
    outline: none;
  }

  .tree-node:focus {
    outline: none;
  }

  .tree-node.archetype circle {
    stroke: var(--karma);
  }

  .tree-node.pioneer circle {
    stroke: var(--karma);
    fill: rgba(251, 191, 36, 0.15);
  }

  .node-label {
    font-family: var(--font-label);
    font-size: 6px;
    fill: var(--text-muted);
    pointer-events: none;
  }

  .node-tooltip {
    position: absolute;
    top: 0;
    right: 0;
    background: var(--card);
    border: 1px solid var(--accent-m);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    min-width: 140px;
    z-index: 10;
    pointer-events: none;
  }

  .tooltip-label {
    font-size: 13px;
    color: var(--text);
    margin: 0 0 var(--space-xs);
    font-family: var(--font-body);
  }

  .tooltip-gen {
    font-size: 11px;
    color: var(--text-muted);
    margin: 0 0 var(--space-sm);
    font-family: var(--font-body);
  }

  .tooltip-tag {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    padding: 2px 6px;
    border-radius: 3px;
    display: inline-block;
    margin-right: var(--space-xs);
  }

  .archetype-tag {
    color: var(--karma);
    border: 1px solid rgba(251, 191, 36, 0.32);
    background: rgba(251, 191, 36, 0.10);
  }

  .pioneer-tag {
    color: var(--karma);
    border: 1px solid rgba(251, 191, 36, 0.32);
    background: rgba(251, 191, 36, 0.10);
  }

  .view-diff-btn {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--accent);
    background: none;
    border: 1px solid var(--accent);
    border-radius: 3px;
    padding: 3px 8px;
    cursor: pointer;
    margin-top: var(--space-sm);
    transition: background 0.15s;
  }

  .view-diff-btn:hover {
    background: rgba(139, 92, 246, 0.10);
  }
</style>
