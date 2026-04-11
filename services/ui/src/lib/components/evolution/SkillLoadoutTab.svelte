<script lang="ts">
  import type { Skill, SkillConflict } from '$lib/api';
  import SkillLoadoutEditor from '$lib/components/evolution/SkillLoadoutEditor.svelte';
  import SkillCard from '$lib/components/evolution/SkillCard.svelte';

  let {
    botId,
    equippedSkills = [],
    availableSkills = [],
    conflicts = [],
    maxCapacity = 5,
    onEquip,
    onUnequip,
    onReorder,
    onViewSkill
  }: {
    botId: string;
    equippedSkills: Skill[];
    availableSkills: Skill[];
    conflicts: SkillConflict[];
    maxCapacity?: number;
    onEquip?: (skillId: string, slotIndex: number) => void;
    onUnequip?: (skillId: string) => void;
    onReorder?: (skillIds: string[]) => void;
    onViewSkill?: (skill: Skill) => void;
  } = $props();

  let showAvailable = $state(false);
</script>

<div class="skills-tab">
  <div class="tab-header">
    <h3 class="tab-title">SKILL LOADOUT</h3>
    <button
      class="toggle-btn"
      class:active={!showAvailable}
      onclick={() => showAvailable = false}
    >Equipped</button>
    <button
      class="toggle-btn"
      class:active={showAvailable}
      onclick={() => showAvailable = true}
    >Available</button>
  </div>

  {#if showAvailable}
    <div class="available-grid">
      {#each availableSkills.filter(s => !equippedSkills.some(e => e.id === s.id) && s.isApproved) as skill (skill.id)}
        <SkillCard {skill} onclick={onViewSkill} />
      {/each}
      {#if availableSkills.filter(s => !equippedSkills.some(e => e.id === s.id) && s.isApproved).length === 0}
        <p class="empty-text">No additional skills available</p>
      {/if}
    </div>
  {:else}
    <SkillLoadoutEditor
      {botId}
      {equippedSkills}
      {availableSkills}
      {conflicts}
      {maxCapacity}
      {onEquip}
      {onUnequip}
      {onReorder}
    />
  {/if}
</div>

<style>
  .skills-tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .tab-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .tab-title {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-muted);
    margin: 0;
    margin-right: auto;
  }

  .toggle-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.08em;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--bo-border);
    background: transparent;
    color: var(--bo-faint);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-btn:hover {
    border-color: var(--bo-muted);
    color: var(--bo-muted);
  }

  .toggle-btn.active {
    background: var(--bo-violet);
    border-color: var(--bo-violet);
    color: #fff;
  }

  .available-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-md);
  }

  .empty-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
    padding: var(--space-xl);
    text-align: center;
    grid-column: 1 / -1;
  }
</style>
