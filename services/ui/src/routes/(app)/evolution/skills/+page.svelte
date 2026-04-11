<script lang="ts">
  import SkillCard from '$lib/components/evolution/SkillCard.svelte';
  import SkillEditor from '$lib/components/evolution/SkillEditor.svelte';
  import FleetSkillHeatmap from '$lib/components/evolution/FleetSkillHeatmap.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import {
    createSkill,
    updateSkill,
    deleteSkill,
    approveSkill,
    type Skill,
    type SkillCategory,
    type SkillSource,
    type EffectivenessClass,
    type CreateSkillInput
  } from '$lib/api';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let filterCategory = $state<SkillCategory | 'all'>('all');
  let filterSource = $state<SkillSource | 'all'>('all');
  let filterEffectiveness = $state<EffectivenessClass | 'all'>('all');
  let showEditor = $state(false);
  let editingSkill = $state<Skill | null>(null);
  let showPending = $state(false);

  const CATEGORIES: Array<{ value: SkillCategory | 'all'; label: string }> = [
    { value: 'all', label: 'ALL' },
    { value: 'communication', label: 'COMMUNICATION' },
    { value: 'reasoning', label: 'REASONING' },
    { value: 'execution', label: 'EXECUTION' },
    { value: 'coordination', label: 'COORDINATION' },
    { value: 'creative', label: 'CREATIVE' },
  ];

  const SOURCES: Array<{ value: SkillSource | 'all'; label: string }> = [
    { value: 'all', label: 'ALL SOURCES' },
    { value: 'authored', label: 'AUTHORED' },
    { value: 'learned', label: 'LEARNED' },
    { value: 'acquired', label: 'ACQUIRED' },
  ];

  const EFFECTIVENESS_OPTIONS: Array<{ value: EffectivenessClass | 'all'; label: string }> = [
    { value: 'all', label: 'ALL' },
    { value: 'exceptional', label: 'EXCEPTIONAL' },
    { value: 'good', label: 'GOOD' },
    { value: 'average', label: 'AVERAGE' },
    { value: 'poor', label: 'POOR' },
    { value: 'untested', label: 'UNTESTED' },
  ];

  function getEffectivenessClass(score: number | null): EffectivenessClass {
    if (score === null) return 'untested';
    if (score >= 0.85) return 'exceptional';
    if (score >= 0.70) return 'good';
    if (score >= 0.50) return 'average';
    return 'poor';
  }

  let filteredSkills = $derived(
    data.skills.filter((s: Skill) => {
      if (filterCategory !== 'all' && s.category !== filterCategory) return false;
      if (filterSource !== 'all' && s.source !== filterSource) return false;
      if (filterEffectiveness !== 'all') {
        const effClass = getEffectivenessClass(s.avgEffectivenessScore);
        if (effClass !== filterEffectiveness) return false;
      }
      return true;
    })
  );

  let pendingCount = $derived(data.pendingApprovals?.length ?? 0);

  function openCreateEditor() {
    editingSkill = null;
    showEditor = true;
  }

  function openEditEditor(skill: Skill) {
    editingSkill = skill;
    showEditor = true;
  }

  function closeEditor() {
    showEditor = false;
    editingSkill = null;
  }

  async function handleSave(input: CreateSkillInput) {
    try {
      if (editingSkill) {
        await updateSkill(editingSkill.id, input);
      } else {
        await createSkill(data.companyId, input);
      }
      window.location.reload();
    } catch (err) {
      console.error('Failed to save skill:', err);
    }
  }

  async function handleDelete(skillId: string) {
    try {
      await deleteSkill(skillId);
      window.location.reload();
    } catch (err) {
      console.error('Failed to delete skill:', err);
    }
  }

  async function handleApprove(skillId: string) {
    try {
      await approveSkill(skillId);
      window.location.reload();
    } catch (err) {
      console.error('Failed to approve skill:', err);
    }
  }

  function getSkillAgentIds(): string[] {
    const ids = new Set<string>();
    for (const cell of data.heatmap ?? []) {
      ids.add(cell.botId);
    }
    return Array.from(ids);
  }
</script>

