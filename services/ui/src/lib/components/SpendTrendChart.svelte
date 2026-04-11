<script lang="ts">
  import type { SpendTrendPoint } from '$lib/api.js';

  let { data }: { data: SpendTrendPoint[] } = $props();

  const WIDTH = 560;
  const HEIGHT = 160;
  const PADDING_LEFT = 48;
  const PADDING_RIGHT = 16;
  const PADDING_TOP = 12;
  const PADDING_BOTTOM = 28;

  const chartWidth = $derived(WIDTH - PADDING_LEFT - PADDING_RIGHT);
  const chartHeight = $derived(HEIGHT - PADDING_TOP - PADDING_BOTTOM);

  const maxCents = $derived(
    data.length > 0 ? Math.max(...data.map(d => d.totalCents), 100) : 100
  );

  const xScale = $derived((i: number) => (i / (data.length - 1 || 1)) * chartWidth + PADDING_LEFT);
  const yScale = $derived((cents: number) => chartHeight - (cents / maxCents) * chartHeight + PADDING_TOP);

  const linePath = $derived(
    data.length > 0
      ? data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.totalCents)}`).join(' ')
      : ''
  );

  const areaPath = $derived(
    data.length > 0
      ? `${linePath} L ${xScale(data.length - 1)} ${chartHeight + PADDING_TOP} L ${PADDING_LEFT} ${chartHeight + PADDING_TOP} Z`
      : ''
  );

  const yTicks = $derived(() => {
    const ticks: number[] = [];
    const step = maxCents / 4;
    for (let i = 0; i <= 4; i++) {
      ticks.push(Math.round(step * i));
    }
    return ticks;
  });

  const xTicks = $derived(() => {
    if (data.length === 0) return [];
    const every = Math.ceil(data.length / 6);
    return data.filter((_, i) => i % every === 0 || i === data.length - 1);
  });

  function formatCents(cents: number): string {
    if (cents >= 100) return `$${(cents / 100).toFixed(0)}`;
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
</script>

<div class="spend-trend-chart">
  <svg viewBox="0 0 {WIDTH} {HEIGHT}" aria-label="Daily spend over last 30 days">
    {#if data.length === 0}
      <text x={WIDTH / 2} y={HEIGHT / 2} text-anchor="middle" font-size="11" fill="var(--muted)">No spend data yet</text>
    {:else}
      <defs>
        <linearGradient id="spend-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--fo-violet, #7C3AED)" stop-opacity="0.25" />
          <stop offset="100%" stop-color="var(--fo-violet, #7C3AED)" stop-opacity="0.02" />
        </linearGradient>
      </defs>

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

      <path d={areaPath} fill="url(#spend-gradient)" />

      <path
        d={linePath}
        fill="none"
        stroke="var(--fo-violet, #7C3AED)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      {#each data as point, i}
        {#if i === 0 || i === data.length - 1 || i % 5 === 0}
          <circle
            cx={xScale(i)}
            cy={yScale(point.totalCents)}
            r="3"
            fill="var(--fo-violet, #7C3AED)"
          />
          <text
            x={xScale(i)}
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
  .spend-trend-chart {
    width: 100%;
  }

  svg {
    width: 100%;
    height: auto;
    overflow: visible;
  }
</style>
