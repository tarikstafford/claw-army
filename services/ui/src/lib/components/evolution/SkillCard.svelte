<script lang="ts">
  import type { Skill, EffectivenessClass } from '$lib/api';

  const EFFECTIVENESS_COLORS: Record<EffectivenessClass, string> = {
    high: 'var(--bo-teal)',
    medium: 'var(--bo-amber)',
    low: 'var(--bo-rose)',
    unknown: 'var(--bo-faint)',
  };

  const SOURCE_LABELS: Record<string, string> = {
    authored: 'AUTHORED',
    learned: 'LEARNED',
    acquired: 'ACQUIRED',
  };

  let {
    skill,
    selected = false,
    onselect,
    onedit,
  }: {
    skill: Skill;
    selected?: boolean;
    onselect?: (skill: Skill) => void;
    onedit?: (skill: Skill) => void;
  } = $props();

  function formatScore(score: number | null): string {
    if (score === null) return '—';
    return (score * 100).toFixed(0) + '%';
  }
</script>

<div
  class="skill-card"
  class:selected
  class:pending={skill.pendingApproval}
  role="article"
>
  {#if skill.pendingApproval}
    <div class="pending-badge">PENDING REVIEW</div>
  {/if}

  <div class="card-header">
    <span class="skill-name">{skill.name}</span>
    <span
      class="effectiveness-dot"
      style="background: {EFFECTIVENESS_COLORS[skill.effectivenessClass]};"
      title="Effectiveness: {skill.effectivenessClass}"
    ></span>
  </div>

  <div class="card-meta">
    <span class="category-tag">{skill.category.toUpperCase()}</span>
    <span class="source-tag">{SOURCE_LABELS[skill.source] ?? skill.source}</span>
  </div>

  {#if skill.triggerPatterns.length > 0}
    <div class="trigger-patterns">
      {#each skill.triggerPatterns.slice(0, 3) as pattern}
        <span class="pattern-chip">{pattern}</span>
      {/each}
      {#if skill.triggerPatterns.length > 3}
        <span class="pattern-chip pattern-more">+{skill.triggerPatterns.length - 3}</span>
      {/if}
    </div>
  {/if}

  <div class="card-footer">
    <div class="score-info">
      <span class="score-label">AVG EFFECTIVENESS</span>
      <span class="score-value">{formatScore(skill.effectivenessScore)}</span>
    </div>

    <div class="card-actions">
      {#if onselect}
        <button
          class="action-btn"
          onclick={() => onselect(skill)}
          aria-label={selected ? 'Deselect' : 'Select'}
        >
          {selected ? 'Selected' : 'Select'}
        </button>
      {/if}
      {#if onedit}
        <button
          class="action-btn edit-btn"
          onclick={() => onedit(skill)}
          aria-label="Edit skill"
        >
          Edit
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .skill-card {
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    position: relative;
    transition: border-color 0.15s ease, transform 0.15s ease;
  }

  .skill-card:hover {
    border-color: var(--bo-violet);
    transform: translateY(-1px);
  }

  .skill-card.selected {
    border-color: var(--bo-violet);
    background: rgba(236, 232, 255, 0.06);
  }

  .skill-card.pending {
    border-left: 3px solid var(--bo-amber);
  }

  .pending-badge {
    position: absolute;
    top: var(--space-sm);
    right: var(--space-sm);
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-amber);
    background: rgba(251, 191, 36, 0.10);
    border: 1px solid rgba(251, 191, 36, 0.32);
    padding: 3px 7px;
    border-radius: 3px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .skill-name {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    color: var(--bo-text);
    flex: 1;
  }

  .effectiveness-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .card-meta {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .category-tag,
  .source-tag {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    padding: 3px 7px;
    border-radius: 3px;
  }

  .category-tag {
    color: var(--bo-violet);
    background: rgba(168, 144, 255, 0.10);
    border: 1px solid rgba(168, 144, 255, 0.24);
  }

  .source-tag {
    color: var(--bo-faint);
    background: rgba(168, 144, 255, 0.04);
    border: 1px solid rgba(168, 144, 255, 0.16);
  }

  .trigger-patterns {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: var(--space-xs);
  }

  .pattern-chip {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-caption);
    background: rgba(168, 144, 255, 0.06);
    border: 1px solid var(--bo-border);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .pattern-more {
    color: var(--bo-faint);
  }

  .card-footer {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-md);
    margin-top: var(--space-sm);
  }

  .score-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .score-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
  }

  .score-value {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-text);
  }

  .card-actions {
    display: flex;
    gap: var(--space-sm);
  }

  .action-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.08em;
    color: var(--bo-violet);
    background: transparent;
    border: 1px solid var(--bo-violet);
    padding: 5px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .action-btn:hover {
    background: rgba(168, 144, 255, 0.10);
  }

  .edit-btn {
    color: var(--bo-faint);
    border-color: var(--bo-faint);
  }

  .edit-btn:hover {
    background: rgba(168, 144, 255, 0.06);
  }
</style>
