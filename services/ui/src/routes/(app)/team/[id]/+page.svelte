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

  type TabId = 'profile' | 'skills' | 'tools' | 'history' | 'evolution';
  let activeTab = $state<TabId>('profile');

  let editName = $state(data.agent.name);
  let editDescription = $state(data.agent.description ?? '');
  let editAdapter = $state(data.agent.adapter ?? 'claude');
  let editSaving = $state(false);
  let editError = $state('');
  let editSuccess = $state(false);

  let showDeleteConfirm = $state(false);
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

  const CLASS_CAPACITY: Record<string, number> = { Novice: 3, Understudy: 5, Artisan: 8, Retired: 0 };
  const agentClass = $derived(data.agent?.agentClass ?? 'Novice');
  const CAPACITY = $derived(CLASS_CAPACITY[agentClass] ?? 3);

  const CLASS_COLORS: Record<string, string> = { Novice: '#3B82F6', Understudy: '#8B5CF6', Artisan: '#F59E0B', Retired: 'var(--text-muted)' };
  const CLASS_PROGRESSION = ['Novice', 'Understudy', 'Artisan'];

  const CATEGORY_COLORS: Record<string, string> = {
    communication: 'var(--accent-teal)', analysis: 'var(--accent)', creation: 'var(--karma)',
    automation: 'var(--accent-rose)', research: 'var(--accent-m)', coordination: 'var(--accent-teal)',
    monitoring: 'var(--karma)', other: 'var(--muted)',
  };

  const TABS: { id: TabId; label: string }[] = [
    { id: 'profile', label: 'PROFILE' },
    { id: 'skills', label: 'SKILLS' },
    { id: 'tools', label: 'TOOLS' },
    { id: 'history', label: 'HISTORY' },
    { id: 'evolution', label: 'EVOLUTION' },
  ];

  const slotsUsed = $derived(skillsEquipped.length);
  const slotsFree = $derived(CAPACITY - slotsUsed);
  const equippedIds = $derived(new Set(skillsEquipped.map((s) => s.skillId)));

  const availableSkills = $derived.by(() => {
    let filtered = skillsAll.filter((s) => !equippedIds.has(s.id));
    if (skillFilterCategory) filtered = filtered.filter((s) => s.category === skillFilterCategory);
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
  const totalAgentSpend = $derived(agentCostData.reduce((sum, p) => sum + (p.cents ?? p.totalCents ?? 0), 0));

  const toolConnections = $derived(
    (data.toolConnections ?? []) as Array<{ id: string; toolName: string; provider: string; status: string; createdAt: string }>
  );

  async function loadSkills() {
    skillsLoading = true;
    skillsError = null;
    try {
      const [equippedRes, allSkillsRes] = await Promise.allSettled([getAgentSkills(data.agent.id), getSkills(data.userId)]);
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
    try { await equipSkill(data.agent.id, skillId, data.userId); await loadSkills(); }
    catch (err) { skillsError = (err as Error).message; }
    finally { skillActionLoading = null; }
  }

  async function handleSkillUnequip(skillId: string) {
    skillActionLoading = skillId;
    try { await unequipSkill(data.agent.id, skillId); await loadSkills(); }
    catch (err) { skillsError = (err as Error).message; }
    finally { skillActionLoading = null; }
  }

  function formatCents(cents: number): string { return `$${(cents / 100).toFixed(2)}`; }
  function formatDate(dateStr: string): string { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function formatDateTime(dateStr: string): string { return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }

  function getStatusLabel(status: string | null | undefined): string {
    switch (status) { case 'working': return 'Working'; case 'complete': case 'done': return 'Done'; default: return 'Idle'; }
  }
  function getStatusColor(status: string | null | undefined): string { return status === 'working' ? '#22c55e' : '#9ca3af'; }
  function getClassColor(cls: string | null | undefined): string { return CLASS_COLORS[cls ?? 'Novice'] ?? '#3B82F6'; }

  async function handleSaveEdit() {
    editSaving = true; editError = ''; editSuccess = false;
    try {
      await updateAgent(data.agent.id, { name: editName.trim(), description: editDescription.trim() || undefined, adapter: editAdapter });
      editSuccess = true;
      data.agent.name = editName.trim();
      data.agent.description = editDescription.trim() || null;
      data.agent.adapter = editAdapter;
    } catch (err) { editError = (err as Error).message ?? 'Failed to save changes'; }
    finally { editSaving = false; }
  }

  async function handleDelete() {
    if (deleteConfirmName !== data.agent.name) { deleteError = 'Agent name does not match'; return; }
    deleteLoading = true; deleteError = '';
    try { await deleteAgent(data.agent.id); goto('/team'); }
    catch (err) { deleteError = (err as Error).message ?? 'Failed to delete agent'; deleteLoading = false; }
  }

  function resetEditForm() {
    editName = data.agent.name; editDescription = data.agent.description ?? '';
    editAdapter = data.agent.adapter ?? 'claude'; editError = ''; editSuccess = false;
  }

  $effect(() => { if (activeTab === 'skills') loadSkills(); });
</script>

<div class="agent-detail">
  <div class="back-row"><a href="/team" class="back-link">&larr; Team</a></div>

  <div class="agent-header">
    <div class="header-identity">
      <div class="avatar" style="background: {getClassColor(agentClass)}15; border-color: {getClassColor(agentClass)}40">
        <span class="avatar-letter" style="color: {getClassColor(agentClass)}">{data.agent.name.charAt(0).toUpperCase()}</span>
      </div>
      <div class="header-text">
        <h1 class="agent-name">{data.agent.name}</h1>
        {#if data.agent.description}<p class="agent-desc">{data.agent.description}</p>{/if}
      </div>
    </div>
    <div class="agent-badges">
      <span class="status-badge">
        <span class="status-dot" style="background: {getStatusColor(data.agent.status)}"></span>
        {getStatusLabel(data.agent.status)}
      </span>
      <span class="class-badge" style="color: {getClassColor(agentClass)}; border-color: {getClassColor(agentClass)}40; background: {getClassColor(agentClass)}10">
        {agentClass.toUpperCase()}
      </span>
      {#if data.agent.compositeScore}
        <span class="score-badge">{parseFloat(data.agent.compositeScore).toFixed(1)}</span>
      {/if}
    </div>
  </div>

  <nav class="tab-nav" aria-label="Agent detail tabs">
    {#each TABS as tab}
      <button class="tab-btn" class:active={activeTab === tab.id} onclick={() => (activeTab = tab.id)} aria-selected={activeTab === tab.id}>{tab.label}</button>
    {/each}
  </nav>

  <div class="tab-content">
    {#if activeTab === 'profile'}
      <form class="edit-form" onsubmit={(e) => { e.preventDefault(); handleSaveEdit(); }}>
        <div class="field">
          <label for="name" class="field-label">Name</label>
          <input id="name" type="text" bind:value={editName} class="field-input" required />
        </div>
        <div class="field">
          <label for="description" class="field-label">Description</label>
          <textarea id="description" bind:value={editDescription} class="field-input field-textarea" rows="3"></textarea>
        </div>
        <div class="field">
          <label for="adapter" class="field-label">Model / Adapter</label>
          <select id="adapter" bind:value={editAdapter} class="field-input field-select">
            {#each ADAPTERS as opt}<option value={opt.value}>{opt.label}</option>{/each}
          </select>
        </div>
        {#if editError}<p class="field-error" role="alert">{editError}</p>{/if}
        {#if editSuccess}<p class="field-success" role="status">Changes saved successfully</p>{/if}
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick={resetEditForm}>Reset</button>
          <button type="submit" class="btn-primary" disabled={editSaving}>{editSaving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </form>

      <div class="agent-meta">
        <div class="meta-row"><span class="meta-label">Class</span><span class="meta-value" style="color: {getClassColor(agentClass)}">{agentClass}</span></div>
        <div class="meta-row"><span class="meta-label">Adapter</span><span class="meta-value">{data.agent.adapter ?? '---'}</span></div>
        <div class="meta-row"><span class="meta-label">Created</span><span class="meta-value">{formatDate(data.agent.createdAt)}</span></div>
        <div class="meta-row"><span class="meta-label">Last updated</span><span class="meta-value">{formatDate(data.agent.updatedAt)}</span></div>
      </div>

      <div class="delete-section">
        {#if !showDeleteConfirm}
          <button class="btn-danger-outline" onclick={() => (showDeleteConfirm = true)}>Delete agent</button>
        {:else}
          <div class="danger-box">
            <h3 class="danger-title">Delete agent</h3>
            <p class="danger-desc">This will permanently delete <strong>{data.agent.name}</strong> and remove it from all assignments. This action cannot be undone.</p>
            <div class="danger-confirm">
              <label for="delete-confirm" class="field-label">Type <strong>{data.agent.name}</strong> to confirm</label>
              <input id="delete-confirm" type="text" bind:value={deleteConfirmName} class="field-input" placeholder={data.agent.name} />
            </div>
            {#if deleteError}<p class="field-error" role="alert">{deleteError}</p>{/if}
            <div class="form-actions">
              <button class="btn-secondary" onclick={() => { showDeleteConfirm = false; deleteConfirmName = ''; deleteError = ''; }}>Cancel</button>
              <button class="btn-danger" onclick={handleDelete} disabled={deleteConfirmName !== data.agent.name || deleteLoading}>
                {deleteLoading ? 'Deleting...' : 'Delete agent'}
              </button>
            </div>
          </div>
        {/if}
      </div>

    {:else if activeTab === 'skills'}
      <div class="skill-loadout">
        <div class="loadout-header">
          <h3 class="loadout-title">Skill Loadout</h3>
          <div class="slot-meter">
            <span class="slot-label">SLOTS</span>
            <div class="slot-bar">
              {#each Array(CAPACITY) as _, i}<div class="slot-pip" class:filled={i < slotsUsed}></div>{/each}
            </div>
            <span class="slot-count">{slotsUsed}/{CAPACITY}</span>
          </div>
        </div>
        <p class="capacity-note">{agentClass} agents can equip up to {CAPACITY} skills.</p>

        {#if skillsLoading}
          <div class="loading-state"><span class="loading-dot"></span><span class="loading-text">Loading skills...</span></div>
        {:else if skillsError}
          <div class="error-state"><p class="error-text">{skillsError}</p><button class="retry-btn" onclick={loadSkills}>Retry</button></div>
        {:else}
          <div class="equipped-section">
            {#if skillsEquipped.length === 0}
              <p class="empty-msg">No skills equipped. Open the library to equip skills.</p>
            {:else}
              <div class="equipped-list">
                {#each skillsEquipped as skill}
                  <div class="equipped-card">
                    <div class="skill-info">
                      <span class="skill-cat-dot" style="background: {CATEGORY_COLORS[skill.skillCategory] ?? 'var(--muted)'}"></span>
                      <div class="skill-meta"><span class="skill-name">{skill.skillName}</span><span class="skill-desc">{skill.skillDescription}</span></div>
                      <span class="skill-version">v{skill.skillVersion}</span>
                    </div>
                    <button class="unequip-btn" disabled={skillActionLoading === skill.skillId} onclick={() => handleSkillUnequip(skill.skillId)}>
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
                  <button class="filter-chip" class:active={skillFilterCategory === ''} onclick={() => (skillFilterCategory = '')}>ALL</button>
                  {#each skillCategories as cat}
                    <button class="filter-chip" class:active={skillFilterCategory === cat} onclick={() => (skillFilterCategory = cat)}>{cat.toUpperCase()}</button>
                  {/each}
                </div>
              {/if}
              {#if availableSkills.length === 0}
                <p class="empty-msg">{skillsAll.length === 0 ? 'No skills in your library. Create skills from the Skills page.' : 'All matching skills are already equipped.'}</p>
              {:else}
                <div class="available-list">
                  {#each availableSkills as skill}
                    <div class="available-card">
                      <div class="skill-info">
                        <span class="skill-cat-dot" style="background: {CATEGORY_COLORS[skill.category] ?? 'var(--muted)'}"></span>
                        <div class="skill-meta"><span class="skill-name">{skill.name}</span><span class="skill-desc">{skill.description}</span></div>
                        <span class="skill-class-badge">{skill.minAgentClass}</span>
                      </div>
                      <button class="equip-btn" disabled={slotsFree <= 0 || skillActionLoading === skill.id} onclick={() => handleSkillEquip(skill.id)}>
                        {#if skillActionLoading === skill.id}...{:else if slotsFree <= 0}FULL{:else}EQUIP{/if}
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>

    {:else if activeTab === 'tools'}
      <div class="tools-section">
        <h3 class="section-title">Tool Connections</h3>
        {#if toolConnections.length === 0}
          <div class="empty-tools">
            <p class="empty-msg">No tool connections available.</p>
            <a href="/tools/import" class="btn-secondary">Import tools</a>
          </div>
        {:else}
          <div class="tool-list">
            {#each toolConnections as tool}
              <div class="tool-card">
                <div class="tool-info">
                  <span class="tool-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6.5 1.5L8 3l1.5-1.5M3 6.5L1.5 8 3 9.5M13 6.5L14.5 8 13 9.5M6.5 14.5L8 13l1.5 1.5M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                  </span>
                  <div class="tool-meta"><span class="tool-name">{tool.toolName}</span><span class="tool-provider">{tool.provider}</span></div>
                </div>
                <span class="tool-status" class:connected={tool.status === 'connected'}>{tool.status === 'connected' ? 'Connected' : tool.status}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    {:else if activeTab === 'history'}
      <div class="history-section">
        <div class="perf-grid">
          <div class="perf-card"><h3 class="perf-card-title">TOTAL SPEND</h3><p class="perf-card-value">{formatCents(totalAgentSpend)}</p></div>
          <div class="perf-card"><h3 class="perf-card-title">EXECUTIONS</h3><p class="perf-card-value">{data.activity.length}</p></div>
        </div>
        {#if data.activity.length === 0}
          <p class="empty-state-text">No execution history for this agent yet.</p>
        {:else}
          <div class="activity-list">
            {#each data.activity as event}
              <div class="activity-row">
                <div class="activity-icon" class:execution={event.type === 'execution'} class:skill={event.type === 'skill'} class:karma={event.type === 'karma'}>
                  {#if event.type === 'execution'}<span>&#9654;</span>{:else if event.type === 'skill'}<span>&#9889;</span>{:else}<span>&#9670;</span>{/if}
                </div>
                <div class="activity-info">
                  <span class="activity-desc">{event.description ?? event.type}</span>
                  <span class="activity-time">{formatDateTime(event.createdAt)}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
        {#if agentCostData.length > 0}
          <div class="cost-history">
            <h3 class="perf-section-title">COST HISTORY</h3>
            <div class="cost-table">
              <div class="cost-header"><span>Date</span><span>Amount</span></div>
              {#each agentCostData as entry}
                <div class="cost-row">
                  <span class="cost-date">{formatDate(entry.date ?? '')}</span>
                  <span class="cost-amount">{formatCents(entry.cents ?? entry.totalCents ?? 0)}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

    {:else if activeTab === 'evolution'}
      <div class="evolution-section">
        <div class="class-progression">
          <h3 class="section-title">Class Progression</h3>
          <div class="progression-track">
            {#each CLASS_PROGRESSION as cls, i}
              {@const isCurrent = cls === agentClass}
              {@const isPast = CLASS_PROGRESSION.indexOf(agentClass) > i}
              <div class="progression-step" class:current={isCurrent} class:past={isPast}>
                <div class="step-dot" style="background: {isCurrent || isPast ? getClassColor(cls) : 'var(--border, var(--fo-border))'}; border-color: {getClassColor(cls)}40"></div>
                <span class="step-label" style="color: {isCurrent ? getClassColor(cls) : 'var(--text-muted)'}">{cls}</span>
                <span class="step-capacity">{CLASS_CAPACITY[cls]} skills</span>
              </div>
              {#if i < CLASS_PROGRESSION.length - 1}
                <div class="step-connector" class:filled={isPast}></div>
              {/if}
            {/each}
          </div>
        </div>

        {#if data.agent.compositeScore}
          <div class="score-section">
            <h3 class="section-title">Composite Fitness Score</h3>
            <div class="score-display">
              <span class="score-value">{parseFloat(data.agent.compositeScore).toFixed(2)}</span>
              <span class="score-max">/ 10.0</span>
            </div>
          </div>
        {/if}

        <div class="lineage-section">
          <h3 class="section-title">Soul Lineage</h3>
          <p class="empty-msg">Soul lineage data is populated after evolution runs.</p>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .agent-detail { max-width: 800px; }
  .back-row { margin-bottom: var(--space-xl); }
  .back-link { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); text-decoration: none; transition: color 0.15s; }
  .back-link:hover { color: var(--accent, var(--fo-plum)); }

  .agent-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-lg); margin-bottom: var(--space-xl); flex-wrap: wrap; }
  .header-identity { display: flex; align-items: center; gap: var(--space-md); }
  .avatar { width: 48px; height: 48px; border-radius: var(--radius-xl); border: 1.5px solid; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .avatar-letter { font-family: var(--font-display); font-size: 22px; font-weight: 600; line-height: 1; }
  .header-text { display: flex; flex-direction: column; gap: 2px; }
  .agent-name { font-family: var(--font-display); font-size: clamp(20px, 3vw, 28px); font-weight: 600; color: var(--text); line-height: 1.2; margin: 0; }
  .agent-desc { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); margin: 0; }
  .agent-badges { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }
  .status-badge { display: flex; align-items: center; gap: 5px; font-family: var(--font-body); font-size: 12px; color: var(--text-muted); }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .class-badge { font-family: var(--font-label); font-size: 6px; letter-spacing: 0.1em; padding: 2px 8px; border: 1px solid; border-radius: 3px; }
  .score-badge { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); }

  .tab-nav { display: flex; align-items: center; gap: 0; border-bottom: 1px solid var(--border, var(--fo-border)); margin-bottom: var(--space-lg); overflow-x: auto; }
  .tab-btn { font-family: var(--font-label); font-size: 7px; letter-spacing: 0.1em; color: var(--text-muted); background: none; border: none; border-bottom: 2px solid transparent; padding: var(--space-sm) var(--space-lg); cursor: pointer; margin-bottom: -1px; white-space: nowrap; transition: color 0.15s ease, border-color 0.15s ease; }
  .tab-btn:hover { color: var(--accent, var(--fo-plum)); }
  .tab-btn.active { color: var(--accent, var(--fo-plum)); border-bottom-color: var(--accent, var(--fo-plum)); }
  .tab-content { min-height: 200px; }

  .edit-form { display: flex; flex-direction: column; gap: var(--space-lg); max-width: 560px; }
  .field { display: flex; flex-direction: column; gap: var(--space-sm); }
  .field-label { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); }
  .field-input { font-family: var(--font-body); font-size: 16px; padding: 10px 14px; background: var(--card, var(--fo-card)); border: 1px solid var(--border, var(--fo-border)); border-radius: var(--radius-md); color: inherit; outline: none; transition: border-color 0.15s; width: 100%; box-sizing: border-box; }
  .field-input:focus { border-color: var(--accent, var(--fo-plum-m)); outline: 2px solid var(--accent-dim, var(--fo-plum-p)); outline-offset: 1px; }
  .field-textarea { resize: vertical; line-height: 1.65; }
  .field-select { cursor: pointer; }
  .field-error { font-family: var(--font-body); font-size: 13px; color: var(--error); margin: 0; }
  .field-success { font-family: var(--font-body); font-size: 13px; color: var(--accent-teal); margin: 0; }
  .form-actions { display: flex; align-items: center; gap: var(--space-md); margin-top: var(--space-sm); }

  .btn-primary { display: inline-flex; align-items: center; padding: 10px 18px; background: var(--accent, var(--fo-plum)); color: white; font-family: var(--font-body); font-size: 13px; font-weight: 600; border: none; border-radius: var(--radius-md); cursor: pointer; transition: background 0.15s; text-decoration: none; }
  .btn-primary:hover:not(:disabled) { background: var(--accent-m, var(--fo-plum-m)); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-secondary { display: inline-flex; align-items: center; padding: 10px 18px; background: transparent; color: var(--text-muted); font-family: var(--font-body); font-size: 13px; font-weight: 600; border: 1px solid var(--border, var(--fo-border)); border-radius: var(--radius-md); cursor: pointer; transition: background 0.15s; text-decoration: none; }
  .btn-secondary:hover { background: var(--bg2, var(--fo-bg2)); }

  .agent-meta { display: flex; flex-direction: column; gap: var(--space-sm); border-top: 1px solid var(--border, var(--fo-border)); padding-top: var(--space-xl); margin-top: var(--space-xl); }
  .meta-row { display: flex; gap: var(--space-xl); }
  .meta-label { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); width: 120px; flex-shrink: 0; }
  .meta-value { font-family: var(--font-body); font-size: 13px; }

  .delete-section { margin-top: var(--space-2xl); padding-top: var(--space-xl); border-top: 1px solid var(--border, var(--fo-border)); }
  .btn-danger-outline { display: inline-flex; align-items: center; padding: 8px 16px; background: transparent; color: var(--error); font-family: var(--font-body); font-size: 13px; font-weight: 500; border: 1px solid rgba(248, 113, 113, 0.3); border-radius: var(--radius-md); cursor: pointer; transition: all 0.15s; }
  .btn-danger-outline:hover { background: var(--error-dim); border-color: var(--error); }
  .danger-box { display: flex; flex-direction: column; gap: var(--space-lg); max-width: 560px; padding: var(--space-lg); border: 1px solid rgba(248, 113, 113, 0.2); border-radius: var(--radius-md); background: var(--error-dim); }
  .danger-title { font-family: var(--font-display); font-size: 18px; font-weight: 600; color: var(--error); margin: 0; }
  .danger-desc { font-family: var(--font-body); font-size: 14px; line-height: 1.6; color: var(--text); margin: 0; }
  .danger-confirm { display: flex; flex-direction: column; gap: var(--space-sm); }
  .btn-danger { display: inline-flex; align-items: center; padding: 10px 18px; background: var(--error); color: white; font-family: var(--font-body); font-size: 13px; font-weight: 600; border: none; border-radius: var(--radius-md); cursor: pointer; transition: opacity 0.15s; }
  .btn-danger:hover:not(:disabled) { opacity: 0.85; }
  .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

  .skill-loadout { display: flex; flex-direction: column; gap: var(--space-md); }
  .loadout-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); }
  .loadout-title { font-family: var(--font-display); font-size: 16px; font-weight: 600; color: var(--text); margin: 0; }
  .slot-meter { display: flex; align-items: center; gap: var(--space-sm); }
  .slot-label { font-family: var(--font-label); font-size: 6px; letter-spacing: 0.1em; color: var(--text-muted); }
  .slot-bar { display: flex; gap: 3px; }
  .slot-pip { width: 8px; height: 8px; border-radius: 2px; border: 1px solid var(--border, var(--fo-border)); background: transparent; transition: background 0.2s ease; }
  .slot-pip.filled { background: var(--accent, var(--fo-plum)); border-color: var(--accent, var(--fo-plum)); }
  .slot-count { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); }
  .capacity-note { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); margin: 0; }

  .loading-state { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-xl); justify-content: center; }
  .loading-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent, var(--fo-plum)); animation: pulse 1s ease infinite; }
  @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
  .loading-text { font-size: 12px; color: var(--text-muted); }
  .error-state { text-align: center; padding: var(--space-lg); }
  .error-text { font-size: 12px; color: var(--error); margin: 0 0 var(--space-sm); }
  .retry-btn { font-family: var(--font-label); font-size: 7px; letter-spacing: 0.1em; color: var(--accent, var(--fo-plum)); background: none; border: 1px solid var(--accent, var(--fo-plum)); padding: 4px 12px; border-radius: 3px; cursor: pointer; }
  .retry-btn:hover { background: rgba(124, 58, 237, 0.1); }

  .equipped-section { min-height: 40px; }
  .equipped-list, .available-list { display: flex; flex-direction: column; gap: var(--space-sm); }
  .equipped-card, .available-card { display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); padding: var(--space-sm) var(--space-md); background: var(--card, var(--fo-card)); border: 1px solid var(--border, var(--fo-border)); border-radius: var(--radius-md); transition: border-color 0.15s ease; }
  .equipped-card:hover, .available-card:hover { border-color: var(--accent, var(--fo-plum)); }
  .skill-info { display: flex; align-items: center; gap: var(--space-sm); flex: 1; min-width: 0; }
  .skill-cat-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .skill-meta { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .skill-name { font-family: var(--font-body); font-size: 13px; font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .skill-desc { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .skill-version { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); flex-shrink: 0; }
  .skill-class-badge { font-family: var(--font-label); font-size: 6px; letter-spacing: 0.1em; color: var(--text-muted); border: 1px solid var(--border, var(--fo-border)); padding: 1px 4px; border-radius: 2px; flex-shrink: 0; }

  .unequip-btn, .equip-btn { font-family: var(--font-label); font-size: 7px; letter-spacing: 0.1em; padding: 4px 10px; border-radius: 3px; cursor: pointer; flex-shrink: 0; border: 1px solid; transition: all 0.15s ease; }
  .unequip-btn { color: var(--error); background: transparent; border-color: rgba(239, 68, 68, 0.25); }
  .unequip-btn:hover:not(:disabled) { background: rgba(239, 68, 68, 0.1); border-color: var(--error); }
  .equip-btn { color: var(--accent-teal); background: transparent; border-color: rgba(45, 212, 191, 0.25); }
  .equip-btn:hover:not(:disabled) { background: rgba(45, 212, 191, 0.1); border-color: var(--accent-teal); }
  .equip-btn:disabled, .unequip-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .library-toggle { font-family: var(--font-label); font-size: 7px; letter-spacing: 0.1em; color: var(--accent, var(--fo-plum)); background: none; border: 1px solid var(--border, var(--fo-border)); padding: 6px 14px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: var(--space-sm); align-self: flex-start; transition: all 0.15s ease; }
  .library-toggle:hover { border-color: var(--accent, var(--fo-plum)); background: rgba(124, 58, 237, 0.06); }
  .toggle-arrow { display: inline-block; width: 0; height: 0; border-left: 3px solid transparent; border-right: 3px solid transparent; border-top: 4px solid currentColor; transition: transform 0.2s ease; }
  .toggle-arrow.open { transform: rotate(180deg); }
  .library-section { display: flex; flex-direction: column; gap: var(--space-md); padding: var(--space-md); background: rgba(124, 58, 237, 0.03); border: 1px solid var(--border, var(--fo-border)); border-radius: var(--radius-md); }
  .filter-bar { display: flex; flex-wrap: wrap; gap: 4px; }
  .filter-chip { font-family: var(--font-label); font-size: 6px; letter-spacing: 0.1em; color: var(--text-muted); background: transparent; border: 1px solid var(--border, var(--fo-border)); padding: 3px 8px; border-radius: 3px; cursor: pointer; transition: all 0.15s ease; }
  .filter-chip:hover { color: var(--text); border-color: var(--accent, var(--fo-plum)); }
  .filter-chip.active { color: var(--text); background: rgba(124, 58, 237, 0.15); border-color: var(--accent, var(--fo-plum)); }
  .empty-msg { font-size: 12px; color: var(--text-muted); text-align: center; padding: var(--space-lg); margin: 0; }

  .tools-section { display: flex; flex-direction: column; gap: var(--space-md); }
  .section-title { font-family: var(--font-display); font-size: 16px; font-weight: 600; color: var(--text); margin: 0; }
  .empty-tools { display: flex; flex-direction: column; align-items: center; gap: var(--space-md); padding: var(--space-2xl) 0; }
  .tool-list { display: flex; flex-direction: column; gap: var(--space-sm); }
  .tool-card { display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); padding: var(--space-sm) var(--space-md); background: var(--card, var(--fo-card)); border: 1px solid var(--border, var(--fo-border)); border-radius: var(--radius-md); }
  .tool-info { display: flex; align-items: center; gap: var(--space-sm); flex: 1; min-width: 0; }
  .tool-icon { width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--bg2, var(--fo-bg2)); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--text-muted); }
  .tool-meta { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .tool-name { font-family: var(--font-body); font-size: 13px; font-weight: 500; color: var(--text); }
  .tool-provider { font-family: var(--font-body); font-size: 11px; color: var(--text-muted); }
  .tool-status { font-family: var(--font-label); font-size: 6px; letter-spacing: 0.1em; color: var(--text-muted); padding: 2px 6px; border: 1px solid var(--border, var(--fo-border)); border-radius: 3px; flex-shrink: 0; }
  .tool-status.connected { color: var(--accent-teal); border-color: rgba(45, 212, 191, 0.3); background: rgba(45, 212, 191, 0.08); }

  .history-section { display: flex; flex-direction: column; gap: var(--space-lg); }
  .empty-state-text { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); text-align: center; padding: var(--space-xl); }
  .perf-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--space-md); }
  .perf-card { padding: var(--space-md); background: var(--card, var(--fo-card)); border: 1px solid var(--border, var(--fo-border)); border-radius: var(--radius-md); }
  .perf-card-title { font-family: var(--font-label); font-size: 6px; letter-spacing: 0.1em; color: var(--text-muted); margin: 0 0 var(--space-sm); }
  .perf-card-value { font-family: var(--font-display); font-size: 24px; font-weight: 600; color: var(--accent, var(--fo-plum)); margin: 0; }
  .activity-list { display: flex; flex-direction: column; gap: var(--space-sm); }
  .activity-row { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm) var(--space-md); background: var(--card, var(--fo-card)); border: 1px solid var(--border, var(--fo-border)); border-radius: var(--radius-md); }
  .activity-icon { width: 28px; height: 28px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; }
  .activity-icon.execution { background: rgba(45, 212, 191, 0.1); color: var(--accent-teal); }
  .activity-icon.skill { background: rgba(124, 58, 237, 0.1); color: var(--accent); }
  .activity-icon.karma { background: rgba(251, 191, 36, 0.1); color: var(--karma); }
  .activity-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .activity-desc { font-family: var(--font-body); font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .activity-time { font-family: var(--font-body); font-size: 11px; color: var(--text-muted); }
  .cost-history { margin-top: var(--space-lg); }
  .perf-section-title { font-family: var(--font-label); font-size: 7px; letter-spacing: 0.1em; color: var(--text-muted); margin: 0 0 var(--space-md); }
  .cost-table { display: flex; flex-direction: column; gap: 2px; }
  .cost-header { display: flex; justify-content: space-between; padding: var(--space-sm) var(--space-md); background: var(--bg2, var(--fo-bg2)); border-radius: var(--radius-sm); font-family: var(--font-label); font-size: 6px; letter-spacing: 0.1em; color: var(--text-muted); }
  .cost-row { display: flex; justify-content: space-between; padding: var(--space-sm) var(--space-md); border-bottom: 1px solid var(--border, var(--fo-border)); }
  .cost-date { font-family: var(--font-body); font-size: 13px; color: var(--text); }
  .cost-amount { font-family: var(--font-mono); font-size: 13px; color: var(--text); }

  .evolution-section { display: flex; flex-direction: column; gap: var(--space-2xl); }
  .class-progression { display: flex; flex-direction: column; gap: var(--space-md); }
  .progression-track { display: flex; align-items: flex-start; gap: 0; }
  .progression-step { display: flex; flex-direction: column; align-items: center; gap: var(--space-xs); min-width: 80px; }
  .step-dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid; transition: all 0.2s; }
  .progression-step.current .step-dot { box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2); }
  .step-label { font-family: var(--font-label); font-size: 6px; letter-spacing: 0.1em; text-align: center; }
  .step-capacity { font-family: var(--font-body); font-size: 10px; color: var(--text-muted); text-align: center; }
  .step-connector { flex: 1; height: 2px; background: var(--border, var(--fo-border)); margin-top: 7px; min-width: 24px; }
  .step-connector.filled { background: var(--accent, var(--fo-plum)); }
  .score-section { display: flex; flex-direction: column; gap: var(--space-sm); }
  .score-display { display: flex; align-items: baseline; gap: var(--space-xs); }
  .score-value { font-family: var(--font-display); font-size: 36px; font-weight: 600; color: var(--karma, var(--fo-gold)); }
  .score-max { font-family: var(--font-body); font-size: 14px; color: var(--text-muted); }
  .lineage-section { display: flex; flex-direction: column; gap: var(--space-md); }
</style>
