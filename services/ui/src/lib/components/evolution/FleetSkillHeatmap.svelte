<script lang="ts">
  import type { EffectivenessClass } from '$lib/api';

  const EFFECTIVENESS_COLORS: Record<EffectivenessClass, string> = {
    high: 'var(--bo-teal)',
    medium: 'var(--bo-amber)',
    low: 'var(--bo-rose)',
    unknown: 'var(--bo-faint)',
  };

  let {
    agents,
    skills,
    matrix,
  }: {
    agents: Array<{ botId: string; name: string }>;
    skills: Array<{ skillId: string; name: string }>;
    matrix: Record<string, Record<string, EffectivenessClass>>;
  } = $props();

  function getCellColor(botId: string, skillId: string): string {
    return EFFECTIVENESS_COLORS[matrix[botId]?.[skillId] ?? 'unknown'];
  }

  function getCellTitle(botId: string, name: string, skillId: string): string {
    const cls = matrix[botId]?.[skillId] ?? 'unknown';
    return `${name} × ${skillId}: ${cls}`;
  }
</script>

<div class="heatmap-wrap">
  <div class="heatmap-scroll">
    <table class="heatmap-table" aria-label="Fleet skill effectiveness heatmap">
      <thead>
        <tr>
          <th class="row-header" scope="col">AGENT</th>
          {#each skills as skill}
            <th class="col-header" scope="col" title={skill.name}>{skill.name}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each agents as agent}
          <tr>
            <td class="row-header" scope="row">
              <span class="agent-label">{agent.name || agent.botId.slice(0, 8)}</span>
            </td>
            {#each skills as skill}
              {@const color = getCellColor(agent.botId, skill.skillId)}
              <td
                class="heatmap-cell"
                style="background: {color};"
                title={getCellTitle(agent.botId, agent.name || agent.botId.slice(0, 8), skill.name)}
                aria-label={getCellTitle(agent.botId, agent.name, skill.name)}
              ></td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="legend">
    <span class="legend-label">EFFECTIVENESS</span>
    {#each (['high', 'medium', 'low', 'unknown'] as const) as cls}
      <div class="legend-item">
        <span class="legend-dot" style="background: {EFFECTIVENESS_COLORS[cls]};"></span>
        <span class="legend-text">{cls.toUpperCase()}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .heatmap-wrap {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .heatmap-scroll {
    overflow-x: auto;
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
  }

  .heatmap-table {
    border-collapse: collapse;
    min-width: 100%;
  }

  .heatmap-cell,
  .col-header,
  .row-header {
    width: 40px;
    height: 28px;
    min-width: 40px;
    text-align: center;
  }

  .heatmap-cell {
    border-radius: 3px;
    cursor: default;
  }

  .col-header {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
    color: var(--bo-faint);
    writing-mode: vertical-rl;
    text-orientation: mixed;
    padding: var(--space-xs);
    text-align: left;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row-header {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.08em;
    color: var(--bo-caption);
    padding: var(--space-xs) var(--space-sm);
    text-align: left;
    min-width: 80px;
  }

  .agent-label {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 80px;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
  }

  .legend-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    flex-shrink: 0;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }

  .legend-text {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.08em;
    color: var(--bo-caption);
  }
</style>
