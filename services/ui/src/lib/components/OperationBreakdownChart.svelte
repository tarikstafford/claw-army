<script lang="ts">
  import type { SpendByOperationPoint } from '$lib/api.js';

  let { data }: { data: SpendByOperationPoint[] } = $props();

  const WIDTH = 560;
  const HEIGHT = 160;
  const PADDING_LEFT = 48;
  const PADDING_RIGHT = 16;
  const PADDING_TOP = 12;
  const PADDING_BOTTOM = 28;

  const chartWidth = $derived(WIDTH - PADDING_LEFT - PADDING_RIGHT);
  const chartHeight = $derived(HEIGHT - PADDING_TOP - PADDING_BOTTOM);

  const OP_COLORS = {
    llm: 'var(--fo-violet, #7C3AED)',
    bot: 'var(--fo-amber, #F59E0B)',
    tool: 'var(--fo-teal, #14B8A6)',
  };

  const maxCents = $derived(
    data.length > 0
      ? Math.max(
          ...data.map(d => d.llmCallsCents + d.botHoursCents + d.toolInvocationsCents),
          100
        )
      : 100
  );

  const xScale = $derived((i: number, len: number) => (i / (len - 1 || 1)) * chartWidth + PADDING_LEFT);
  const yScale = $derived((cents: number) => chartHeight - (cents / maxCents) * chartHeight + PADDING_TOP);

  const stackedAreas = $derived(() => {
    const operations = [
      { key: 'llmCallsCents' as const, color: OP_COLORS.llm, label: 'LLM calls' },
      { key: 'botHoursCents' as const, color: OP_COLORS.bot, label: 'Bot hours' },
      { key: 'toolInvocationsCents' as const, color: OP_COLORS.tool, label: 'Tool invocations' },
    ];

    return operations.map((op, opIdx) => {
      const points: { x: number; y: number; bottom: number }[] = [];

      for (let i = 0; i < data.length; i++) {
        const belowSum = operations
          .filter((_, idx) => idx < opIdx)
          .reduce((sum, other) => {
            const val = data[i][other.key];
            return sum + (typeof val === 'number' ? val : 0);
          }, 0);
        const opValue = data[i][op.key] ?? 0;

        const x = xScale(i, data.length);
        const y = yScale(belowSum + opValue);
        const bottom = yScale(belowSum);
        points.push({ x, y, bottom });
      }

      return { ...op, points };
    });
  });

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

<div class="operation-chart">
  <div class="chart-legend">
    {#each stackedAreas() as area}
      <div class="legend-item">
        <span class="legend-dot" style="background: {area.color}"></span>
        <span class="legend-label">{area.label}</span>
      </div>
    {/each}
  </div>
  <svg viewBox="0 0 {WIDTH} {HEIGHT}" aria-label="Spend by operation type over time">
    {#if data.length === 0}
      <text x={WIDTH / 2} y={HEIGHT / 2} text-anchor="middle" font-size="11" fill="var(--muted)">No operation data</text>
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

      {#each stackedAreas() as area}
        <path d={areaPath(area.points)} fill={area.color} fill-opacity="0.7" />
      {/each}

      {#each data as point, i}
        {#if i % 5 === 0 || i === data.length - 1}
          <text
            x={xScale(i, data.length)}
            y={HEIGHT - 4}
            text-anchor="middle"
            font-size="8"
            font-family="var(--font-label)"
            fill="var(--muted)"
          >{formatDate(point.date)}</text>
        {/if}
      {/each}
    {/if}
  </svg>
</div>

<style>
  .operation-chart {
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
