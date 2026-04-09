<script lang="ts">
  import type { SpendTrendAgent } from '$lib/api';

  let {
    data,
    height = 120,
  }: {
    data: SpendTrendAgent[];
    height?: number;
  } = $props();

  const PADDING_LEFT = 4;
  const PADDING_RIGHT = 4;
  const PADDING_TOP = 8;
  const PADDING_BOTTOM = 20;

  const COLORS = [
    'var(--accent)',
    'var(--karma)',
    'var(--bo-teal)',
    'var(--bo-rose)',
    'var(--bo-amber)',
    'var(--bo-vb)',
  ];

  let width = $state(400);
  let containerEl: HTMLDivElement | undefined = $state();

  let chartWidth = $derived(width - PADDING_LEFT - PADDING_RIGHT);
  let chartHeight = $derived(height - PADDING_TOP - PADDING_BOTTOM);

  let dates = $derived([...new Set(data.map(d => d.date))].sort());
  let agentIds = $derived([...new Set(data.map(d => d.agentId))]);

  let maxCents = $derived(
    data.length > 0 ? Math.max(...data.map(d => d.totalCents), 1) : 1
  );

  let maxDateCents = $derived(
    dates.map(date => {
      return data.filter(d => d.date === date).reduce((sum, d) => sum + d.totalCents, 0);
    })
  );

  let maxTotal = $derived(
    maxDateCents.length > 0 ? Math.max(...maxDateCents, 1) : 1
  );

  let xScale = $derived((date: string) => {
    const idx = dates.indexOf(date);
    return PADDING_LEFT + (idx / Math.max(dates.length - 1, 1)) * chartWidth;
  });

  let yScale = $derived((cents: number) => {
    return PADDING_TOP + chartHeight - (cents / maxTotal) * chartHeight;
  });

  let stackedAreas = $derived(
    agentIds.map((agentId, agentIdx) => {
      const agentData = data.filter(d => d.agentId === agentId);
      const agentName = agentData[0]?.agentName ?? agentId.slice(0, 6);
      const color = COLORS[agentIdx % COLORS.length];

      const bottomPoints = dates.map(date => {
        const idx = dates.indexOf(date);
        const prevAgentsTotal = data
          .filter(d => d.date === date && agentIds.indexOf(d.agentId) < agentIdx)
          .reduce((sum, d) => sum + d.totalCents, 0);
        return { x: xScale(date), y: yScale(prevAgentsTotal) };
      });

      const topPoints = dates.map(date => {
        const idx = dates.indexOf(date);
        const allPrevTotal = data
          .filter(d => d.date === date && agentIds.indexOf(d.agentId) <= agentIdx)
          .reduce((sum, d) => sum + d.totalCents, 0);
        return { x: xScale(date), y: yScale(allPrevTotal) };
      });

      const pathParts = bottomPoints.map((p, i) => {
        const tp = topPoints[i];
        return `L ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${tp.x.toFixed(1)} ${tp.y.toFixed(1)}`;
      });

      const start = `M ${bottomPoints[0].x.toFixed(1)} ${bottomPoints[0].y.toFixed(1)}`;
      const areaPath = start + pathParts.join(' ') + ` L ${topPoints[topPoints.length - 1].x.toFixed(1)} ${(PADDING_TOP + chartHeight).toFixed(1)} L ${bottomPoints[0].x.toFixed(1)} ${(PADDING_TOP + chartHeight).toFixed(1)} Z`;

      return { agentId, agentName, color, areaPath };
    })
  );

  let yTicks = $derived(
    [0, 0.25, 0.5, 0.75, 1].map(pct => ({
      y: (PADDING_TOP + chartHeight - pct * chartHeight).toFixed(1),
      label: pct === 0 ? '$0' : pct === 1 ? `$${(maxTotal / 100).toFixed(0)}` : ''
    }))
  );

  let xTicks = $derived(
    dates.filter((_, i) => i % Math.ceil(dates.length / 6) === 0 || i === dates.length - 1)
      .map(d => ({ x: xScale(d).toFixed(1), label: formatDate(d) }))
  );

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  $effect(() => {
    if (!containerEl) return;
    const observer = new ResizeObserver(entries => {
      width = entries[0]?.contentRect.width ?? 400;
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });
</script>

<div class="stacked-chart" bind:this={containerEl}>
  {#if data.length === 0}
    <div class="empty">No agent spend data yet</div>
  {:else}
    <svg {width} {height} viewBox="0 0 {width} {height}" aria-label="Agent spend breakdown over time">
      {#each yTicks as tick}
        <line
          x1={PADDING_LEFT}
          y1={tick.y}
          x2={width - PADDING_RIGHT}
          y2={tick.y}
          stroke="var(--border)"
          stroke-width="0.5"
        />
        {#if tick.label}
          <text
            x={PADDING_LEFT - 2}
            y={tick.y}
            text-anchor="end"
            dominant-baseline="middle"
            font-size="9"
            fill="var(--text-muted)"
          >{tick.label}</text>
        {/if}
      {/each}

      {#each xTicks as tick}
        <text
          x={tick.x}
          y={height - 4}
          text-anchor="middle"
          font-size="9"
          fill="var(--text-muted)"
        >{tick.label}</text>
      {/each}

      {#each stackedAreas as area}
        <path d={area.areaPath} fill={area.color} fill-opacity="0.6" />
      {/each}
    </svg>

    <div class="legend">
      {#each stackedAreas as area, i}
        <span class="legend-item">
          <span class="legend-dot" style="background: {area.color}"></span>
          {area.agentName ?? area.agentId.slice(0, 6)}
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .stacked-chart {
    width: 100%;
  }

  svg {
    overflow: visible;
  }

  .empty {
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--muted);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 8px;
    padding: 0 4px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--text-muted);
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
