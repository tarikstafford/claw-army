<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';
  import {
    updateAgent,
    deleteAgent,
    getAgentSkills,
    getSkills,
    equipSkill,
    unequipSkill,
    type EquippedSkill,
    type Skill,
  } from '$lib/api';

  let { data }: { data: PageData } = $props();

  let activeTab = $state<'edit' | 'skills' | 'activity' | 'performance' | 'danger'>('edit');
  let editName = $state(data.agent.name);
  let editDescription = $state(data.agent.description ?? '');
  let editAdapter = $state(data.agent.adapter ?? 'claude');
  let editSaving = $state(false);
  let editError = $state('');
  let editSuccess = $state(false);

  let deleteConfirmName = $state('');
  let deleteLoading = $state(false);
  let deleteError = $state('');

  let skillsEquipped = $state<EquippedSkill[]>([]);
  let skillsAll = $state<Skill[]>([]);
  let skillsLoading = $state(true);
  let skillsError = $state<string | null>(null);
  let showSkillLibrary = $state(false);
  let skillFilterCategory = $state<string>('');
  let skillActionLoading = $state<string | null>(null);

  const ADAPTERS = [
    { value: 'claude', label: 'Claude (Anthropic)' },
    { value: 'codex', label: 'Codex (OpenAI)' },
    { value: 'gemini', label: 'Gemini (Google)' },
    { value: 'openclaw', label: 'OpenClaw' },
  ];

  const CLASS_CAPACITY: Record<string, number> = {
    Novice: 3,
    Understudy: 5,
    Artisan: 8,
    Retired: 0,
  };
  const CAPACITY = $derived(CLASS_CAPACITY[data.agent?.agentClass ?? 'Novice'] ?? 3);

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

  const TABS = [
    { id: 'edit' as const, label: 'EDIT' },
    { id: 'skills' as const, label: 'SKILLS' },
    { id: 'activity' as const, label: 'ACTIVITY' },
    { id: 'performance' as const, label: 'PERFORMANCE' },
    { id: 'danger' as const, label: 'DANGER ZONE' },
  ];

  const slotsUsed = $derived(skillsEquipped.length);
  const slotsFree = $derived(CAPACITY - slotsUsed);
  const equippedIds = $derived(new Set(skillsEquipped.map((s) => s.skillId)));

  const availableSkills = $derived.by(() => {
    let filtered = skillsAll.filter((s) => !equippedIds.has(s.id));
    if (skillFilterCategory) {
      filtered = filtered.filter((s) => s.category === skillFilterCategory);
    }
    return filtered;
  });

  const skillCategories = $derived.by(() => {
    const cats = new Set(skillsAll.map((s) => s.category));
    return Array.from(cats).sort();
  });

  const agentCostData = $derived(
    (data.spendByAgent as Array<{ agentId: string; agentName?: string | null; totalCents?: number; date?: string; cents?: number }>)
      .filter((p) => p.agentId === data.agent.id)
  );

  const totalAgentSpend = $derived(
    agentCostData.reduce((sum, p) => sum + (p.cents ?? p.totalCents ?? 0), 0)
  );

  async function loadSkills() {
    skillsLoading = true;
    skillsError = null;
    try {
      const [equippedRes, allSkillsRes] = await Promise.allSettled([
        getAgentSkills(data.agent.id),
        getSkills(data.userId),
      ]);
      skillsEquipped = equippedRes.status === 'fulfilled' ? equippedRes.value : [];
      skillsAll = allSkillsRes.status === 'fulfilled' ? allSkillsRes.value : [];
    } catch (err) {
      skillsError = (err as Error).message;
    } finally {
      skillsLoading = false;
    }
  }

  async function handleSkillEquip(skillId: string) {
    if (slotsFree <= 0) return;
    skillActionLoading = skillId;
    try {
      await equipSkill(data.agent.id, skillId, data.userId);
      await loadSkills();
    } catch (err) {
      skillsError = (err as Error).message;
    } finally {
      skillActionLoading = null;
    }
  }

  async function handleSkillUnequip(skillId: string) {
    skillActionLoading = skillId;
    try {
      await unequipSkill(data.agent.id, skillId);
      await loadSkills();
    } catch (err) {
      skillsError = (err as Error).message;
    } finally {
      skillActionLoading = null;
    }
  }

  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function getStatusLabel(status: string | null | undefined): string {
    switch (status) {
      case 'working':
        return 'working';
      case 'complete':
      case 'done':
        return 'done';
      default:
        return 'idle';
    }
  }

  function getStatusColor(status: string | null | undefined): string {
    switch (status) {
      case 'working':
        return 'var(--fo-gold)';
      case 'complete':
      case 'done':
        return 'var(--bo-teal)';
      default:
        return 'var(--text-muted)';
    }
  }

  function getTierLabel(adapter: string | null | undefined): string {
    if (!adapter) return '';
    if (adapter.includes('haiku') || adapter.includes('junior')) return 'JUNIOR';
    if (adapter.includes('sonnet') || adapter.includes('mid')) return 'MID';
    if (adapter.includes('opus') || adapter.includes('senior')) return 'SENIOR';
    return adapter.toUpperCase();
  }

  function getTierColor(adapter: string | null | undefined): string {
    if (!adapter) return 'var(--text-muted)';
    if (adapter.includes('haiku') || adapter.includes('junior')) return 'var(--tier-junior)';
    if (adapter.includes('sonnet') || adapter.includes('mid')) return 'var(--tier-mid)';
    if (adapter.includes('opus') || adapter.includes('senior')) return 'var(--tier-senior)';
    return 'var(--text-muted)';
  }

  async function handleSaveEdit() {
    editSaving = true;
    editError = '';
    editSuccess = false;
    try {
      await updateAgent(data.agent.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        adapter: editAdapter,
      });
      editSuccess = true;
      data.agent.name = editName.trim();
      data.agent.description = editDescription.trim() || null;
      data.agent.adapter = editAdapter;
    } catch (err) {
      editError = (err as Error).message ?? 'Failed to save changes';
    } finally {
      editSaving = false;
    }
  }

  async function handleDelete() {
    if (deleteConfirmName !== data.agent.name) {
      deleteError = 'Agent name does not match';
      return;
    }
    deleteLoading = true;
    deleteError = '';
    try {
      await deleteAgent(data.agent.id);
      goto('/office/agents');
    } catch (err) {
      deleteError = (err as Error).message ?? 'Failed to delete agent';
      deleteLoading = false;
    }
  }

  function resetEditForm() {
    editName = data.agent.name;
    editDescription = data.agent.description ?? '';
    editAdapter = data.agent.adapter ?? 'claude';
    editError = '';
    editSuccess = false;
  }

  $effect(() => {
    if (activeTab === 'skills') {
      loadSkills();
    }
  });