<div class="skills-page">
  <div class="page-header">
    <div class="header-left">
      <h1 class="page-title">SKILL LIBRARY</h1>
      <span class="skill-count">{filteredSkills.length} skills</span>
    </div>
    <div class="header-right">
      {#if pendingCount > 0}
        <button class="pending-badge-btn" onclick={() => showPending = true}>
          <span class="pending-icon">!</span>
          PENDING ({pendingCount})
        </button>
      {/if}
      <button class="create-btn" onclick={openCreateEditor}>+ New Skill</button>
    </div>
  </div>

  <div class="filters">
    <div class="filter-group">
      <label class="filter-label" for="filter-category">CATEGORY</label>
      <select id="filter-category" class="filter-select" bind:value={filterCategory}>
        {#each CATEGORIES as cat}
          <option value={cat.value}>{cat.label}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <label class="filter-label" for="filter-source">SOURCE</label>
      <select id="filter-source" class="filter-select" bind:value={filterSource}>
        {#each SOURCES as src}
          <option value={src.value}>{src.label}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <label class="filter-label" for="filter-effectiveness">EFFECTIVENESS</label>
      <select id="filter-effectiveness" class="filter-select" bind:value={filterEffectiveness}>
        {#each EFFECTIVENESS_OPTIONS as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>
  </div>

  <FleetSkillHeatmap
    heatmapData={data.heatmap ?? []}
    skills={data.skills ?? []}
    agentIds={getSkillAgentIds()}
  />

  <div class="skills-grid">
    {#each filteredSkills as skill (skill.id)}
      <SkillCard {skill} onclick={openEditEditor} />
    {/each}
    {#if filteredSkills.length === 0}
      <div class="empty-state">
        <p class="empty-title">No skills found</p>
        <p class="empty-body">Create a new skill or adjust your filters.</p>
      </div>
    {/if}
  </div>
</div>

{#if showEditor}
  <Modal open={showEditor} title={editingSkill ? 'Edit Skill' : 'New Skill'} onclose={closeEditor}>
    <SkillEditor
      initialName={editingSkill?.name ?? ''}
      initialCategory={editingSkill?.category ?? 'execution'}
      initialTriggerPatterns={editingSkill?.triggerPatterns ?? []}
      initialSource={editingSkill?.source ?? 'authored'}
      initialContent={editingSkill?.content ?? ''}
      onSave={handleSave}
      onCancel={closeEditor}
    />
  </Modal>
{/if}

{#if showPending}
  <Modal open={showPending} title="Pending Approvals" onclose={() => showPending = false}>
    <div class="pending-list">
      {#each data.pendingApprovals ?? [] as approval}
        <div class="pending-item">
          <div class="pending-info">
            <span class="pending-name">{approval.skillName}</span>
            <span class="pending-meta">{approval.category} • confidence: {(approval.confidenceLevel * 100).toFixed(0)}%</span>
          </div>
          <button class="approve-btn" onclick={() => handleApprove(approval.id)}>Approve</button>
        </div>
      {/each}
      {#if !data.pendingApprovals || data.pendingApprovals.length === 0}
        <p class="empty-pending">No pending approvals</p>
      {/if}
    </div>
  </Modal>
{/if}

<style>
  .skills-page {
    padding: var(--space-2xl) var(--space-xl) var(--space-xl);
    max-width: 960px;
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-md);
  }

  .header-left {
    display: flex;
    align-items: baseline;
    gap: var(--space-md);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0;
  }

  .skill-count {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-faint);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .pending-badge-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.08em;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid rgba(251, 191, 36, 0.32);
    background: rgba(251, 191, 36, 0.10);
    color: var(--bo-amber);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .pending-badge-btn:hover {
    background: rgba(251, 191, 36, 0.15);
  }

  .pending-icon {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--bo-amber);
    color: var(--bo-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
  }

  .create-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.08em;
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    border: none;
    background: var(--bo-violet);
    color: #fff;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .create-btn:hover {
    background: var(--bo-vb);
  }

  .filters {
    display: flex;
    gap: var(--space-lg);
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .filter-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
    color: var(--bo-faint);
  }

  .filter-select {
    font-family: var(--font-body);
    font-size: 12px;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--bo-border);
    background: var(--bo-card);
    color: var(--bo-text);
    cursor: pointer;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--bo-violet);
  }

  .skills-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--space-md);
  }

  .empty-state {
    grid-column: 1 / -1;
    padding: var(--space-2xl);
    background: var(--bo-card);
    border: 1px dashed var(--bo-border);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .empty-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-sm);
  }

  .empty-body {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
  }

  .pending-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .pending-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
  }

  .pending-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pending-name {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--bo-text);
  }

  .pending-meta {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-faint);
  }

  .approve-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.08em;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--bo-teal);
    background: transparent;
    color: var(--bo-teal);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .approve-btn:hover {
    background: var(--bo-teal);
    color: var(--bo-bg);
  }

  .empty-pending {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-faint);
    text-align: center;
    padding: var(--space-lg);
    margin: 0;
  }
</style>
