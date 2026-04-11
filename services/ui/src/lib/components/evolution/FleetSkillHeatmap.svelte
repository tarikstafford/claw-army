<script lang="ts">
  import type { FleetSkillHeatmapCell, Skill, EffectivenessClass } from '$lib/api';

  let {
    heatmapData = [],
    skills = [],
    agentIds = []
  }: {
    heatmapData: FleetSkillHeatmapCell[];
    skills: Skill[];
    agentIds: string[];
  } = $props();

  const EFFECTIVENESS_COLORS: Record<EffectivenessClass, string> = {
    exceptional: 'var(--bo-teal)',
    good: 'var(--bo-violet)',
    average: 'var(--bo-amber)',
    poor: 'var(--bo-rose)',
    untested: 'var(--bo-faint)',
  };

  const EFFECTIVENESS_LABELS: Record<EffectivenessClass, string> = {
    exceptional: 'EXCEPTIONAL',
    good: 'GOOD',
    average: 'AVERAGE',
    poor: 'POOR',
    untested: 'UNTESTED',
  };

  function getCell(botId: string, skillId: string): FleetSkillHeatmapCell | undefined {
    return heatmapData.find(c => c.botId === botId && c.skillId === skillId);
  }

  function getSkillById(skillId: string): Skill | undefined {
    return skills.find(s => s.id === skillId);
  }

  function getAverageEffectiveness(skillId: string): EffectivenessClass {
    const cells = heatmapData.filter(c => c.skillId === skillId);
    if (cells.length === 0) return 'untested';
    const avg = cells.reduce((sum, c) => {
      if (c.effectivenessScore === null) return sum;
      return sum + c.effectivenessScore;
    }, 0) / cells.length;
    if (avg >= 0.85) return 'exceptional';
    if (avg >= 0.70) return 'good';
    if (avg >= 0.50) return 'average';
    return 'poor';
  }

  let skillAverages = $derived(
    skills.map(s => ({ skill: s, avgClass: getAverageEffectiveness(s.id) }))
      .sort((a, b) => {
        const order: EffectivenessClass[] = ['exceptional', 'good', 'average', 'poor', 'untested'];
        return order.indexOf(a.avgClass) - order.indexOf(b.avgClass);
      })
  );
</script>

<div class="heatmap-container">
  <div class="heatmap-header">
    <h4 class="heatmap-title">FLEET SKILL HEATMAP</h4>
    <div class="legend">
      {#each Object.entries(EFFECTIVENESS_LABELS) as [cls, label]}
        <div class="legend-item">
          <span class="legend-dot" style="background: {EFFECTIVENESS_COLORS[cls]}"></span>
          <span class="legend-label">{label}</span>
        </div>
      {/each}
    </div>
  </div>

  {#if skills.length === 0 || agentIds.length === 0}
    <p class="empty-text">No skill data available</p>
  {:else}
    <div class="heatmap-scroll">
      <table class="heatmap-table">
        <thead>
          <tr>
            <th class="corner-cell"></th>
            {#each skillAverages as { skill, avgClass }}
              <th class="skill-header" title={skill.name}>
                <div class="skill-header-inner">
                  <span class="skill-abbr">{skill.name.slice(0, 6)}</span>
                  <span
                    class="skill-avg-dot"
                    style="background: {EFFECTIVENESS_COLORS[avgClass]}"
                  ></span>
                </div>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each agentIds as botId}
            <tr>
              <td class="agent-cell">{botId.slice(0, 6)}</td>
              {#each skillAverages as { skill }}
                {@const cell = getCell(botId, skill.id)}
                <td
                  class="heat-cell"
                  style="background: {cell ? EFFECTIVENESS_COLORS[cell.effectivenessClass] : 'var(--bo-ghost)'}"
                  title={cell ? `${skill.name}: ${cell.effectivenessScore !== null ? (cell.effectivenessScore * 100).toFixed(0) + '%' : 'N/A'}` : 'No data'}
                >
                  {#if cell && cell.effectivenessScore !== null}
                    <span class="cell-value">{Math.round(cell.effectivenessScore * 100)}</span>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .heatmap-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .heatmap-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-md);
  }

  .heatmap-title {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-muted);
    margin: 0;
  }

  .legend {
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  .legend-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.06em;
    color: var(--bo-faint);
  }

  .empty-text {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-faint);
    margin: 0;
    padding: var(--space-xl);
    text-align: center;
    background: var(--bo-card);
    border: 1px dashed var(--bo-border);
    border-radius: var(--radius-md);
  }

  .heatmap-scroll {
    overflow-x: auto;
  }

  .heatmap-table {
    border-collapse: collapse;
    min-width: 100%;
  }

  .corner-cell {
    width: 60px;
    min-width: 60px;
  }

  .skill-header {
    padding: var(--space-xs) var(--space-sm);
    min-width: 50px;
  }

  .skill-header-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }

  .skill-abbr {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--bo-muted);
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
    max-height: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .skill-avg-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .agent-cell {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--bo-muted);
    padding: var(--space-xs) var(--space-sm);
    text-align: left;
    white-space: nowrap;
  }

  .heat-cell {
    width: 40px;
    height: 28px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.1s ease;
  }

  .heat-cell:hover {
    transform: scale(1.15);
    z-index: 1;
  }

  .cell-value {
    font-family: var(--font-mono);
    font-size: 9px;
    color: rgba(0, 0, 0, 0.7);
    font-weight: 600;
  }
</style>
