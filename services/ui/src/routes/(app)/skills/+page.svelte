<script lang="ts">
  import { onMount } from 'svelte';
  import { setMode, getMode, type AkasaMode } from '$lib/mode';
  import { getSkills, createSkill, updateSkill, deleteSkill, type Skill } from '$lib/api';
  import SkillEffectiveness from '$lib/components/evolution/SkillEffectiveness.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let previousMode: AkasaMode | null = $state(null);

  onMount(() => {
    previousMode = getMode();
    setMode('back-office');
    return () => {
      if (previousMode && previousMode !== 'back-office') {
        setMode(previousMode);
      }
    };
  });

  const CATEGORIES = [
    'communication', 'analysis', 'creation', 'automation',
    'research', 'coordination', 'monitoring', 'other',
  ] as const;

  const CATEGORY_COLORS: Record<string, string> = {
    communication: 'var(--bo-teal)',
    analysis: 'var(--bo-violet)',
    creation: 'var(--bo-amber)',
    automation: 'var(--bo-rose)',
    research: 'var(--bo-vb)',
    coordination: 'var(--bo-teal)',
    monitoring: 'var(--bo-amber)',
    other: 'var(--bo-faint)',
  };

  let skills = $state<Skill[]>(data.skills);
  let filterCategory = $state<string>('');
  let showCreate = $state(false);
  let editingSkill = $state<Skill | null>(null);
  let expandedSkillId = $state<string | null>(null);
  let loading = $state(false);
  let actionError = $state<string | null>(null);

  // Create form state
  let formContent = $state('');
  let formErrors = $state<string[]>([]);

  const filteredSkills = $derived.by(() => {
    if (!filterCategory) return skills;
    return skills.filter((s) => s.category === filterCategory);
  });

  const categoryStats = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const s of skills) {
      counts[s.category] = (counts[s.category] ?? 0) + 1;
    }
    return counts;
  });

  const SKILL_TEMPLATE = `---
name: "My Skill"
description: "What this skill does"
category: other
version: "1.0.0"
triggers: ["pattern.*match"]
requires_tools: []
requires_skills: []
min_agent_class: "Novice"
---

## Purpose

Describe what this skill enables the agent to do.

## Procedure

Step-by-step instructions for the agent.

1. First step
2. Second step
3. Third step

## Reference

- Key concepts or links the agent should know about.`;

  async function handleCreate() {
    if (!formContent.trim()) {
      formErrors = ['Content is required'];
      return;
    }

    loading = true;
    actionError = null;
    formErrors = [];

    try {
      const created = await createSkill({
        userId: data.userId,
        content: formContent,
        source: 'user_created',
      });
      skills = [created, ...skills];
      formContent = '';
      showCreate = false;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('errors')) {
        try {
          const parsed = JSON.parse(msg.split(': ').slice(1).join(': '));
          formErrors = parsed.errors ?? [msg];
        } catch {
          formErrors = [msg];
        }
      } else {
        actionError = msg;
      }
    } finally {
      loading = false;
    }
  }

  async function handleUpdate() {
    if (!editingSkill) return;

    loading = true;
    actionError = null;
    formErrors = [];

    try {
      const updated = await updateSkill(editingSkill.id, {
        content: formContent,
      });
      skills = skills.map((s) => (s.id === updated.id ? updated : s));
      editingSkill = null;
      formContent = '';
    } catch (err) {
      const msg = (err as Error).message;
      formErrors = [msg];
    } finally {
      loading = false;
    }
  }

  async function handleDelete(skillId: string) {
    loading = true;
    actionError = null;

    try {
      await deleteSkill(skillId);
      skills = skills.filter((s) => s.id !== skillId);
      if (expandedSkillId === skillId) expandedSkillId = null;
    } catch (err) {
      actionError = (err as Error).message;
    } finally {
      loading = false;
    }
  }

  function startEdit(skill: Skill) {
    editingSkill = skill;
    formContent = skill.content;
    showCreate = false;
  }

  function startCreate() {
    showCreate = true;
    editingSkill = null;
    formContent = SKILL_TEMPLATE;
    formErrors = [];
  }

  function cancelForm() {
    showCreate = false;
    editingSkill = null;
    formContent = '';
    formErrors = [];
  }

  function toggleExpand(skillId: string) {
    expandedSkillId = expandedSkillId === skillId ? null : skillId;
  }

  async function refreshSkills() {
    try {
      skills = await getSkills(data.userId, filterCategory ? { category: filterCategory } : undefined);
    } catch { /* silent */ }
  }
</script>

