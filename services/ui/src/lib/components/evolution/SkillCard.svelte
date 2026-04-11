<script lang="ts">
  import type { Skill, EffectivenessClass } from '$lib/api';

  let { skill, onclick }: { skill: Skill; onclick?: (skill: Skill) => void } = $props();

  const EFFECTIVENESS_COLORS: Record<EffectivenessClass, string> = {
    exceptional: 'var(--bo-teal)',
    good: 'var(--bo-violet)',
    average: 'var(--bo-amber)',
    poor: 'var(--bo-rose)',
    untested: 'var(--bo-faint)',
  };

  const SOURCE_COLORS: Record<string, string> = {
    authored: 'var(--bo-violet)',
    learned: 'var(--bo-teal)',
    acquired: 'var(--bo-amber)',
  };

  const CATEGORY_LABELS: Record<string, string> = {
    communication: 'COMMUNICATION',
    reasoning: 'REASONING',
    execution: 'EXECUTION',
    coordination: 'COORDINATION',
    creative: 'CREATIVE',
  };

  function getEffectivenessClass(score: number | null): EffectivenessClass {
    if (score === null) return 'untested';
    if (score >= 0.85) return 'exceptional';
    if (score >= 0.70) return 'good';
    if (score >= 0.50) return 'average';
    return 'poor';
  }

  let effClass = $derived(getEffectivenessClass(skill.avgEffectivenessScore));
  let effColor = $derived(EFFECTIVENESS_COLORS[effClass]);
  let sourceColor = $derived(SOURCE_COLORS[skill.source] ?? 'var(--bo-faint)');
</script>

<button class="skill-card" onclick={() => onclick?.(skill)}>
  <div class="card-header">
    <span class="skill-name">{skill.name}</span>
    <span class="skill-category" style="color: {effColor}">{CATEGORY_LABELS[skill.category] ?? skill.category.toUpperCase()}</span>
  </div>

  <div class="card-triggers">
    {#each skill.triggerPatterns.slice(0, 3) as pattern}
      <span class="trigger-chip">{pattern}</span>
    {/each}
    {#if skill.triggerPatterns.length > 3}
      <span class="trigger-more">+{skill.triggerPatterns.length - 3}</span>
    {/if}
  </div>

  <div class="card-footer">
    <div class="source-badge" style="color: {sourceColor}">
      {skill.source.toUpperCase()}
    </div>
    <div class="effectiveness">
      <span class="eff-dot" style="background: {effColor}"></span>
      <span class="eff-score">
        {skill.avgEffectivenessScore !== null ? (skill.avgEffectivenessScore * 100).toFixed(0) + '%' : '—'}
      </span>
    </div>
    {#if skill.equippedBots.length > 0}
      <span class="equip-count">{skill.equippedBots.length} equipped</span>
    {/if}
  </div>

  {#if !skill.isApproved}
    <div class="pending-badge">PENDING</div>
  {/if}
</button>

<style>
  .skill-card {
    position: relative;
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    cursor: pointer;
    transition: border-color 0.15s ease, transform 0.15s ease;
    text-align: left;
    width: 100%;
  }

  .skill-card:hover {
    border-color: var(--bo-bhi);
    transform: translateY(-1px);
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .skill-name {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 600;
    color: var(--bo-text);
    line-height: 1.3;
  }

  .skill-category {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
    flex-shrink: 0;
  }

  .card-triggers {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .trigger-chip {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--bo-muted);
    background: var(--bo-ghost);
    border-radius: 3px;
    padding: 2px 6px;
  }

  .trigger-more {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--bo-faint);
    padding: 2px 4px;
  }

  .card-footer {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-top: auto;
  }

  .source-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
  }

  .effectiveness {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }

  .eff-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .eff-score {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-muted);
  }

  .equip-count {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--bo-faint);
  }

  .pending-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
    color: var(--bo-amber);
    background: rgba(251, 191, 36, 0.10);
    border: 1px solid rgba(251, 191, 36, 0.32);
    padding: 2px 5px;
    border-radius: 3px;
  }
</style>
