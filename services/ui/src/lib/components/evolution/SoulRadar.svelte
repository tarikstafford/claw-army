<script lang="ts">
  const CENTER = 80;
  const RADIUS = 60;
  const AXES = 7;
  const DIMENSION_KEYS = [
    'identityRole', 'decisionPriorities', 'toolUsageDoctrine',
    'riskTolerance', 'communicationStyle', 'recoveryBehavior', 'ethicalHardStops'
  ];
  const DIMENSION_LABELS = [
    'Identity', 'Decisions', 'Tool Use',
    'Risk', 'Comms', 'Recovery', 'Ethics'
  ];

  let { dimensions }: { dimensions: Record<string, string> | null } = $props();

  const scores = $derived(
    DIMENSION_KEYS.map(k => dimensions ? Math.min((dimensions[k]?.length ?? 0) / 500, 1) : 0)
  );

  const points = $derived(
    scores.map((score, i) => {
      const angle = (i / AXES) * 2 * Math.PI - Math.PI / 2;
      const r = score * RADIUS;
      return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
    })
  );

  const polygonPoints = $derived(points.map(p => `${p.x},${p.y}`).join(' '));

  const axisEndpoints = $derived(
    DIMENSION_KEYS.map((_, i) => {
      const angle = (i / AXES) * 2 * Math.PI - Math.PI / 2;
      return { x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
    })
  );

  const outerPolygon = $derived(axisEndpoints.map(p => `${p.x},${p.y}`).join(' '));

  function labelOffset(ep: { x: number; y: number }): { x: number; y: number } {
    const dx = ep.x - CENTER;
    const dy = ep.y - CENTER;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      x: ep.x + (dx / len) * 14,
      y: ep.y + (dy / len) * 14,
    };
  }
</script>

<div class="soul-radar">
  <svg width="160" height="180" viewBox="0 0 160 180" aria-label="Soul dimension radar chart">
    {#if dimensions === null}
      <text x="80" y="90" text-anchor="middle" font-size="10" fill="rgba(236,232,255,0.42)">No soul data</text>
    {:else}
      <!-- Axis lines -->
      {#each axisEndpoints as ep}
        <line
          x1={CENTER}
          y1={CENTER}
          x2={ep.x}
          y2={ep.y}
          stroke="var(--border)"
          stroke-width="1"
        />
      {/each}

      <!-- Outer bounding polygon -->
      <polygon
        points={outerPolygon}
        fill="none"
        stroke="var(--border)"
        stroke-width="1"
      />

      <!-- Data polygon -->
      <polygon
        points={polygonPoints}
        fill="rgba(124, 58, 237, 0.15)"
        stroke="var(--accent)"
        stroke-width="1.5"
      />

      <!-- Axis labels -->
      {#each axisEndpoints as ep, i}
        {@const lp = labelOffset(ep)}
        <text
          x={lp.x}
          y={lp.y}
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="6"
          font-family="var(--font-label)"
          fill="var(--text-muted)"
        >{DIMENSION_LABELS[i]}</text>
      {/each}
    {/if}
  </svg>
</div>

<style>
  .soul-radar {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  svg {
    overflow: visible;
  }
</style>
