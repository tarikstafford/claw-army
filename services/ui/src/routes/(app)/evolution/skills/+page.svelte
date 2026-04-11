<script lang="ts">
  import type { PageData } from './$types';
  import type { Skill, SkillCategory, SkillSource, EffectivenessClass, CreateSkillInput } from '$lib/api';
  import SkillCard from '$lib/components/evolution/SkillCard.svelte';
  import SkillEditor from '$lib/components/evolution/SkillEditor.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { invalidateAll } from '$app/navigation';

  let { data }: { data: PageData } = $props();

  let filterCategory = $state<SkillCategory | ''>('');
  let filterSource = $state<SkillSource | ''>('');
  let filterEffectiveness = $state<EffectivenessClass | ''>('');
  let showPendingOnly = $state(false);
  let editorOpen = $state(false);
  let editingSkill = $state<Skill | undefined>(undefined);
  let confirmDelete = $state<Skill | null>(null);
  let isSaving = $state(false);

  const filteredSkills = $derived.by(() => {
    let skills = data.skills as Skill[];
    if (filterCategory) skills = skills.filter(s => s.category === filterCategory);
    if (filterSource) skills = skills.filter(s => s.source === filterSource);
    if (filterEffectiveness) skills = skills.filter(s => s.effectivenessClass === filterEffectiveness);
    if (showPendingOnly) skills = skills.filter(s => s.pendingApproval);
    return skills;
  });

  const pendingCount = $derived((data.skills as Skill[]).filter(s => s.pendingApproval).length);

  async function handleSave(input: CreateSkillInput) {
    if (!data.companyId) return;
    isSaving = true;
    try {
      if (editingSkill) {
        await data.updateSkill(editingSkill.id, input);
      } else {
        await data.createSkill(data.companyId, input);
      }
      editorOpen = false;
      editingSkill = undefined;
      await invalidateAll();
    } finally {
      isSaving = false;
    }
  }

  async function handleDelete(skill: Skill) {
    await data.deleteSkill(skill.id);
    confirmDelete = null;
    await invalidateAll();
  }

  function openCreate() {
    editingSkill = undefined;
    editorOpen = true;
  }

  function openEdit(skill: Skill) {
    editingSkill = skill;
    editorOpen = true;
  }
</script>

