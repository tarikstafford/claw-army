<script lang="ts">
  import type { SpendTrendPoint } from '$lib/api';

  let {
    data = [],
    height = 120,
    color = 'var(--fo-violet, #7C3AED)',
  }: {
    data: SpendTrendPoint[];
    height?: number;
    color?: string;
  } = $props();

  const PADDING = { top: 8, right: 8, bottom: 24, left: 40 };

  let width = $derived(Math.max(data.length * 12, 200));
  let chartWidth = $derived(width - PADDING.left - PADDING.right);
  let chartHeight = $derived(height - PADDING.top - PADDING.bottom);

  let maxCents = $derived(
    data.length > 0 ? Math.max(...data.map(d => d.totalCents), 1) : 1
  );

  let points = $derived(
    data.map((d, i) => ({
      x: PADDING.left + (i / Math.max(data.length - 1, 1)) * chartWidth,
      y: PADDING.top + chartHeight - (d.totalCents / maxCents) * chartHeight,
      d,
    }))
  );

  let linePath = $derived(
    points.length > 0
      ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
      : ''
  );

  let areaPath = $derived(
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${PADDING.top + chartHeight} L ${PADDING.left} ${PADDING.top + chartHeight} Z`
      : ''
  );

  function formatCents(cents: number): string {
    if (cents >= 100) return `$${(cents / 100).toFixed(0)}`;
    if (cents >= 1) return `$${(cents / 100).toFixed(1)}`;
    return '$0';
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
</script>

<div class="spend-chart">
  <svg {width} {height} viewBox="0 0 {width} {height}" aria-label="Spend trend chart">
    {#if data.length === 0}
      <text x={width / 2} y={height / 2} text-anchor="middle" font-size="10" fill="var(--muted)">
        No trend data
      </text>
    {:else}
      <!-- Y-axis grid lines -->
      {#each [0, 0.25, 0.5, 0.75, 1] as tick}
        {@const y = PADDING.top + chartHeight * (1 - tick)}
        <line
          x1={PADDING.left}
          y1={y}
          x2={width - PADDING.right}
          y2={y}
          stroke="var(--fo-border, #E8E4DC)"
          stroke-width="1"
          stroke-dasharray={tick === 0 ? 'none' : '2,2'}
        />
        <text
          x={PADDING.left - 4}
          y={y + 3}
          text-anchor="end"
          font-size="8"
          font-family="var(--font-label)"
          fill="var(--muted)"
        >{formatCents(maxCents * tick)}</text>
      {/each}

      <!-- X-axis date labels (first, middle, last) -->
      {#if data.length >= 3}
        {@const midIdx = Math.floor(data.length / 2)}
        {#each [0, midIdx, data.length - 1] as idx}
          <text
            x={points[idx].x}
            y={height - 4}
            text-anchor="middle"
            font-size="8"
            font-family="var(--font-label)"
            fill="var(--muted)"
          >{formatDate(data[idx].date)}</text>
        {/each}
      {:else}
        {#each data as d, i}
          <text
            x={points[i].x}
            y={height - 4}
            text-anchor="middle"
            font-size="8"
            font-family="var(--font-label)"
            fill="var(--muted)"
          >{formatDate(d.date)}</text>
        {/each}
      {/if}

      <!-- Area fill -->
      <path
        d={areaPath}
        fill={color}
        fill-opacity="0.10"
      />

      <!-- Line -->
      <path
        d={linePath}
        fill="none"
        stroke={color}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Data points -->
      {#each points as p, i}
        <circle
          cx={p.x}
          cy={p.y}
          r="2"
          fill={color}
        />
      {/each}
    {/if}
  </svg>
</div>

<style>
  .spend-chart {
    width: 100%;
    overflow-x: auto;
  }

  svg {
    overflow: visible;
    display: block;
  }
</style>
