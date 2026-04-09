<script lang="ts">
  import type { Skill, BotSkillLoadout, SkillConflict } from '$lib/api.js';

  let { botId, loadout, skills, conflicts = [] }: {
    botId: string;
    loadout: BotSkillLoadout | null;
    skills: Skill[];
    conflicts?: SkillConflict[];
  } = $props();

  let equipped = $state<string[]>(loadout?.equippedSkillIds ?? []);
  let dragging = $state<string | null>(null);
  let dragOver = $state<string | null>(null);

  const capacity = $derived(loadout?.capacity ?? 5);
  const usedSlots = $derived(equipped.length);
  const capacityFraction = $derived(`${usedSlots}/${capacity}`);

  const equippedSkills = $derived(
    equipped.map(id => skills.find(s => s.id === id)).filter(Boolean) as Skill[]
  );

  const availableSkills = $derived(
    skills.filter(s => !equipped.includes(s.id))
  );

  function getConflictForSkill(skillId: string): SkillConflict | undefined {
    return conflicts.find(c => c.skillA === skillId || c.skillB === skillId);
  }

  function handleDragStart(e: DragEvent, skillId: string) {
    dragging = skillId;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: DragEvent, skillId: string) {
    e.preventDefault();
    dragOver = skillId;
  }

  function handleDrop(e: DragEvent, targetId: string) {
    e.preventDefault();
    if (!dragging || dragging === targetId) {
      dragging = null;
      dragOver = null;
      return;
    }
    const fromIdx = equipped.indexOf(dragging);
    const toIdx = equipped.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...equipped];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, dragging);
    equipped = next;
    dragging = null;
    dragOver = null;
  }

  function handleDragEnd() {
    dragging = null;
    dragOver = null;
  }

  function unequip(skillId: string) {
    equipped = equipped.filter(id => id !== skillId);
  }

  function equip(skillId: string) {
    if (equipped.length >= capacity) return;
    equipped = [...equipped, skillId];
  }
</script>

<div class="skill-loadout">
  <div class="loadout-header">
    <span class="capacity-label">EQUIPPED</span>
    <span class="capacity-value" class:at-capacity={usedSlots >= capacity}>
      {capacityFraction}
    </span>
    <span class="capacity-label">SKILLS</span>
  </div>

  <div class="equipped-list">
    {#if equippedSkills.length === 0}
      <div class="empty-equipped">No skills equipped — drag from available below</div>
    {:else}
      {#each equippedSkills as skill (skill.id)}
        {@const conflict = getConflictForSkill(skill.id)}
        <div
          class="equipped-item"
          class:dragging={dragging === skill.id}
          class:drag-over={dragOver === skill.id}
          class:has-conflict={!!conflict}
          draggable="true"
          role="listitem"
         ondragstart={(e) => handleDragStart(e, skill.id)}
          ondragover={(e) => handleDragOver(e, skill.id)}
          ondrop={(e) => handleDrop(e, skill.id)}
          ondragend={handleDragEnd}
        >
          <span class="equipped-handle">⠿</span>
          <div class="equipped-info">
            <span class="equipped-name">{skill.name}</span>
            <span class="equipped-category">{skill.category}</span>
          </div>
          {#if conflict}
            <span class="conflict-warning" title={conflict.description}>⚠</span>
          {/if}
          <button class="unequip-btn" onclick={() => unequip(skill.id)}>✕</button>
        </div>
      {/each}
    {/if}
  </div>

  {#if usedSlots >= capacity}
    <p class="capacity-limit-msg">Capacity full — unequip a skill to swap</p>
  {/if}

  {#if availableSkills.length > 0}
    <div class="available-section">
      <h4 class="available-title">AVAILABLE</h4>
      <div class="available-list">
        {#each availableSkills as skill (skill.id)}
          <div class="available-item">
            <div class="available-info">
              <span class="available-name">{skill.name}</span>
              <span class="available-category">{skill.category}</span>
            </div>
            <button
              class="equip-btn"
              onclick={() => equip(skill.id)}
              disabled={usedSlots >= capacity}
            >EQUIP</button>
          </div>
        {/each}
      </div>
    </div>
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
    gap: var(--space-sm);
  }

  .capacity-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-caption);
  }

  .capacity-value {
    font-family: var(--font-body);
    font-size: 15px;
    font-weight: 600;
    color: var(--bo-text);
  }

  .capacity-value.at-capacity {
    color: var(--bo-amber);
  }

  .equipped-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    min-height: 48px;
  }

  .empty-equipped {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-faint);
    padding: var(--space-md);
    border: 1px dashed var(--bo-border);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .equipped-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-sm);
    cursor: grab;
    transition: opacity 0.15s ease, border-color 0.15s ease;
  }

  .equipped-item.dragging {
    opacity: 0.4;
  }

  .equipped-item.drag-over {
    border-color: var(--bo-violet);
  }

  .equipped-item.has-conflict {
    border-color: rgba(244, 114, 182, 0.32);
  }

  .equipped-handle {
    color: var(--bo-faint);
    cursor: grab;
    font-size: 12px;
    flex-shrink: 0;
  }

  .equipped-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .equipped-name {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .equipped-category {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
  }

  .conflict-warning {
    color: var(--bo-rose);
    font-size: 12px;
    flex-shrink: 0;
  }

  .unequip-btn {
    background: none;
    border: none;
    color: var(--bo-faint);
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
    border-radius: 2px;
    flex-shrink: 0;
    transition: color 0.15s ease;
  }

  .unequip-btn:hover {
    color: var(--bo-rose);
  }

  .capacity-limit-msg {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-amber);
    margin: 0;
  }

  .available-section {
    border-top: 1px solid var(--bo-border);
    padding-top: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .available-title {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-caption);
    margin: 0;
  }

  .available-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .available-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--bo-bg);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-sm);
  }

  .available-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .available-name {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .available-category {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
  }

  .equip-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-vb);
    background: none;
    border: 1px solid var(--bo-border);
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    flex-shrink: 0;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .equip-btn:hover:not(:disabled) {
    border-color: var(--bo-violet);
    color: var(--bo-text);
  }

  .equip-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
