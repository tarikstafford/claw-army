<script lang="ts">
  import type { SpendTrendDay } from '$lib/api';

  let {
    data,
    height = 120,
    color = 'var(--accent, #6B46A8)',
  }: {
    data: SpendTrendDay[];
    height?: number;
    color?: string;
  } = $props();

  const PADDING_LEFT = 4;
  const PADDING_RIGHT = 4;
  const PADDING_TOP = 8;
  const PADDING_BOTTOM = 20;

  let width = $state(400);
  let containerEl: HTMLDivElement | undefined = $state();

  let chartWidth = $derived(width - PADDING_LEFT - PADDING_RIGHT);
  let chartHeight = $derived(height - PADDING_TOP - PADDING_BOTTOM);

  let maxCents = $derived(
    data.length > 0 ? Math.max(...data.map(d => d.totalCents), 1) : 1
  );

  let points = $derived(
    data.map((d, i) => {
      const x = PADDING_LEFT + (i / Math.max(data.length - 1, 1)) * chartWidth;
      const y = PADDING_TOP + chartHeight - (d.totalCents / maxCents) * chartHeight;
      return { x, y, date: d.date, cents: d.totalCents };
    })
  );

  let pathD = $derived(
    points.length > 0
      ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
      : ''
  );

  let areaD = $derived(
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(PADDING_TOP + chartHeight).toFixed(1)} L ${PADDING_LEFT} ${(PADDING_TOP + chartHeight).toFixed(1)} Z`
      : ''
  );

  let tickCount = $derived(5);
  let yTicks = $derived(
    Array.from({ length: tickCount }, (_, i) => {
      const value = (maxCents / (tickCount - 1)) * i;
      const y = PADDING_TOP + chartHeight - (value / maxCents) * chartHeight;
      return { y: y.toFixed(1), label: formatCents(value) };
    })
  );

  let xTicks = $derived(
    data.length > 0
      ? data.filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1)
          .map((d, _, arr) => {
            const idx = data.indexOf(d);
            const x = PADDING_LEFT + (idx / Math.max(data.length - 1, 1)) * chartWidth;
            return { x: x.toFixed(1), label: formatDate(d.date) };
          })
      : []
  );

  function formatCents(cents: number): string {
    if (cents >= 100) return `$${(cents / 100).toFixed(0)}`;
    if (cents >= 1) return `¢${cents.toFixed(0)}`;
    return '$0';
  }

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

<div class="spend-chart" bind:this={containerEl}>
  {#if data.length === 0}
    <div class="empty">No spend data yet</div>
  {:else}
    <svg {width} {height} viewBox="0 0 {width} {height}" aria-label="Daily spend trend">
      <defs>
        <linearGradient id="spend-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={color} stop-opacity="0.2" />
          <stop offset="100%" stop-color={color} stop-opacity="0" />
        </linearGradient>
      </defs>

      {#each yTicks as tick}
        <line
          x1={PADDING_LEFT}
          y1={tick.y}
          x2={width - PADDING_RIGHT}
          y2={tick.y}
          stroke="var(--border)"
          stroke-width="0.5"
        />
        <text
          x={PADDING_LEFT - 2}
          y={tick.y}
          text-anchor="end"
          dominant-baseline="middle"
          font-size="9"
          fill="var(--text-muted)"
        >{tick.label}</text>
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

      <path d={areaD} fill="url(#spend-gradient)" />
      <path d={pathD} fill="none" stroke={color} stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />

      {#each points as point, i}
        {#if i % Math.ceil(points.length / 20) === 0 || i === points.length - 1}
          <circle cx={point.x} cy={point.y} r="2.5" fill={color} />
        {/if}
      {/each}
    </svg>
  {/if}
</div>

<style>
  .spend-chart {
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
</style>
