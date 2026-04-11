<script lang="ts">
  import type { Skill, BotSkillLoadout } from '$lib/api';
  import SkillCard from './SkillCard.svelte';

  let {
    loadout,
    availableSkills,
    onequip,
    onunequip,
    onreorder,
  }: {
    loadout: BotSkillLoadout;
    availableSkills: Skill[];
    onequip?: (skillId: string) => void;
    onunequip?: (skillId: string) => void;
    onreorder?: (orderedSkillIds: string[]) => void;
  } = $props();

  let draggingId = $state<string | null>(null);
  let dragOverId = $state<string | null>(null);

  const equippedMap = $derived(new Set(loadout.equippedSkillIds));
  const unequippedSkills = $derived(availableSkills.filter(s => !equippedMap.has(s.id)));
  const equippedSkills = $derived(loadout.equippedSkillIds.map(id => availableSkills.find(s => s.id === id)).filter(Boolean) as Skill[]);

  function handleDragStart(skillId: string) {
    draggingId = skillId;
  }

  function handleDragOver(skillId: string) {
    if (draggingId && draggingId !== skillId) {
      dragOverId = skillId;
    }
  }

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId || !onreorder) return;
    const fromIdx = loadout.equippedSkillIds.indexOf(draggingId);
    const toIdx = loadout.equippedSkillIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const newOrder = [...loadout.equippedSkillIds];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggingId);
    onreorder(newOrder);
    draggingId = null;
    dragOverId = null;
  }

  function handleDragEnd() {
    draggingId = null;
    dragOverId = null;
  }
</script>

<div class="loadout-editor">
  <div class="capacity-bar">
    <span class="capacity-label">SKILL SLOTS</span>
    <span class="capacity-value">{loadout.equippedSkillIds.length} / {loadout.capacity}</span>
    <div class="capacity-track">
      <div
        class="capacity-fill"
        class:full={loadout.equippedSkillIds.length >= loadout.capacity}
        style="width: {(loadout.equippedSkillIds.length / loadout.capacity) * 100}%"
      ></div>
    </div>
  </div>

  {#if loadout.equippedSkillIds.length === 0}
    <div class="empty-state">
      <p class="empty-text">No skills equipped. Equip skills from your library below.</p>
    </div>
  {:else}
    <div class="equipped-list">
      {#each equippedSkills as skill (skill.id)}
        <div
          class="equipped-item"
          class:dragging={draggingId === skill.id}
          class:drag-over={dragOverId === skill.id}
          draggable="true"
          role="listitem"
          ondragstart={() => handleDragStart(skill.id)}
          ondragover={(e) => { e.preventDefault(); handleDragOver(skill.id); }}
          ondrop={() => handleDrop(skill.id)}
          ondragend={handleDragEnd}
        >
          <span class="drag-handle" aria-hidden="true">&#9776;</span>
          <div class="equipped-skill-info">
            <span class="equipped-skill-name">{skill.name}</span>
            <span class="equipped-skill-category">{skill.category}</span>
          </div>
          <button
            class="unequip-btn"
            onclick={() => onunequip?.(skill.id)}
            aria-label="Unequip {skill.name}"
          >
            &#10005;
          </button>
        </div>
      {/each}
    </div>
  {/if}

  {#if unequippedSkills.length > 0}
    <div class="library-section">
      <h3 class="library-heading">SKILL LIBRARY</h3>
      <div class="library-grid">
        {#each unequippedSkills as skill (skill.id)}
          <div class="library-skill-wrap">
            <SkillCard
              {skill}
              onselect={() => onequip?.(skill.id)}
            />
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .loadout-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .capacity-bar {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-md) var(--space-lg);
  }

  .capacity-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    flex-shrink: 0;
  }

  .capacity-value {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-text);
    flex-shrink: 0;
  }

  .capacity-track {
    flex: 1;
    height: 4px;
    background: var(--bo-border);
    border-radius: 2px;
    overflow: hidden;
  }

  .capacity-fill {
    height: 100%;
    background: var(--bo-violet);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .capacity-fill.full {
    background: var(--bo-amber);
  }

  .empty-state {
    background: var(--bo-card);
    border: 1px dashed var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-xl);
    text-align: center;
  }

  .empty-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
  }

  .equipped-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .equipped-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    cursor: grab;
    transition: border-color 0.15s ease, opacity 0.15s ease;
  }

  .equipped-item:active {
    cursor: grabbing;
  }

  .equipped-item.dragging {
    opacity: 0.5;
  }

  .equipped-item.drag-over {
    border-color: var(--bo-violet);
  }

  .drag-handle {
    color: var(--bo-faint);
    font-size: 14px;
    flex-shrink: 0;
  }

  .equipped-skill-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .equipped-skill-name {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-text);
  }

  .equipped-skill-category {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    text-transform: uppercase;
  }

  .unequip-btn {
    background: none;
    border: none;
    color: var(--bo-faint);
    cursor: pointer;
    font-size: 12px;
    padding: var(--space-xs);
    border-radius: var(--radius-sm);
    transition: color 0.15s ease;
  }

  .unequip-btn:hover {
    color: var(--bo-rose);
  }

  .library-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .library-heading {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    margin: 0;
  }

  .library-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-md);
  }

  .library-skill-wrap {
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
