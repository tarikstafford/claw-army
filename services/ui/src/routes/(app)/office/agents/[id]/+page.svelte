<script lang="ts">
  import type { PageData } from './$types';
  import SkillLoadout from '$lib/components/evolution/SkillLoadout.svelte';
  import { getAgentSkills, getSkills, type EquippedSkill, type Skill } from '$lib/api';

  let { data }: { data: PageData } = $props();

  interface Toast {
    id: string;
    type: 'error' | 'success';
    message: string;
  }

  let toasts = $state<Toast[]>([]);
  let equippedSkills = $state<EquippedSkill[]>([]);
  let allSkills = $state<Skill[]>([]);
  let skillsLoading = $state(true);
  let skillsError = $state<string | null>(null);

  function addToast(message: string, type: 'error' | 'success' = 'error') {
    const id = crypto.randomUUID().slice(0, 8);
    toasts = [{ id, type, message }, ...toasts].slice(0, 5);
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 4000);
  }

  function dismissToast(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
  }

  async function loadSkills() {
    skillsLoading = true;
    skillsError = null;
    try {
      const [equippedRes, skillsRes] = await Promise.allSettled([
        getAgentSkills(data.agent.id),
        getSkills(data.userId),
      ]);
      equippedSkills = equippedRes.status === 'fulfilled' ? equippedRes.value : [];
      allSkills = skillsRes.status === 'fulfilled' ? skillsRes.value : [];
      if (equippedRes.status === 'rejected') {
        skillsError = 'Failed to load equipped skills';
      }
      if (skillsRes.status === 'rejected') {
        skillsError = 'Failed to load skills library';
      }
    } catch (err) {
      skillsError = (err as Error).message;
    } finally {
      skillsLoading = false;
    }
  }

  function handleEquipSuccess(skill: Skill) {
    addToast(`Equipped ${skill.name}`, 'success');
  }

  function handleEquipError(err: Error, skill: Skill) {
    addToast(`Failed to equip ${skill.name}: ${err.message}`, 'error');
  }

  function handleUnequipSuccess(skillId: string) {
    addToast('Skill unequipped', 'success');
  }

  function handleUnequipError(err: Error, skillId: string) {
    addToast(`Failed to unequip skill: ${err.message}`, 'error');
  }

  $effect(() => {
    loadSkills();
  });

  function getStatusLabel(status: string | null | undefined): string {
    switch (status) {
      case 'working': return 'working';
      case 'complete':
      case 'done': return 'done';
      default: return 'idle';
    }
  }

  function getStatusColor(status: string | null | undefined): string {
    switch (status) {
      case 'working': return 'var(--fo-gold)';
      case 'complete':
      case 'done': return 'var(--bo-teal)';
      default: return 'var(--text-muted)';
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

  {#if data.agent.description}
    <div class="agent-section">
      <span class="section-eyebrow">DESCRIPTION</span>
      <p class="agent-description">{data.agent.description}</p>
    </div>
  {/if}

  <div class="agent-meta">
    <div class="meta-row">
      <span class="meta-label">Adapter</span>
      <span class="meta-value">{data.agent.adapter ?? '—'}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Created</span>
      <span class="meta-value">{new Date(data.agent.createdAt).toLocaleDateString()}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Last updated</span>
      <span class="meta-value">{new Date(data.agent.updatedAt).toLocaleDateString()}</span>
    </div>
  </div>

  <div class="skill-section">
    <span class="section-eyebrow">SKILLS</span>
    <SkillLoadout
      botId={data.agent.id}
      userId={data.userId}
      agentClass={null}
      initialEquipped={equippedSkills}
      initialAllSkills={allSkills}
      onEquipSuccess={handleEquipSuccess}
      onEquipError={handleEquipError}
      onUnequipSuccess={handleUnequipSuccess}
      onUnequipError={handleUnequipError}
    />
  </div>
</div>

{#if toasts.length > 0}
  <div class="toast-container">
    {#each toasts as toast (toast.id)}
      <div class="toast" class:toast-error={toast.type === 'error'} class:toast-success={toast.type === 'success'}>
        <span class="toast-text">{toast.message}</span>
        <button class="toast-dismiss" onclick={() => dismissToast(toast.id)} aria-label="Dismiss">×</button>
      </div>
    {/each}
  </div>
{/if}

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
    letter-spacing: 0.10em;
  }

  .agent-section {
    margin-bottom: var(--space-xl);
  }

  .section-eyebrow {
    font-family: var(--font-label);
    font-size: 6px;
    color: var(--text-muted);
    letter-spacing: 0.10em;
    display: block;
    margin-bottom: var(--space-sm);
  }

  .agent-description {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.8;
    color: inherit;
    margin: 0;
  }

  .agent-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    border-top: 1px solid var(--fo-border);
    padding-top: var(--space-xl);
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

  .agent-name {
    color: var(--text);
  }

  .agent-meta {
    border-top-color: var(--border);
  }

  .skill-section {
    margin-top: var(--space-xl);
    border-top: 1px solid var(--fo-border);
    padding-top: var(--space-xl);
  }

  .toast-container {
    position: fixed;
    top: 104px;
    right: 20px;
    z-index: 600;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    animation: slideIn 0.25s ease-out;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    pointer-events: all;
  }

  .toast.toast-error {
    border-color: var(--bo-rose);
  }

  .toast.toast-success {
    border-color: var(--bo-teal);
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(16px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .toast-text {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    color: var(--text-muted);
    line-height: 1.5;
    flex: 1;
    min-width: 0;
  }

  .toast.toast-error .toast-text {
    color: var(--bo-rose);
  }

  .toast.toast-success .toast-text {
    color: var(--bo-teal);
  }

  .toast-dismiss {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 0;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
    transition: color 0.2s ease;
  }

  .toast-dismiss:hover {
    color: var(--text-muted);
  }
</style>
