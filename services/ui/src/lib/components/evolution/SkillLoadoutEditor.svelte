<script lang="ts">
  import type { Skill, SkillConflict, EffectivenessClass } from '$lib/api';

  let {
    botId,
    equippedSkills = [],
    availableSkills = [],
    conflicts = [],
    maxCapacity = 5,
    onEquip,
    onUnequip,
    onReorder
  }: {
    botId: string;
    equippedSkills: Skill[];
    availableSkills: Skill[];
    conflicts: SkillConflict[];
    maxCapacity?: number;
    onEquip?: (skillId: string, slotIndex: number) => void;
    onUnequip?: (skillId: string) => void;
    onReorder?: (skillIds: string[]) => void;
  } = $props();

  const EFFECTIVENESS_COLORS: Record<EffectivenessClass, string> = {
    exceptional: 'var(--bo-teal)',
    good: 'var(--bo-violet)',
    average: 'var(--bo-amber)',
    poor: 'var(--bo-rose)',
    untested: 'var(--bo-faint)',
  };

  function getEffectivenessClass(score: number | null): EffectivenessClass {
    if (score === null) return 'untested';
    if (score >= 0.85) return 'exceptional';
    if (score >= 0.70) return 'good';
    if (score >= 0.50) return 'average';
    return 'poor';
  }

  let draggedIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);

  function handleDragStart(index: number) {
    draggedIndex = index;
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    dragOverIndex = index;
  }

  function handleDrop(index: number) {
    if (draggedIndex === null || draggedIndex === index) return;
    const newOrder = [...equippedSkills.map(s => s.id)];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, removed);
    onReorder?.(newOrder);
    draggedIndex = null;
    dragOverIndex = null;
  }

  function handleDragEnd() {
    draggedIndex = null;
    dragOverIndex = null;
  }

  function getConflictForSkill(skillId: string): SkillConflict | undefined {
    return conflicts.find(c => c.skillA === skillId || c.skillB === skillId);
  }

  function isSkillEquipped(skillId: string): boolean {
    return equippedSkills.some(s => s.id === skillId);
  }

  let unequippedAvailable = $derived(
    availableSkills.filter(s => !isSkillEquipped(s.id) && s.isApproved)
  );
</script>

<div class="loadout-editor">
  <div class="capacity-bar">
    <span class="capacity-label">CAPACITY</span>
    <div class="capacity-track">
      <div
        class="capacity-fill"
        style="width: {(equippedSkills.length / maxCapacity) * 100}%"
        class:full={equippedSkills.length >= maxCapacity}
      ></div>
    </div>
    <span class="capacity-count">{equippedSkills.length}/{maxCapacity}</span>
  </div>

  <div class="equipped-section">
    <h4 class="section-title">EQUIPPED</h4>
    {#if equippedSkills.length === 0}
      <p class="empty-text">No skills equipped. Drag from available or click equip.</p>
    {:else}
      <div class="equipped-list">
        {#each equippedSkills as skill, index (skill.id)}
          {@const conflict = getConflictForSkill(skill.id)}
          {@const effClass = getEffectivenessClass(skill.avgEffectivenessScore)}
          <div
            class="equipped-item"
            class:dragging={draggedIndex === index}
            class:drag-over={dragOverIndex === index}
            class:has-conflict={conflict !== undefined}
            draggable="true"
            ondragstart={() => handleDragStart(index)}
            ondragover={(e) => handleDragOver(e, index)}
            ondrop={() => handleDrop(index)}
            ondragend={handleDragEnd}
            role="listitem"
          >
            <span class="drag-handle">⠿</span>
            <div class="skill-info">
              <span class="skill-name">{skill.name}</span>
              <span class="slot-index">#{index + 1}</span>
            </div>
            <span
              class="eff-badge"
              style="color: {EFFECTIVENESS_COLORS[effClass]}"
            >
              {effClass.toUpperCase()}
            </span>
            {#if conflict}
              <div class="conflict-warning" title="{conflict.conflictType}: {conflict.severity} severity">
                <span class="warning-icon">⚠</span>
                <span class="conflict-type">{conflict.conflictType}</span>
              </div>
            {/if}
            <button
              class="unequip-btn"
              onclick={() => onUnequip?.(skill.id)}
              aria-label="Unequip {skill.name}"
            >×</button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="available-section">
    <h4 class="section-title">AVAILABLE</h4>
    {#if unequippedAvailable.length === 0}
      <p class="empty-text">No available skills to equip.</p>
    {:else}
      <div class="available-list">
        {#each unequippedAvailable as skill (skill.id)}
          {@const effClass = getEffectivenessClass(skill.avgEffectivenessScore)}
          <div class="available-item">
            <div class="skill-info">
              <span class="skill-name">{skill.name}</span>
              <span class="skill-category">{skill.category}</span>
            </div>
            <span
              class="eff-badge"
              style="color: {EFFECTIVENESS_COLORS[effClass]}"
            >
              {skill.avgEffectivenessScore !== null ? (skill.avgEffectivenessScore * 100).toFixed(0) + '%' : '—'}
            </span>
            <button
              class="equip-btn"
              onclick={() => onEquip?.(skill.id, equippedSkills.length)}
              disabled={equippedSkills.length >= maxCapacity}
              aria-label="Equip {skill.name}"
            >+</button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .loadout-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .capacity-bar {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .capacity-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.08em;
    color: var(--bo-muted);
  }

  .capacity-track {
    flex: 1;
    height: 4px;
    background: var(--bo-ghost);
    border-radius: 2px;
    overflow: hidden;
  }

  .capacity-fill {
    height: 100%;
    background: var(--bo-violet);
    border-radius: 2px;
    transition: width 0.2s ease;
  }

  .capacity-fill.full {
    background: var(--bo-amber);
  }

  .capacity-count {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-muted);
  }

  .section-title {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.08em;
    color: var(--bo-faint);
    margin: 0 0 var(--space-sm);
  }

  .empty-text {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-faint);
    margin: 0;
    padding: var(--space-md);
    text-align: center;
    background: var(--bo-card);
    border: 1px dashed var(--bo-border);
    border-radius: var(--radius-md);
  }

  .equipped-list, .available-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .equipped-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    cursor: grab;
    transition: all 0.15s ease;
  }

  .equipped-item:hover {
    border-color: var(--bo-bhi);
  }

  .equipped-item.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }

  .equipped-item.drag-over {
    border-color: var(--bo-violet);
    background: rgba(124, 58, 237, 0.08);
  }

  .equipped-item.has-conflict {
    border-color: rgba(244, 114, 182, 0.4);
  }

  .drag-handle {
    color: var(--bo-faint);
    font-size: 12px;
    cursor: grab;
  }

  .skill-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .skill-name {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-text);
  }

  .slot-index {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--bo-faint);
  }

  .skill-category {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.06em;
    color: var(--bo-muted);
    text-transform: uppercase;
  }

  .eff-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.06em;
  }

  .conflict-warning {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    background: rgba(244, 114, 182, 0.10);
    border-radius: 3px;
  }

  .warning-icon {
    font-size: 10px;
    color: var(--bo-rose);
  }

  .conflict-type {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--bo-rose);
  }

  .unequip-btn, .equip-btn {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid var(--bo-border);
    background: transparent;
    color: var(--bo-muted);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    padding: 0;
    flex-shrink: 0;
  }

  .unequip-btn:hover {
    border-color: var(--bo-rose);
    color: var(--bo-rose);
  }

  .equip-btn:hover:not(:disabled) {
    border-color: var(--bo-teal);
    color: var(--bo-teal);
  }

  .equip-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .available-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
  }
</style>
