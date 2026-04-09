<script lang="ts">
  import type { Skill } from '$lib/api.js';

  let { skill, onedit }: {
    skill: Skill;
    onedit?: (skill: Skill) => void;
  } = $props();

  const EFFECTIVENESS_COLORS: Record<string, string> = {
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
</script>

<div class="skill-card">
  <div class="skill-header">
    <h3 class="skill-name">{skill.name}</h3>
    {#if !skill.isApproved}
      <span class="pending-badge">PENDING</span>
    {/if}
  </div>

  <div class="skill-meta">
    <span class="category-tag">{skill.category.toUpperCase()}</span>
    <span class="source-tag source-{skill.source}">{SOURCE_LABELS[skill.source]}</span>
  </div>

  <div class="trigger-patterns">
    {#each skill.triggerPatterns as pattern}
      <span class="trigger-chip">{pattern}</span>
    {/each}
  </div>

  <div class="skill-footer">
    <div class="effectiveness">
      <span class="eff-label">EFFECTIVENESS</span>
      <span
        class="eff-score"
        style="color: {EFFECTIVENESS_COLORS[skill.effectivenessClassification]}"
      >
        {skill.effectivenessScore !== null
          ? (skill.effectivenessScore * 100).toFixed(0) + '%'
          : '—'}
      </span>
    </div>

    {#if onedit}
      <button class="edit-btn" onclick={() => onedit(skill)}>EDIT</button>
    {/if}
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
    gap: var(--space-md);
    transition: border-color 0.15s ease;
  }

  .skill-card:hover {
    border-color: var(--bo-bhi);
  }

  .skill-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .skill-name {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0;
  }

  .pending-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-amber);
    border: 1px solid var(--bo-amber);
    padding: 2px 6px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .skill-meta {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .category-tag {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-violet);
    background: rgba(124, 58, 237, 0.10);
    border: 1px solid rgba(124, 58, 237, 0.24);
    padding: 2px 6px;
    border-radius: 2px;
  }

  .source-tag {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    padding: 2px 6px;
    border-radius: 2px;
  }

  .source-authored {
    color: var(--bo-teal);
    background: rgba(45, 212, 191, 0.10);
    border: 1px solid rgba(45, 212, 191, 0.24);
  }

  .source-learned {
    color: var(--bo-vb);
    background: rgba(167, 139, 250, 0.10);
    border: 1px solid rgba(167, 139, 250, 0.24);
  }

  .source-acquired {
    color: var(--bo-rose);
    background: rgba(244, 114, 182, 0.10);
    border: 1px solid rgba(244, 114, 182, 0.24);
  }

  .trigger-patterns {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }

  .trigger-chip {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--bo-muted);
    background: var(--bo-bg);
    border: 1px solid var(--bo-border);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
  }

  .skill-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
  }

  .effectiveness {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .eff-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-caption);
  }

  .eff-score {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
  }

  .edit-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-vb);
    background: none;
    border: 1px solid var(--bo-border);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .edit-btn:hover {
    border-color: var(--bo-violet);
    color: var(--bo-text);
  }
</style>
