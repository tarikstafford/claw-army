<script lang="ts">
  import type { SkillHeatmapCell, SkillEffectiveness } from '$lib/api.js';

  let { cells }: { cells: SkillHeatmapCell[] } = $props();

  const CELL_COLORS: Record<SkillEffectiveness, string> = {
    high: 'var(--bo-teal)',
    medium: 'var(--bo-amber)',
    low: 'var(--bo-rose)',
    unknown: 'var(--bo-faint)',
  };

  const botIds = $derived([...new Set(cells.map(c => c.botId))]);
  const skillIds = $derived([...new Set(cells.map(c => c.skillId))]);

  function getCell(botId: string, skillId: string): SkillHeatmapCell | undefined {
    return cells.find(c => c.botId === botId && c.skillId === skillId);
  }
</script>

<div class="skill-heatmap">
  <div class="heatmap-grid" style="grid-template-columns: auto repeat({skillIds.length}, 1fr);">
    <div class="heatmap-corner"></div>
    {#each skillIds as skillId}
      {@const cell0 = cells.find(c => c.skillId === skillId)}
      <div class="heatmap-col-header" title={cell0?.skillName ?? skillId}>
        <span class="col-header-text">{cell0?.skillName?.slice(0, 12) ?? skillId}</span>
      </div>
    {/each}

    {#each botIds as botId}
      {@const botCell = cells.find(c => c.botId === botId)}
      <div class="heatmap-row-header" title={botCell?.botName ?? botId}>
        <span class="row-header-text">{botCell?.botName?.slice(0, 10) ?? botId}</span>
      </div>
      {#each skillIds as skillId}
        {@const cell = getCell(botId, skillId)}
        <div
          class="heatmap-cell"
          style="background: {cell ? CELL_COLORS[cell.classification] : 'var(--bo-bg)'}"
          title={cell ? `${cell.skillName}: ${cell.classification}` : 'no data'}
        ></div>
      {/each}
    {/each}
  </div>

  <div class="heatmap-legend">
    <span class="legend-label">HIGH</span>
    <div class="legend-swatch" style="background: var(--bo-teal)"></div>
    <span class="legend-label">MEDIUM</span>
    <div class="legend-swatch" style="background: var(--bo-amber)"></div>
    <span class="legend-label">LOW</span>
    <div class="legend-swatch" style="background: var(--bo-rose)"></div>
    <span class="legend-label">UNKNOWN</span>
    <div class="legend-swatch" style="background: var(--bo-faint)"></div>
  </div>
</div>

<style>
  .skill-heatmap {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .heatmap-grid {
    display: grid;
    gap: 2px;
    overflow-x: auto;
  }

  .heatmap-corner {
    background: transparent;
  }

  .heatmap-col-header {
    padding: var(--space-xs) var(--space-sm);
    overflow: hidden;
  }

  .col-header-text {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
    color: var(--bo-caption);
    display: block;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  .heatmap-row-header {
    padding: var(--space-xs) var(--space-sm);
    overflow: hidden;
  }

  .row-header-text {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--bo-muted);
    display: block;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  .heatmap-cell {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--bo-border);
    flex-shrink: 0;
  }

  .heatmap-legend {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .legend-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
  }

  .legend-swatch {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    border: 1px solid var(--bo-border);
  }
</style>
