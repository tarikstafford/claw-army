<script lang="ts">
  import {
    getAgentSkills,
    getSkills,
    equipSkill,
    unequipSkill,
    type EquippedSkill,
    type Skill,
  } from '$lib/api';

  interface Props {
    botId: string;
    userId: string;
    agentClass: string | null;
  }

  const CAPACITY: Record<string, number> = {
    Novice: 3,
    Understudy: 5,
    Artisan: 8,
    Retired: 0,
  };

  const CATEGORY_COLORS: Record<string, string> = {
    communication: 'var(--accent-teal)',
    analysis: 'var(--accent)',
    creation: 'var(--karma)',
    automation: 'var(--accent-rose)',
    research: 'var(--accent-m)',
    coordination: 'var(--accent-teal)',
    monitoring: 'var(--karma)',
    other: 'var(--muted)',
  };

  let { botId, userId, agentClass }: Props = $props();

  let equipped = $state<EquippedSkill[]>([]);
  let allSkills = $state<Skill[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let showLibrary = $state(false);
  let filterCategory = $state<string>('');
  let actionLoading = $state<string | null>(null);

  const capacity = $derived(CAPACITY[agentClass ?? 'Novice'] ?? 3);
  const slotsUsed = $derived(equipped.length);
  const slotsFree = $derived(capacity - slotsUsed);
  const equippedIds = $derived(new Set(equipped.map((s) => s.skillId)));

  const availableSkills = $derived.by(() => {
    let filtered = allSkills.filter((s) => !equippedIds.has(s.id));
    if (filterCategory) {
      filtered = filtered.filter((s) => s.category === filterCategory);
    }
    return filtered;
  });

  const categories = $derived.by(() => {
    const cats = new Set(allSkills.map((s) => s.category));
    return Array.from(cats).sort();
  });

  async function loadData() {
    loading = true;
    error = null;
    try {
      const [equippedRes, skillsRes] = await Promise.allSettled([
        getAgentSkills(botId),
        getSkills(userId),
      ]);
      equipped = equippedRes.status === 'fulfilled' ? equippedRes.value : [];
      allSkills = skillsRes.status === 'fulfilled' ? skillsRes.value : [];
    } catch (err) {
      error = (err as Error).message;
    } finally {
      loading = false;
    }
  }

  async function handleEquip(skillId: string) {
    if (slotsFree <= 0) return;
    actionLoading = skillId;
    try {
      await equipSkill(botId, skillId, userId);
      await loadData();
    } catch (err) {
      error = (err as Error).message;
    } finally {
      actionLoading = null;
    }
  }

  async function handleUnequip(skillId: string) {
    actionLoading = skillId;
    try {
      await unequipSkill(botId, skillId);
      await loadData();
    } catch (err) {
      error = (err as Error).message;
    } finally {
      actionLoading = null;
    }
  }

  $effect(() => {
    loadData();
  });
</script>

<div class="skill-loadout">
  <div class="loadout-header">
    <h3 class="loadout-title">Skill Loadout</h3>
    <div class="slot-meter">
      <span class="slot-label">SLOTS</span>
      <div class="slot-bar">
        {#each Array(capacity) as _, i}
          <div class="slot-pip" class:filled={i < slotsUsed}></div>
        {/each}
      </div>
      <span class="slot-count">{slotsUsed}/{capacity}</span>
    </div>
  </div>

  {#if loading}
    <div class="loading-state">
      <span class="loading-dot"></span>
      <span class="loading-text">Loading skills...</span>
    </div>
  {:else if error}
    <div class="error-state">
      <p class="error-text">{error}</p>
      <button class="retry-btn" onclick={loadData}>Retry</button>
    </div>
  {:else}
    <!-- Equipped Skills -->
    <div class="equipped-section">
      {#if equipped.length === 0}
        <p class="empty-msg">No skills equipped. Open the library to equip skills.</p>
      {:else}
        <div class="equipped-list">
          {#each equipped as skill}
            <div class="equipped-card">
              <div class="skill-info">
                <span
                  class="skill-cat-dot"
                  style="background: {CATEGORY_COLORS[skill.skillCategory] ?? 'var(--muted)'}"
                ></span>
                <div class="skill-meta">
                  <span class="skill-name">{skill.skillName}</span>
                  <span class="skill-desc">{skill.skillDescription}</span>
                </div>
                <span class="skill-version">v{skill.skillVersion}</span>
              </div>
              <button
                class="unequip-btn"
                disabled={actionLoading === skill.skillId}
                onclick={() => handleUnequip(skill.skillId)}
              >
                {actionLoading === skill.skillId ? '...' : 'UNEQUIP'}
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Library Toggle -->
    <button class="library-toggle" onclick={() => (showLibrary = !showLibrary)}>
      {showLibrary ? 'HIDE LIBRARY' : 'OPEN LIBRARY'}
      <span class="toggle-arrow" class:open={showLibrary}></span>
    </button>

    <!-- Available Skills Library -->
    {#if showLibrary}
      <div class="library-section">
        {#if categories.length > 1}
          <div class="filter-bar">
            <button
              class="filter-chip"
              class:active={filterCategory === ''}
              onclick={() => (filterCategory = '')}
            >ALL</button>
            {#each categories as cat}
              <button
                class="filter-chip"
                class:active={filterCategory === cat}
                onclick={() => (filterCategory = cat)}
              >{cat.toUpperCase()}</button>
            {/each}
          </div>
        {/if}

        {#if availableSkills.length === 0}
          <p class="empty-msg">
            {allSkills.length === 0
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
                    style="background: {CATEGORY_COLORS[skill.category] ?? 'var(--muted)'}"
                  ></span>
                  <div class="skill-meta">
                    <span class="skill-name">{skill.name}</span>
                    <span class="skill-desc">{skill.description}</span>
                  </div>
                  <span class="skill-class-badge">{skill.minAgentClass}</span>
                </div>
                <button
                  class="equip-btn"
                  disabled={slotsFree <= 0 || actionLoading === skill.id}
                  onclick={() => handleEquip(skill.id)}
                >
                  {#if actionLoading === skill.id}
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

<style>
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
    color: var(--text);
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
    letter-spacing: 0.10em;
    color: var(--muted);
  }

  .slot-bar {
    display: flex;
    gap: 3px;
  }

  .slot-pip {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    border: 1px solid var(--border);
    background: transparent;
    transition: background 0.2s ease;
  }

  .slot-pip.filled {
    background: var(--accent);
    border-color: var(--accent);
  }

  .slot-count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
  }

  /* Loading / Error States */
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
    background: var(--accent);
    animation: pulse 1s ease infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  .loading-text {
    font-size: 12px;
    color: var(--muted);
  }

  .error-state {
    text-align: center;
    padding: var(--space-lg);
  }

  .error-text {
    font-size: 12px;
    color: var(--accent-rose);
    margin: 0 0 var(--space-sm);
  }

  .retry-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--accent);
    background: none;
    border: 1px solid var(--accent);
    padding: 4px 12px;
    border-radius: 3px;
    cursor: pointer;
  }

  .retry-btn:hover {
    background: rgba(124, 58, 237, 0.1);
  }

  /* Equipped section */
  .equipped-section {
    min-height: 40px;
  }

  .equipped-list, .available-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .equipped-card, .available-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    transition: border-color 0.15s ease;
  }

  .equipped-card:hover, .available-card:hover {
    border-color: var(--accent-m);
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
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .skill-version {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--muted);
    flex-shrink: 0;
  }

  .skill-class-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--muted);
    border: 1px solid var(--border);
    padding: 1px 4px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .unequip-btn, .equip-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    padding: 4px 10px;
    border-radius: 3px;
    cursor: pointer;
    flex-shrink: 0;
    border: 1px solid;
    transition: all 0.15s ease;
  }

  .unequip-btn {
    color: var(--accent-rose);
    background: transparent;
    border-color: rgba(244, 114, 182, 0.25);
  }

  .unequip-btn:hover:not(:disabled) {
    background: rgba(244, 114, 182, 0.1);
    border-color: var(--accent-rose);
  }

  .equip-btn {
    color: var(--accent-teal);
    background: transparent;
    border-color: rgba(45, 212, 191, 0.25);
  }

  .equip-btn:hover:not(:disabled) {
    background: rgba(45, 212, 191, 0.1);
    border-color: var(--accent-teal);
  }

  .equip-btn:disabled, .unequip-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Library toggle */
  .library-toggle {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--accent);
    background: none;
    border: 1px solid var(--border);
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
    border-color: var(--accent);
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

  /* Library section */
  .library-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-md);
    background: rgba(124, 58, 237, 0.03);
    border: 1px solid var(--border);
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
    letter-spacing: 0.10em;
    color: var(--muted);
    background: transparent;
    border: 1px solid var(--border);
    padding: 3px 8px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-chip:hover {
    color: var(--text);
    border-color: var(--accent-m);
  }

  .filter-chip.active {
    color: var(--text);
    background: rgba(124, 58, 237, 0.15);
    border-color: var(--accent);
  }

  .empty-msg {
    font-size: 12px;
    color: var(--muted);
    text-align: center;
    padding: var(--space-lg);
    margin: 0;
  }
</style>
