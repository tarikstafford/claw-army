<script lang="ts">
  import type { SkillEffectivenessStats } from '$lib/api';

  interface Props {
    stats: SkillEffectivenessStats | null;
    compact?: boolean;
  }

  let { stats, compact = false }: Props = $props();

  const successPercent = $derived(
    stats?.successRate != null ? Math.round(stats.successRate * 100) : null,
  );

  const avgDurationSec = $derived(
    stats?.avgDuration != null ? (stats.avgDuration / 1000).toFixed(1) : null,
  );

  const lastActive = $derived.by(() => {
    if (!stats?.lastActivatedAt) return null;
    const d = new Date(stats.lastActivatedAt);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return 'Just now';
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d ago`;
  });
</script>

{#if stats && stats.totalActivations != null && stats.totalActivations > 0}
  <div class="effectiveness" class:compact>
    <div class="stat-row">
      <span class="stat-label">ACTIVATIONS</span>
      <span class="stat-value">{stats.totalActivations}</span>
    </div>
    {#if successPercent !== null}
      <div class="stat-row">
        <span class="stat-label">SUCCESS</span>
        <div class="bar-wrap">
          <div
            class="bar-fill"
            class:high={successPercent >= 80}
            class:mid={successPercent >= 50 && successPercent < 80}
            class:low={successPercent < 50}
            style="width: {successPercent}%"
          ></div>
        </div>
        <span class="stat-value">{successPercent}%</span>
      </div>
    {/if}
    {#if avgDurationSec !== null}
      <div class="stat-row">
        <span class="stat-label">AVG TIME</span>
        <span class="stat-value">{avgDurationSec}s</span>
      </div>
    {/if}
    {#if lastActive}
      <div class="stat-row">
        <span class="stat-label">LAST USED</span>
        <span class="stat-value faint">{lastActive}</span>
      </div>
    {/if}
  </div>
{:else}
  <div class="effectiveness empty" class:compact>
    <span class="no-data">No activation data yet</span>
  </div>
{/if}

<style>
  .effectiveness {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: var(--space-sm) var(--space-md);
    background: rgba(124, 58, 237, 0.04);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .effectiveness.compact {
    padding: 4px 8px;
    gap: 3px;
  }

  .effectiveness.empty {
    padding: var(--space-sm) var(--space-md);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stat-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .stat-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--muted);
    min-width: 70px;
    flex-shrink: 0;
  }

  .compact .stat-label {
    min-width: 55px;
  }

  .stat-value {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text);
  }

  .stat-value.faint {
    color: var(--text-muted);
  }

  .bar-wrap {
    flex: 1;
    height: 4px;
    background: rgba(236, 232, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .bar-fill.high { background: var(--accent-teal); }
  .bar-fill.mid  { background: var(--karma); }
  .bar-fill.low  { background: var(--accent-rose); }

  .no-data {
    font-size: 11px;
    color: var(--muted);
  }
</style>