<div class="skills-page">
  <div class="page-header">
    <div class="header-left">
      <h1 class="page-title">Skill Library</h1>
      {#if pendingCount > 0}
        <a href="#pending" class="pending-badge">
          {pendingCount} PENDING REVIEW
        </a>
      {/if}
    </div>
    <button class="create-btn" onclick={openCreate}>
      + New Skill
    </button>
  </div>

  <div class="filters-bar">
    <div class="filter-group">
      <label class="filter-label" for="filter-category">CATEGORY</label>
      <select id="filter-category" class="filter-select" bind:value={filterCategory}>
        <option value="">All</option>
        <option value="reasoning">REASONING</option>
        <option value="communication">COMMUNICATION</option>
        <option value="tool-use">TOOL-USE</option>
        <option value="memory">MEMORY</option>
        <option value="coordination">COORDINATION</option>
      </select>
    </div>

    <div class="filter-group">
      <label class="filter-label" for="filter-source">SOURCE</label>
      <select id="filter-source" class="filter-select" bind:value={filterSource}>
        <option value="">All</option>
        <option value="authored">AUTHORED</option>
        <option value="learned">LEARNED</option>
        <option value="acquired">ACQUIRED</option>
      </select>
    </div>

    <div class="filter-group">
      <label class="filter-label" for="filter-effectiveness">EFFECTIVENESS</label>
      <select id="filter-effectiveness" class="filter-select" bind:value={filterEffectiveness}>
        <option value="">All</option>
        <option value="high">HIGH</option>
        <option value="medium">MEDIUM</option>
        <option value="low">LOW</option>
        <option value="unknown">UNKNOWN</option>
      </select>
    </div>

    <label class="filter-check">
      <input type="checkbox" bind:checked={showPendingOnly} />
      <span>Pending only</span>
    </label>
  </div>

  {#if filteredSkills.length === 0}
    <div class="empty-state">
      <p class="empty-title">No skills found</p>
      <p class="empty-body">Create a skill to get started or adjust your filters.</p>
    </div>
  {:else}
    <div class="skills-grid">
      {#each filteredSkills as skill (skill.id)}
        <SkillCard
          {skill}
          onedit={(s) => openEdit(s)}
        />
      {/each}
    </div>
  {/if}

  {#if pendingCount > 0}
    <section id="pending" class="pending-section">
      <h2 class="section-heading">Pending Approval</h2>
      <div class="skills-grid">
        {#each (data.skills as Skill[]).filter(s => s.pendingApproval) as skill (skill.id)}
          <SkillCard
            {skill}
            onedit={(s) => openEdit(s)}
          />
        {/each}
      </div>
    </section>
  {/if}
</div>

{#if editorOpen}
  <Modal
    open={true}
    title={editingSkill ? 'Edit Skill' : 'Create Skill'}
    onclose={() => { editorOpen = false; editingSkill = undefined; }}
  >
    <SkillEditor
      skill={editingSkill}
      mode={editingSkill ? 'edit' : 'create'}
      onsave={handleSave}
      oncancel={() => { editorOpen = false; editingSkill = undefined; }}
    />
  </Modal>
{/if}

{#if confirmDelete}
  <Modal
    open={true}
    title="Delete Skill?"
    onclose={() => { confirmDelete = null; }}
  >
    <p>Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This action cannot be undone.</p>
    <div class="modal-actions">
      <button
        class="btn btn-delete"
        onclick={() => handleDelete(confirmDelete!)}
      >
        Delete Skill
      </button>
      <button
        class="btn btn-cancel"
        onclick={() => { confirmDelete = null; }}
      >
        Cancel
      </button>
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
    gap: var(--space-md);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0;
  }

  .pending-badge {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-amber);
    background: rgba(251, 191, 36, 0.10);
    border: 1px solid rgba(251, 191, 36, 0.32);
    padding: 4px 10px;
    border-radius: 3px;
    text-decoration: none;
    transition: background 0.15s ease;
  }

  .pending-badge:hover {
    background: rgba(251, 191, 36, 0.16);
  }

  .create-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-bg);
    background: var(--bo-violet);
    border: 1px solid var(--bo-violet);
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s ease;
    min-height: 36px;
  }

  .create-btn:hover {
    background: rgba(168, 144, 255, 0.80);
  }

  .filters-bar {
    display: flex;
    align-items: flex-end;
    gap: var(--space-lg);
    flex-wrap: wrap;
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .filter-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
  }

  .filter-select {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-text);
    background: var(--bo-bg);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-sm);
    padding: var(--space-xs) var(--space-md);
    min-width: 120px;
    transition: border-color 0.15s ease;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--bo-violet);
  }

  .filter-check {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-caption);
  }

  .skills-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-md);
  }

  .empty-state {
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-2xl);
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

  .pending-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    border-top: 1px solid var(--bo-border);
    padding-top: var(--space-xl);
  }

  .section-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-amber);
    margin: 0;
  }

  .modal-actions {
    display: flex;
    gap: var(--space-md);
    margin-top: var(--space-lg);
  }

  .btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s ease;
    min-height: 36px;
    flex: 1;
  }

  .btn-delete {
    background: var(--bo-rose);
    color: white;
    border: 1px solid var(--bo-rose);
  }

  .btn-delete:hover {
    background: rgba(244, 114, 182, 0.80);
  }

  .btn-cancel {
    background: transparent;
    color: var(--bo-faint);
    border: 1px solid var(--bo-border);
  }

  .btn-cancel:hover {
    background: rgba(168, 144, 255, 0.06);
  }
</style>
