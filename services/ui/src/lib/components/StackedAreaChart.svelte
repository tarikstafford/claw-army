<script lang="ts">
  import type { SpendByAgentPoint } from '$lib/api.js';

  let { data }: { data: SpendByAgentPoint[] } = $props();

  const WIDTH = 560;
  const HEIGHT = 160;
  const PADDING_LEFT = 48;
  const PADDING_RIGHT = 16;
  const PADDING_TOP = 12;
  const PADDING_BOTTOM = 28;

  const chartWidth = $derived(WIDTH - PADDING_LEFT - PADDING_RIGHT);
  const chartHeight = $derived(HEIGHT - PADDING_TOP - PADDING_BOTTOM);

  const AGENT_COLORS = [
    'var(--fo-violet, #7C3AED)',
    'var(--fo-amber, #F59E0B)',
    'var(--fo-teal, #14B8A6)',
    'var(--fo-rose, #F43F5E)',
    'var(--fo-sky, #0EA5E9)',
  ];

  const agentIds = $derived([...new Set(data.map(d => d.agentId))]);

  const maxCents = $derived(
    data.length > 0
      ? Math.max(
          ...data.map(d => {
            const agentData = data.filter(p => p.date === d.date);
            return agentData.reduce((sum, p) => sum + p.cents, 0);
          }),
          100
        )
      : 100
  );

  const xScale = $derived((i: number, len: number) => (i / (len - 1 || 1)) * chartWidth + PADDING_LEFT);
  const yScale = $derived((cents: number) => chartHeight - (cents / maxCents) * chartHeight + PADDING_TOP);

  const dates = $derived([...new Set(data.map(d => d.date))].sort());

  const stackedAreas = $derived(
    agentIds.map((agentId, agentIdx) => {
      const agentData = data.filter(d => d.agentId === agentId);
      const points: { x: number; y: number; bottom: number }[] = [];

      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const dayData = data.filter(p => p.date === date);
        const belowAgentSum = dayData
          .filter(p => agentIds.indexOf(p.agentId) < agentIdx)
          .reduce((sum, p) => sum + p.cents, 0);
        const agentPoint = dayData.find(p => p.agentId === agentId);
        const agentCents = agentPoint?.cents ?? 0;

        const x = xScale(i, dates.length);
        const y = yScale(belowAgentSum + agentCents);
        const bottom = yScale(belowAgentSum);
        points.push({ x, y, bottom });
      }

      return {
        agentId,
        agentName: agentData[0]?.agentName ?? agentId.slice(0, 8),
        color: AGENT_COLORS[agentIdx % AGENT_COLORS.length],
        points,
      };
    })
  );

  const yTicks = $derived(() => {
    const ticks: number[] = [];
    const step = maxCents / 4;
    for (let i = 0; i <= 4; i++) {
      ticks.push(Math.round(step * i));
    }
    return ticks;
  });

  function formatCents(cents: number): string {
    if (cents >= 100) return `$${(cents / 100).toFixed(0)}`;
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function areaPath(points: { x: number; y: number; bottom: number }[]): string {
    if (points.length === 0) return '';
    const parts = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`);
    for (let i = points.length - 1; i >= 0; i--) {
      parts.push(`L ${points[i].x} ${points[i].bottom}`);
    }
    parts.push('Z');
    return parts.join(' ');
  }
</script>

<div class="stacked-area-chart">
  <div class="chart-legend">
    {#each stackedAreas as area, i}
      <div class="legend-item">
        <span class="legend-dot" style="background: {area.color}"></span>
        <span class="legend-label">{area.agentName}</span>
      </div>
    {/each}
  </div>
  <svg viewBox="0 0 {WIDTH} {HEIGHT}" aria-label="Spend by agent over time">
    {#if data.length === 0}
      <text x={WIDTH / 2} y={HEIGHT / 2} text-anchor="middle" font-size="11" fill="var(--muted)">No agent data</text>
    {:else}
      {#each yTicks() as tick}
        <line
          x1={PADDING_LEFT}
          y1={yScale(tick)}
          x2={WIDTH - PADDING_RIGHT}
          y2={yScale(tick)}
          stroke="var(--fo-border)"
          stroke-width="1"
          stroke-dasharray="3,3"
        />
        <text
          x={PADDING_LEFT - 6}
          y={yScale(tick)}
          text-anchor="end"
          dominant-baseline="middle"
          font-size="9"
          font-family="var(--font-label)"
          fill="var(--muted)"
        >{formatCents(tick)}</text>
      {/each}

      {#each stackedAreas as area}
        <path d={areaPath(area.points)} fill={area.color} fill-opacity="0.7" />
      {/each}

      {#each dates as date, i}
        {#if i % 5 === 0 || i === dates.length - 1}
          <text
            x={xScale(i, dates.length)}
            y={HEIGHT - 4}
            text-anchor="middle"
            font-size="8"
            font-family="var(--font-label)"
            fill="var(--muted)"
          >{formatDate(date)}</text>
        {/if}
      {/each}
    {/if}
  </svg>
</div>

<style>
  .stacked-area-chart {
    width: 100%;
  }

  .chart-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 8px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .legend-label {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--text-muted);
  }

  svg {
    width: 100%;
    height: auto;
    overflow: visible;
  }
</style>
