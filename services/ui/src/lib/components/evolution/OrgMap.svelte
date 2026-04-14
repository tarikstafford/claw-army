<script lang="ts">
  import { hierarchy, tree } from 'd3-hierarchy';
  import { goto } from '$app/navigation';

  interface OrgNode {
    id: string;
    label: string;
    type: 'fleet' | 'category' | 'class_tier' | 'agent';
    botId?: string;
    currentClass?: string;
    compositeScore?: string | null;
    status?: string;
    children?: OrgNode[];
  }

  let { data }: { data: OrgNode } = $props();

  const WIDTH = 900;
  const NODE_R = 8;
  const CLASS_COLORS: Record<string, string> = {
    Artisan: 'var(--karma)',
    Understudy: 'var(--accent-m)',
    Novice: 'var(--text-muted)',
    Retired: 'var(--muted)',
  };

  const treeHeight = $derived.by(() => {
    const h = hierarchy(data);
    return Math.max(300, h.leaves().length * 28);
  });

  const layout = $derived.by(() => {
    const h = hierarchy(data);
    const t = tree<OrgNode>().size([treeHeight - 40, WIDTH - 200]);
    t(h);
    return h;
  });

  const descendants = $derived(layout.descendants());
  const links = $derived(layout.links());

  function handleAgentClick(node: OrgNode) {
    if (node.type === 'agent' && node.botId) {
      void goto(`/evolution/${node.botId}`);
    }
  }

  function handleAgentKeydown(event: KeyboardEvent, node: OrgNode) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleAgentClick(node);
    }
  }

  function getNodeFill(node: OrgNode): string {
    if (node.type === 'category') return 'var(--accent)';
    return 'var(--card)';
  }

  function getNodeStroke(node: OrgNode): string {
    if (node.type === 'category') return 'var(--accent)';
    if (node.type === 'class_tier') {
      return CLASS_COLORS[node.label] ?? 'var(--border)';
    }
    if (node.type === 'agent') {
      return CLASS_COLORS[node.currentClass ?? ''] ?? 'var(--border)';
    }
    return 'var(--border)';
  }

  function getNodeRadius(node: OrgNode): number {
    if (node.type === 'category') return 10;
    if (node.type === 'class_tier') return NODE_R;
    if (node.type === 'agent') return 6;
    return 5;
  }

  function truncateLabel(label: string, maxLen = 8): string {
    return label.length > maxLen ? label.slice(0, maxLen) + '…' : label;
  }

  const hasChildren = $derived(data.children && data.children.length > 0);
</script>

{#if !hasChildren}
  <div class="org-empty-state">
    <p class="org-empty-text">No agents in fleet</p>
  </div>
{:else}
  <div class="org-map-container">
    <svg
      width={WIDTH}
      height={treeHeight}
      class="org-map-svg"
      role="img"
      aria-label="Fleet organisation map"
      style="overflow: visible;"
    >
      <g transform="translate(100, 20)">
        <!-- Links as cubic bezier paths -->
        {#each links as link (link.target.data.id)}
          <path
            class="org-link"
            d="M{link.source.y},{link.source.x} C{(link.source.y + link.target.y) / 2},{link.source.x} {(link.source.y + link.target.y) / 2},{link.target.x} {link.target.y},{link.target.x}"
          />
        {/each}

        <!-- Nodes -->
        {#each descendants as node (node.data.id)}
          {#if node.data.type === 'fleet'}
            <!-- Fleet root: just a small label, no circle -->
            <g transform="translate({node.y},{node.x})">
              <text
                class="fleet-label"
                text-anchor="middle"
                dy="0.35em"
              >{node.data.label}</text>
            </g>
          {:else if node.data.type === 'category'}
            <!-- Category node: filled violet circle, label to the left -->
            <g
              class="org-node category-node"
              transform="translate({node.y},{node.x})"
            >
              <circle
                r={getNodeRadius(node.data)}
                fill={getNodeFill(node.data)}
                stroke={getNodeStroke(node.data)}
                stroke-width="1.5"
              />
              <text
                class="category-label"
                text-anchor="end"
                dx="-14"
                dy="0.35em"
              >{node.data.label}</text>
            </g>
          {:else if node.data.type === 'class_tier'}
            <!-- Class tier node: circle stroke-colored by class, label above -->
            <g
              class="org-node class-tier-node"
              transform="translate({node.y},{node.x})"
            >
              <circle
                r={getNodeRadius(node.data)}
                fill={getNodeFill(node.data)}
                stroke={getNodeStroke(node.data)}
                stroke-width="1.5"
              />
              <text
                class="tier-label"
                text-anchor="middle"
                dy="-12"
              >{node.data.label}</text>
            </g>
          {:else if node.data.type === 'agent'}
            <!-- Agent node: clickable, stroke-colored by class, label to the right -->
            <g
              class="org-node agent-node"
              transform="translate({node.y},{node.x})"
              role="button"
              tabindex="0"
              onclick={() => handleAgentClick(node.data)}
              onkeydown={(e) => handleAgentKeydown(e, node.data)}
              aria-label="Navigate to agent {node.data.botId}"
            >
              <circle
                r={getNodeRadius(node.data)}
                fill={getNodeFill(node.data)}
                stroke={getNodeStroke(node.data)}
                stroke-width="1.5"
              />
              <text
                class="agent-label"
                text-anchor="start"
                dx="12"
                dy="0.35em"
              >{truncateLabel(node.data.label)}{node.data.compositeScore ? ` ${parseFloat(node.data.compositeScore).toFixed(1)}` : ''}</text>
            </g>
          {/if}
        {/each}
      </g>
    </svg>
  </div>
{/if}

<style>
  .org-map-container {
    overflow-x: auto;
    padding: var(--space-md) 0;
  }

  .org-map-svg {
    overflow: visible;
    display: block;
  }

  .org-link {
    fill: none;
    stroke: var(--border);
    stroke-width: 1;
  }

  .fleet-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    fill: var(--muted);
    pointer-events: none;
  }

  .category-label {
    font-family: var(--font-display);
    font-size: 14px;
    fill: var(--text);
    pointer-events: none;
  }

  .tier-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    fill: var(--text-muted);
    pointer-events: none;
  }

  .agent-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
    fill: var(--text-muted);
    pointer-events: none;
  }

  .agent-node {
    cursor: pointer;
  }

  .agent-node:hover circle,
  .agent-node:focus circle {
    opacity: 0.8;
  }

  .agent-node:focus {
    outline: none;
  }

  .org-empty-state {
    padding: var(--space-2xl);
    text-align: center;
  }

  .org-empty-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }
</style>