<div class="skills-page">
  <div class="page-header">
    <div class="header-left">
      <h1 class="page-title">Skills Library</h1>
      <span class="skill-count">{skills.length} skill{skills.length !== 1 ? 's' : ''}</span>
    </div>
    <button class="create-btn" onclick={startCreate} disabled={showCreate || editingSkill !== null}>
      + NEW SKILL
    </button>
  </div>

  <!-- Category filter bar -->
  <div class="filter-bar">
    <button
      class="filter-chip"
      class:active={filterCategory === ''}
      onclick={() => (filterCategory = '')}
    >
      ALL
      <span class="chip-count">{skills.length}</span>
    </button>
    {#each CATEGORIES as cat}
      {#if categoryStats[cat]}
        <button
          class="filter-chip"
          class:active={filterCategory === cat}
          onclick={() => (filterCategory = cat)}
        >
          <span class="chip-dot" style="background: {CATEGORY_COLORS[cat]}"></span>
          {cat.toUpperCase()}
          <span class="chip-count">{categoryStats[cat]}</span>
        </button>
      {/if}
    {/each}
  </div>

  {#if actionError}
    <div class="action-error">
      <span>{actionError}</span>
      <button class="dismiss-btn" onclick={() => (actionError = null)}>dismiss</button>
    </div>
  {/if}

  <!-- Create / Edit form -->
  {#if showCreate || editingSkill}
    <div class="form-section">
      <div class="form-header">
        <h2 class="form-title">{editingSkill ? 'Edit Skill' : 'Create New Skill'}</h2>
        <button class="cancel-btn" onclick={cancelForm}>CANCEL</button>
      </div>

      {#if formErrors.length > 0}
        <div class="form-errors">
          {#each formErrors as err}
            <p class="form-error">{err}</p>
          {/each}
        </div>
      {/if}

      <textarea
        class="content-editor"
        bind:value={formContent}
        rows="20"
        placeholder="Paste your SKILL.md content here..."
        spellcheck="false"
      ></textarea>

      <div class="form-actions">
        <button
          class="submit-btn"
          disabled={loading}
          onclick={editingSkill ? handleUpdate : handleCreate}
        >
          {loading ? 'SAVING...' : editingSkill ? 'UPDATE SKILL' : 'CREATE SKILL'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Skills list -->
  {#if filteredSkills.length === 0 && !showCreate}
    <div class="empty-state">
      <p class="empty-title">
        {skills.length === 0 ? 'No skills yet' : 'No skills in this category'}
      </p>
      <p class="empty-body">
        {skills.length === 0
          ? 'Create your first skill to start building your agent capabilities.'
          : 'Try a different filter or create a new skill.'}
      </p>
      {#if skills.length === 0}
        <button class="create-btn small" onclick={startCreate}>+ CREATE SKILL</button>
      {/if}
    </div>
  {:else}
    <div class="skills-list">
      {#each filteredSkills as skill (skill.id)}
        <div class="skill-card" class:expanded={expandedSkillId === skill.id}>
          <button class="skill-card-header" onclick={() => toggleExpand(skill.id)}>
            <div class="skill-card-left">
              <span
                class="cat-dot"
                style="background: {CATEGORY_COLORS[skill.category] ?? 'var(--bo-faint)'}"
              ></span>
              <div class="skill-title-block">
                <span class="skill-name">{skill.name}</span>
                <span class="skill-desc">{skill.description}</span>
              </div>
            </div>
            <div class="skill-card-right">
              <span class="skill-category-label">{skill.category.toUpperCase()}</span>
              <span class="skill-version">v{skill.version}</span>
              <span class="skill-class">{skill.minAgentClass}</span>
              <span class="expand-icon" class:open={expandedSkillId === skill.id}></span>
            </div>
          </button>

          {#if expandedSkillId === skill.id}
            <div class="skill-detail">
              <!-- Effectiveness Stats -->
              <div class="detail-section">
                <h4 class="detail-label">EFFECTIVENESS</h4>
                <SkillEffectiveness stats={skill.effectivenessStats} />
              </div>

              <!-- Triggers -->
              {#if skill.triggers && skill.triggers.length > 0}
                <div class="detail-section">
                  <h4 class="detail-label">TRIGGERS</h4>
                  <div class="tag-list">
                    {#each skill.triggers as trigger}
                      <span class="tag">{trigger}</span>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Required Tools -->
              {#if skill.requiresTools && skill.requiresTools.length > 0}
                <div class="detail-section">
                  <h4 class="detail-label">REQUIRED TOOLS</h4>
                  <div class="tag-list">
                    {#each skill.requiresTools as tool}
                      <span class="tag tool">{tool}</span>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Source badge -->
              <div class="detail-section inline">
                <span class="source-badge">{skill.source.replace('_', ' ').toUpperCase()}</span>
                <span class="created-at">
                  Created {new Date(skill.createdAt).toLocaleDateString()}
                </span>
              </div>

              <!-- Actions -->
              <div class="skill-actions">
                <button class="action-btn edit" onclick={() => startEdit(skill)}>
                  EDIT
                </button>
                <button
                  class="action-btn delete"
                  disabled={loading}
                  onclick={() => handleDelete(skill.id)}
                >
                  DELETE
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .skills-page {
    max-width: 900px;
    padding: var(--space-2xl) var(--space-xl) var(--space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-left {
    display: flex;
    align-items: baseline;
    gap: var(--space-md);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0;
  }

  .skill-count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--bo-faint);
  }

  .create-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-bg);
    background: var(--bo-violet);
    border: none;
    padding: 6px 14px;
    border-radius: 4px;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .create-btn:hover:not(:disabled) {
    opacity: 0.85;
  }

  .create-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .create-btn.small {
    margin-top: var(--space-md);
  }

  /* Filter bar */
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .filter-chip {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    background: transparent;
    border: 1px solid var(--bo-border);
    padding: 4px 10px;
    border-radius: 3px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: all 0.15s ease;
  }

  .filter-chip:hover {
    color: var(--bo-text);
    border-color: var(--bo-bhi);
  }

  .filter-chip.active {
    color: var(--bo-text);
    background: rgba(124, 58, 237, 0.15);
    border-color: var(--bo-violet);
  }

  .chip-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  .chip-count {
    font-family: var(--font-mono);
    font-size: 8px;
    opacity: 0.6;
  }

  /* Error banner */
  .action-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    background: rgba(244, 114, 182, 0.08);
    border: 1px solid rgba(244, 114, 182, 0.25);
    border-radius: var(--radius-md);
    font-size: 12px;
    color: var(--bo-rose);
  }

  .dismiss-btn {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-rose);
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
  }

  /* Form section */
  .form-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-lg);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
  }

  .form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .form-title {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0;
  }

  .cancel-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    background: none;
    border: 1px solid var(--bo-border);
    padding: 4px 10px;
    border-radius: 3px;
    cursor: pointer;
  }

  .cancel-btn:hover {
    color: var(--bo-text);
    border-color: var(--bo-bhi);
  }

  .form-errors {
    padding: var(--space-sm) var(--space-md);
    background: rgba(244, 114, 182, 0.06);
    border: 1px solid rgba(244, 114, 182, 0.2);
    border-radius: var(--radius-md);
  }

  .form-error {
    font-size: 11px;
    color: var(--bo-rose);
    margin: 2px 0;
  }

  .content-editor {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.6;
    color: var(--bo-text);
    background: var(--bo-bg);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    resize: vertical;
    min-height: 300px;
  }

  .content-editor::placeholder {
    color: var(--bo-faint);
  }

  .content-editor:focus {
    outline: none;
    border-color: var(--bo-violet);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
  }

  .submit-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-bg);
    background: var(--bo-violet);
    border: none;
    padding: 6px 18px;
    border-radius: 4px;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .submit-btn:hover:not(:disabled) {
    opacity: 0.85;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Empty state */
  .empty-state {
    padding: var(--space-2xl);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .empty-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-sm);
  }

  .empty-body {
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
  }

  /* Skills list */
  .skills-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .skill-card {
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    overflow: hidden;
    transition: border-color 0.15s ease;
  }

  .skill-card:hover {
    border-color: var(--bo-bhi);
  }

  .skill-card.expanded {
    border-color: var(--bo-violet);
  }

  .skill-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-md);
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    color: inherit;
  }

  .skill-card-left {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex: 1;
    min-width: 0;
  }

  .cat-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .skill-title-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .skill-name {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: var(--bo-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .skill-desc {
    font-size: 11px;
    color: var(--bo-faint);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .skill-card-right {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-shrink: 0;
  }

  .skill-category-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
  }

  .skill-version {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--bo-faint);
  }

  .skill-class {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    border: 1px solid var(--bo-border);
    padding: 1px 4px;
    border-radius: 2px;
  }

  .expand-icon {
    display: inline-block;
    width: 0;
    height: 0;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-top: 4px solid var(--bo-faint);
    transition: transform 0.2s ease;
  }

  .expand-icon.open {
    transform: rotate(180deg);
  }

  /* Skill detail */
  .skill-detail {
    padding: 0 var(--space-md) var(--space-md);
    border-top: 1px solid var(--bo-border);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding-top: var(--space-md);
  }

  .detail-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .detail-section.inline {
    flex-direction: row;
    align-items: center;
    gap: var(--space-md);
  }

  .detail-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    margin: 0;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tag {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--bo-muted);
    background: rgba(124, 58, 237, 0.06);
    border: 1px solid var(--bo-border);
    padding: 2px 6px;
    border-radius: 2px;
  }

  .tag.tool {
    color: var(--bo-amber);
    background: rgba(251, 191, 36, 0.06);
    border-color: rgba(251, 191, 36, 0.2);
  }

  .source-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-muted);
    background: rgba(236, 232, 255, 0.04);
    border: 1px solid var(--bo-border);
    padding: 2px 6px;
    border-radius: 2px;
  }

  .created-at {
    font-size: 11px;
    color: var(--bo-faint);
  }

  .skill-actions {
    display: flex;
    gap: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--bo-border);
  }

  .action-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    padding: 4px 12px;
    border-radius: 3px;
    cursor: pointer;
    border: 1px solid;
    background: transparent;
    transition: all 0.15s ease;
  }

  .action-btn.edit {
    color: var(--bo-violet);
    border-color: rgba(124, 58, 237, 0.25);
  }

  .action-btn.edit:hover {
    background: rgba(124, 58, 237, 0.1);
    border-color: var(--bo-violet);
  }

  .action-btn.delete {
    color: var(--bo-rose);
    border-color: rgba(244, 114, 182, 0.25);
  }

  .action-btn.delete:hover:not(:disabled) {
    background: rgba(244, 114, 182, 0.1);
    border-color: var(--bo-rose);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