</script>

<div class="agent-detail">
  <div class="back-row">
    <a href="/office/agents" class="back-link">&larr; Agents</a>
  </div>

  <div class="agent-header">
    <h1 class="agent-name">{data.agent.name}</h1>
    <div class="agent-badges">
      <span class="status-badge" style="color: {getStatusColor(data.agent.status)}">
        <span class="status-dot" style="background: {getStatusColor(data.agent.status)}"></span>
        {getStatusLabel(data.agent.status)}
      </span>
      {#if data.agent.adapter}
        <span class="tier-badge" style="color: {getTierColor(data.agent.adapter)}">
          {getTierLabel(data.agent.adapter)}
        </span>
      {/if}
    </div>
  </div>

  <nav class="tab-nav" aria-label="Agent detail tabs">
    {#each TABS as tab}
      <button
        class="tab-btn"
        class:active={activeTab === tab.id}
        onclick={() => (activeTab = tab.id)}
        aria-selected={activeTab === tab.id}
      >{tab.label}</button>
    {/each}
  </nav>

  <div class="tab-content">
    {#if activeTab === 'edit'}
      <form class="edit-form" onsubmit={(e) => { e.preventDefault(); handleSaveEdit(); }}>
        <div class="field">
          <label for="name" class="field-label">Name</label>
          <input id="name" type="text" bind:value={editName} class="field-input" required />
        </div>

        <div class="field">
          <label for="description" class="field-label">Description</label>
          <textarea
            id="description"
            bind:value={editDescription}
            class="field-input field-textarea"
            rows="3"
          ></textarea>
        </div>

        <div class="field">
          <label for="adapter" class="field-label">Model / Adapter</label>
          <select id="adapter" bind:value={editAdapter} class="field-input field-select">
            {#each ADAPTERS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>

        {#if editError}
          <p class="field-error" role="alert">{editError}</p>
        {/if}

        {#if editSuccess}
          <p class="field-success" role="status">Changes saved successfully</p>
        {/if}

        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick={resetEditForm}>Reset</button>
          <button type="submit" class="btn-primary" disabled={editSaving}>
            {editSaving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>

      <div class="agent-meta">
        <div class="meta-row">
          <span class="meta-label">Adapter</span>
          <span class="meta-value">{data.agent.adapter ?? '—'}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Created</span>
          <span class="meta-value">{formatDate(data.agent.createdAt)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Last updated</span>
          <span class="meta-value">{formatDate(data.agent.updatedAt)}</span>
        </div>
      </div>
    {:else if activeTab === 'skills'}
      <div class="skill-loadout">
        <div class="loadout-header">
          <h3 class="loadout-title">Skill Loadout</h3>
          <div class="slot-meter">
            <span class="slot-label">SLOTS</span>
            <div class="slot-bar">
              {#each Array(CAPACITY) as _, i}
                <div class="slot-pip" class:filled={i < slotsUsed}></div>
              {/each}
            </div>
            <span class="slot-count">{slotsUsed}/{CAPACITY}</span>
          </div>
        </div>

        {#if skillsLoading}
          <div class="loading-state">
            <span class="loading-dot"></span>
            <span class="loading-text">Loading skills...</span>
          </div>
        {:else if skillsError}
          <div class="error-state">
            <p class="error-text">{skillsError}</p>
            <button class="retry-btn" onclick={loadSkills}>Retry</button>
          </div>
        {:else}
          <div class="equipped-section">
            {#if skillsEquipped.length === 0}
              <p class="empty-msg">No skills equipped. Open the library to equip skills.</p>
            {:else}
              <div class="equipped-list">
                {#each skillsEquipped as skill}
                  <div class="equipped-card">
                    <div class="skill-info">
                      <span
                        class="skill-cat-dot"
                        style="background: {CATEGORY_COLORS[skill.skillCategory] ?? 'var(--bo-faint)'}"
                      ></span>
                      <div class="skill-meta">
                        <span class="skill-name">{skill.skillName}</span>
                        <span class="skill-desc">{skill.skillDescription}</span>
                      </div>
                      <span class="skill-version">v{skill.skillVersion}</span>
                    </div>
                    <button
                      class="unequip-btn"
                      disabled={skillActionLoading === skill.skillId}
                      onclick={() => handleSkillUnequip(skill.skillId)}
                    >
                      {skillActionLoading === skill.skillId ? '...' : 'UNEQUIP'}
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <button class="library-toggle" onclick={() => (showSkillLibrary = !showSkillLibrary)}>
            {showSkillLibrary ? 'HIDE LIBRARY' : 'OPEN LIBRARY'}
            <span class="toggle-arrow" class:open={showSkillLibrary}></span>
          </button>

          {#if showSkillLibrary}
            <div class="library-section">
              {#if skillCategories.length > 1}
                <div class="filter-bar">
                  <button
                    class="filter-chip"
                    class:active={skillFilterCategory === ''}
                    onclick={() => (skillFilterCategory = '')}
                  >ALL</button>
                  {#each skillCategories as cat}
                    <button
                      class="filter-chip"
                      class:active={skillFilterCategory === cat}
                      onclick={() => (skillFilterCategory = cat)}
                    >{cat.toUpperCase()}</button>
                  {/each}
                </div>
              {/if}

              {#if availableSkills.length === 0}
                <p class="empty-msg">
                  {skillsAll.length === 0
                    ? 'No skills in your library. Create skills from the Skills page.'
                    : 'All matching skills are already equipped.'}
                </p>
              {:else}
                <div class="available-list">
                  {#each availableSkills as skill}
                    <div class="available-card">
                      <div class="skill-info">
                        <span
                          class="skill-cat-dot"
                          style="background: {CATEGORY_COLORS[skill.category] ?? 'var(--bo-faint)'}"
                        ></span>
                        <div class="skill-meta">
                          <span class="skill-name">{skill.name}</span>
                          <span class="skill-desc">{skill.description}</span>
                        </div>
                        <span class="skill-class-badge">{skill.minAgentClass}</span>
                      </div>
                      <button
                        class="equip-btn"
                        disabled={slotsFree <= 0 || skillActionLoading === skill.id}
                        onclick={() => handleSkillEquip(skill.id)}
                      >
                        {#if skillActionLoading === skill.id}
                          ...
                        {:else if slotsFree <= 0}
                          FULL
                        {:else}
                          EQUIP
                        {/if}
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    {:else if activeTab === 'activity'}
      <div class="activity-section">
        {#if data.activity.length === 0}
          <p class="empty-state">No activity recorded for this agent yet.</p>
        {:else}
          <div class="activity-list">
            {#each data.activity as event}
              <div class="activity-row">
                <div
                  class="activity-icon"
                  class:execution={event.type === 'execution'}
                  class:skill={event.type === 'skill'}
                  class:karma={event.type === 'karma'}
                >
                  {#if event.type === 'execution'}
                    <span class="icon-run">▶</span>
                  {:else if event.type === 'skill'}
                    <span class="icon-skill">⚡</span>
                  {:else}
                    <span class="icon-karma">◆</span>
                  {/if}
                </div>
                <div class="activity-info">
                  <span class="activity-desc">{event.description ?? event.type}</span>
                  <span class="activity-time">{formatDateTime(event.createdAt)}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else if activeTab === 'performance'}
      <div class="performance-section">
        <div class="perf-grid">
          <div class="perf-card">
            <h3 class="perf-card-title">TOTAL SPEND</h3>
            <p class="perf-card-value">{formatCents(totalAgentSpend)}</p>
          </div>
          <div class="perf-card">
            <h3 class="perf-card-title">COST ENTRIES</h3>
            <p class="perf-card-value">{agentCostData.length}</p>
          </div>
        </div>

        {#if agentCostData.length > 0}
          <div class="cost-history">
            <h3 class="perf-section-title">COST HISTORY</h3>
            <div class="cost-table">
              <div class="cost-header">
                <span>Date</span>
                <span>Amount</span>
              </div>
              {#each agentCostData as entry}
                <div class="cost-row">
                  <span class="cost-date">{formatDate(entry.date ?? '')}</span>
                  <span class="cost-amount">{formatCents(entry.cents ?? entry.totalCents ?? 0)}</span>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <p class="empty-state">No cost data available for this agent.</p>
        {/if}
      </div>
    {:else if activeTab === 'danger'}
      <div class="danger-section">
        <h2 class="danger-title">Delete agent</h2>
        <p class="danger-desc">
          This will permanently delete <strong>{data.agent.name}</strong> and remove it from all
          assignments. This action cannot be undone.
        </p>
        <div class="danger-confirm">
          <label for="delete-confirm" class="field-label">
            Type <strong>{data.agent.name}</strong> to confirm deletion
          </label>
          <input
            id="delete-confirm"
            type="text"
            bind:value={deleteConfirmName}
            class="field-input"
            placeholder={data.agent.name}
          />
        </div>
        {#if deleteError}
          <p class="field-error" role="alert">{deleteError}</p>
        {/if}
        <button
          class="btn-danger"
          onclick={handleDelete}
          disabled={deleteConfirmName !== data.agent.name || deleteLoading}
        >
          {deleteLoading ? 'Deleting...' : 'Delete agent'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .agent-detail {
    max-width: 800px;
  }

  .back-row {
    margin-bottom: var(--space-xl);
  }

  .back-link {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.15s;
  }

  .back-link:hover {
    color: var(--fo-plum);
  }

  .agent-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-lg);
    margin-bottom: var(--space-xl);
    flex-wrap: wrap;
  }

  .agent-name {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--fo-plum);
    line-height: 1.2;
    margin: 0;
  }

  .agent-badges {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-body);
    font-size: 13px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tier-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.1em;
  }

  .tab-nav {
    display: flex;
    align-items: center;
    gap: 0;
    border-bottom: 1px solid var(--fo-border);
    margin-bottom: var(--space-lg);
  }

  .tab-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--space-sm) var(--space-lg);
    cursor: pointer;
    margin-bottom: -1px;
    transition:
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .tab-btn:hover {
    color: var(--fo-plum);
  }

  .tab-btn.active {
    color: var(--fo-plum);
    border-bottom-color: var(--fo-plum);
  }

  .tab-content {
    min-height: 200px;
  }

  .edit-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    max-width: 560px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .field-label {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
  }

  .field-input {
    font-family: var(--font-body);
    font-size: 16px;
    padding: 10px 14px;
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    color: inherit;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
  }

  .field-input:focus {
    border-color: var(--fo-plum-m);
    outline: 2px solid var(--fo-plum-p);
    outline-offset: 1px;
  }

  .field-textarea {
    resize: vertical;
    line-height: 1.65;
  }

  .field-select {
    cursor: pointer;
  }

  .field-error {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--error);
    margin: 0;
  }

  .field-success {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-teal);
    margin: 0;
  }

  .form-actions {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-top: var(--space-sm);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 10px 18px;
    background: var(--fo-plum);
    color: #fff;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s;
    text-decoration: none;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--fo-plum-m);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    padding: 10px 18px;
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s;
    text-decoration: none;
  }

  .btn-secondary:hover {
    background: var(--fo-bg2);
  }

  .agent-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    border-top: 1px solid var(--fo-border);
    padding-top: var(--space-xl);
    margin-top: var(--space-xl);
  }

  .meta-row {
    display: flex;
    gap: var(--space-xl);
  }

  .meta-label {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    width: 120px;
    flex-shrink: 0;
  }

  .meta-value {
    font-family: var(--font-body);
    font-size: 13px;
  }

  .empty-state {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    padding: var(--space-xl);
    text-align: center;
  }

  .skill-loadout {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .loadout-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .loadout-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--fo-plum);
    margin: 0;
  }

  .slot-meter {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .slot-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .slot-bar {
    display: flex;
    gap: 3px;
  }

  .slot-pip {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    border: 1px solid var(--fo-border);
    background: transparent;
    transition: background 0.2s ease;
  }

  .slot-pip.filled {
    background: var(--fo-plum);
    border-color: var(--fo-plum);
  }

  .slot-count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
  }

  .loading-state {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xl);
    justify-content: center;
  }

  .loading-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--fo-plum);
    animation: pulse 1s ease infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.3;
    }
    50% {
      opacity: 1;
    }
  }

  .loading-text {
    font-size: 12px;
    color: var(--text-muted);
  }

  .error-state {
    text-align: center;
    padding: var(--space-lg);
  }

  .error-text {
    font-size: 12px;
    color: var(--error);
    margin: 0 0 var(--space-sm);
  }

  .retry-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.1em;
    color: var(--fo-plum);
    background: none;
    border: 1px solid var(--fo-plum);
    padding: 4px 12px;
    border-radius: 3px;
    cursor: pointer;
  }

  .retry-btn:hover {
    background: rgba(124, 58, 237, 0.1);
  }

  .equipped-section {
    min-height: 40px;
  }

  .equipped-list,
  .available-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .equipped-card,
  .available-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    transition: border-color 0.15s ease;
  }

  .equipped-card:hover,
  .available-card:hover {
    border-color: var(--fo-plum);
  }

  .skill-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex: 1;
    min-width: 0;
  }

  .skill-cat-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .skill-meta {
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
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .skill-desc {
    font-size: 11px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .skill-version {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .skill-class-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    border: 1px solid var(--fo-border);
    padding: 1px 4px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .unequip-btn,
  .equip-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.1em;
    padding: 4px 10px;
    border-radius: 3px;
    cursor: pointer;
    flex-shrink: 0;
    border: 1px solid;
    transition: all 0.15s ease;
  }

  .unequip-btn {
    color: var(--error);
    background: transparent;
    border-color: rgba(239, 68, 68, 0.25);
  }

  .unequip-btn:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.1);
    border-color: var(--error);
  }

  .equip-btn {
    color: var(--bo-teal);
    background: transparent;
    border-color: rgba(45, 212, 191, 0.25);
  }

  .equip-btn:hover:not(:disabled) {
    background: rgba(45, 212, 191, 0.1);
    border-color: var(--bo-teal);
  }

  .equip-btn:disabled,
  .unequip-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .library-toggle {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.1em;
    color: var(--fo-plum);
    background: none;
    border: 1px solid var(--fo-border);
    padding: 6px 14px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    align-self: flex-start;
    transition: all 0.15s ease;
  }

  .library-toggle:hover {
    border-color: var(--fo-plum);
    background: rgba(124, 58, 237, 0.06);
  }

  .toggle-arrow {
    display: inline-block;
    width: 0;
    height: 0;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-top: 4px solid currentColor;
    transition: transform 0.2s ease;
  }

  .toggle-arrow.open {
    transform: rotate(180deg);
  }

  .library-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-md);
    background: rgba(124, 58, 237, 0.03);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
  }

  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .filter-chip {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--fo-border);
    padding: 3px 8px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-chip:hover {
    color: var(--text);
    border-color: var(--fo-plum);
  }

  .filter-chip.active {
    color: var(--text);
    background: rgba(124, 58, 237, 0.15);
    border-color: var(--fo-plum);
  }

  .empty-msg {
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
    padding: var(--space-lg);
    margin: 0;
  }

  .activity-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .activity-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
  }

  .activity-icon {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 12px;
  }

  .activity-icon.execution {
    background: rgba(45, 212, 191, 0.1);
    color: var(--bo-teal);
  }

  .activity-icon.skill {
    background: rgba(124, 58, 237, 0.1);
    color: var(--bo-violet);
  }

  .activity-icon.karma {
    background: rgba(251, 191, 36, 0.1);
    color: var(--bo-amber);
  }

  .activity-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .activity-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .activity-time {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }

  .perf-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
  }

  .perf-card {
    padding: var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
  }

  .perf-card-title {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin: 0 0 var(--space-sm);
  }

  .perf-card-value {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 600;
    color: var(--fo-plum);
    margin: 0;
  }

  .cost-history {
    margin-top: var(--space-lg);
  }

  .perf-section-title {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin: 0 0 var(--space-md);
  }

  .cost-table {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cost-header {
    display: flex;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    background: var(--fo-bg2);
    border-radius: var(--radius-sm);
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }

  .cost-row {
    display: flex;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--fo-border);
  }

  .cost-date {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
  }

  .cost-amount {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text);
  }

  .danger-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    max-width: 560px;
  }

  .danger-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--error);
    margin: 0;
  }

  .danger-desc {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.6;
    color: var(--text);
    margin: 0;
  }

  .danger-confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .btn-danger {
    display: inline-flex;
    align-items: center;
    padding: 10px 18px;
    background: var(--error);
    color: #fff;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: opacity 0.15s;
    align-self: flex-start;
  }

  .btn-danger:hover:not(:disabled) {
    opacity: 0.85;
  }

  .btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>