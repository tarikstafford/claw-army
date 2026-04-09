<script lang="ts">
  import SkillCard from '$lib/components/evolution/SkillCard.svelte';
  import SkillEditor from '$lib/components/evolution/SkillEditor.svelte';
  import type { PageData } from './$types';
  import type { Skill, CreateSkillInput, UpdateSkillInput } from '$lib/api.js';

  let { data }: { data: PageData } = $props();

  let skills = $state<Skill[]>(data.skills ?? []);
  let pendingReviews = $state(data.pendingReviews ?? []);
  let filterCategory = $state('');
  let filterSource = $state('');
  let filterEffectiveness = $state('');
  let showEditor = $state(false);
  let editingSkill = $state<Skill | undefined>(undefined);
  let toastMsg = $state('');

  const CATEGORIES = ['execution', 'planning', 'communication', 'analysis', 'coordination'];
  const SOURCES = ['authored', 'learned', 'acquired'] as const;
  const EFFECTIVENESS_LEVELS = ['high', 'medium', 'low', 'unknown'] as const;

  const filteredSkills = $derived(skills.filter(s => {
    if (filterCategory && s.category !== filterCategory) return false;
    if (filterSource && s.source !== filterSource) return false;
    if (filterEffectiveness && s.effectivenessClassification !== filterEffectiveness) return false;
    return true;
  }));

  const pendingCount = $derived(pendingReviews.length);

  function showToast(msg: string) {
    toastMsg = msg;
    setTimeout(() => { toastMsg = ''; }, 3500);
  }

  async function handleSave(input: CreateSkillInput | UpdateSkillInput) {
    if (editingSkill) {
      const updated = await import('$lib/api.js').then(m => m.updateSkill(editingSkill.id, input as UpdateSkillInput));
      skills = skills.map(s => s.id === updated.id ? updated : s);
      showToast('Skill updated');
    } else {
      const created = await import('$lib/api.js').then(m => m.createSkill('demo-company', input as CreateSkillInput));
      skills = [...skills, created];
      showToast('Skill created');
    }
    showEditor = false;
    editingSkill = undefined;
  }

  function handleEdit(skill: Skill) {
    editingSkill = skill;
    showEditor = true;
  }

  function handleNewSkill() {
    editingSkill = undefined;
    showEditor = true;
  }

  async function handleApprove(skillId: string) {
    const m = await import('$lib/api.js');
    const approved = await m.approveSkill(skillId);
    skills = skills.map(s => s.id === approved.id ? approved : s);
    pendingReviews = pendingReviews.filter(p => p.id !== skillId);
    showToast('Skill approved');
  }
</script>

<div class="skills-page">
  {#if toastMsg}
    <div class="toast" role="status">{toastMsg}</div>
  {/if}

  <div class="page-header">
    <h1 class="page-title">Skill Library</h1>
    {#if pendingCount > 0}
      <a href="#pending" class="pending-badge-link">
        <span class="pending-badge">{pendingCount} PENDING REVIEW</span>
      </a>
    {/if}
    <button class="btn-new" onclick={handleNewSkill}>+ NEW SKILL</button>
  </div>

  <div class="filters">
    <label class="filter-group">
      <span class="filter-label">CATEGORY</span>
      <select class="filter-select" bind:value={filterCategory}>
        <option value="">All</option>
        {#each CATEGORIES as cat}
          <option value={cat}>{cat}</option>
        {/each}
      </select>
    </label>

    <label class="filter-group">
      <span class="filter-label">SOURCE</span>
      <select class="filter-select" bind:value={filterSource}>
        <option value="">All</option>
        {#each SOURCES as src}
          <option value={src}>{src}</option>
        {/each}
      </select>
    </label>

    <label class="filter-group">
      <span class="filter-label">EFFECTIVENESS</span>
      <select class="filter-select" bind:value={filterEffectiveness}>
        <option value="">All</option>
        {#each EFFECTIVENESS_LEVELS as lvl}
          <option value={lvl}>{lvl}</option>
        {/each}
      </select>
    </label>
  </div>

  {#if showEditor}
    <div class="editor-section">
      <SkillEditor skill={editingSkill} onsave={handleSave} oncancel={() => { showEditor = false; editingSkill = undefined; }} />
    </div>
  {/if}

  <div class="skills-grid">
    {#if filteredSkills.length === 0}
      <div class="empty-state">
        <p class="empty-title">No skills match your filters</p>
        <p class="empty-body">Try adjusting filters or create a new skill</p>
      </div>
    {:else}
      {#each filteredSkills as skill (skill.id)}
        <SkillCard {skill} onedit={handleEdit} />
      {/each}
    {/if}
  </div>

  {#if pendingReviews.length > 0}
    <section id="pending" class="pending-section">
      <h2 class="section-heading">Pending Approval</h2>
      <div class="pending-list">
        {#each pendingReviews as pending (pending.id)}
          <div class="pending-item">
            <div class="pending-info">
              <span class="pending-name">{pending.skillName}</span>
              <span class="pending-meta">Learned by {pending.botId.slice(0, 8)} · confidence {pending.confidence.toFixed(2)}</span>
            </div>
            <button class="btn-approve" onclick={() => handleApprove(pending.id)}>APPROVE</button>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

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
    gap: var(--space-md);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0;
  }

  .pending-badge-link {
    text-decoration: none;
  }

  .pending-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-amber);
    border: 1px solid var(--bo-amber);
    padding: 2px 6px;
    border-radius: 2px;
  }

  .btn-new {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-text);
    background: var(--bo-violet);
    border: 1px solid var(--bo-violet);
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    margin-left: auto;
    transition: background 0.15s ease;
  }

  .btn-new:hover {
    background: var(--bo-vb);
  }

  .filters {
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
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
    color: var(--bo-caption);
  }

  .filter-select {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-text);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-sm);
    padding: 4px 8px;
    cursor: pointer;
  }

  .editor-section {
    background: var(--bo-bg);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
  }

  .skills-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-md);
  }

  .empty-state {
    grid-column: 1 / -1;
    padding: var(--space-2xl);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
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
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
  }

  .pending-section {
    border-top: 1px solid var(--bo-border);
    padding-top: var(--space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .section-heading {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--bo-text);
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
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--bo-card);
    border: 1px solid rgba(251, 191, 36, 0.24);
    border-radius: var(--radius-md);
  }

  .pending-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pending-name {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-text);
  }

  .pending-meta {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-faint);
  }

  .btn-approve {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-teal);
    background: none;
    border: 1px solid var(--bo-teal);
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-approve:hover {
    background: rgba(45, 212, 191, 0.10);
  }

  .toast {
    position: fixed;
    bottom: var(--space-xl);
    right: var(--space-xl);
    background: var(--bo-card);
    border: 1px solid var(--bo-teal);
    color: var(--bo-teal);
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-md);
    font-family: var(--font-body);
    font-size: 13px;
    z-index: 100;
    animation: toast-in 0.2s ease;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
