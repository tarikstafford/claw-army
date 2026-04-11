<script lang="ts">
  import LineageTree from '$lib/components/evolution/LineageTree.svelte';
  import BotTimeline from '$lib/components/evolution/BotTimeline.svelte';
  import ExperimentLedger from '$lib/components/evolution/ExperimentLedger.svelte';
  import IdentityCard from '$lib/components/evolution/IdentityCard.svelte';
  import ProfileTab from '$lib/components/evolution/ProfileTab.svelte';
  import RuntimeStatus from '$lib/components/evolution/RuntimeStatus.svelte';
  import SkillLoadoutEditor from '$lib/components/evolution/SkillLoadoutEditor.svelte';
  import type { PageData } from './$types';
  import { invalidateAll } from '$app/navigation';

  let { data }: { data: PageData } = $props();

  let activeTab = $state<'profile' | 'timeline' | 'lineage' | 'ledger' | 'skills'>('profile');

  const TABS = [
    { id: 'profile' as const, label: 'PROFILE' },
    { id: 'timeline' as const, label: 'TIMELINE' },
    { id: 'lineage' as const, label: 'LINEAGE' },
    { id: 'ledger' as const, label: 'LEDGER' },
    { id: 'skills' as const, label: 'SKILLS' },
  ];

  async function handleEquip(skillId: string) {
    await fetch(`/api/akasa/evolution/bots/${data.botId}/skills/${skillId}/equip`, { method: 'POST' });
    await invalidateAll();
  }

  async function handleUnequip(skillId: string) {
    await fetch(`/api/akasa/evolution/bots/${data.botId}/skills/${skillId}/unequip`, { method: 'POST' });
    await invalidateAll();
  }

  async function handleReorder(orderedSkillIds: string[]) {
    await fetch(`/api/akasa/evolution/bots/${data.botId}/skills/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedSkillIds }),
    });
    await invalidateAll();
  }
</script>

<div class="bot-detail-page">
  <a href="/evolution/agents" class="back-link">← Back to Fleet</a>

  <!-- Identity Card -->
  <div class="identity-section">
    <IdentityCard
      botId={data.botId}
      currentClass={data.profile?.currentClass ?? null}
      archetypeName={data.profile?.archetypeName ?? null}
      taskCategory={data.profile?.taskCategory ?? null}
      isPioneer={data.profile?.isPioneer ?? false}
      compositeScore={data.profile?.compositeScore ?? null}
      status={data.profile?.status ?? null}
    />
  </div>

  <!-- Runtime Status Bar -->
  <div class="runtime-section">
    <RuntimeStatus botId={data.botId} />
  </div>

  <!-- Tab Navigation -->
  <nav class="tab-nav" aria-label="Bot detail tabs">
    {#each TABS as tab}
      <button
        class="tab-btn"
        class:active={activeTab === tab.id}
        onclick={() => (activeTab = tab.id)}
        aria-selected={activeTab === tab.id}
      >{tab.label}</button>
    {/each}
  </nav>

  <!-- Tab Content -->
  <div class="tab-content">
    {#if activeTab === 'profile'}
      {#if data.profile === null}
        <p class="no-data-text">No profile data available</p>
      {:else}
        <ProfileTab
          dimensions={data.profile?.dimensions ?? null}
          soulContent={data.profile?.soulContent ?? null}
          constitutionDirectives={data.profile?.constitutionDirectives ?? null}
          generation={data.profile?.generation ?? null}
          classHistory={data.profile?.classHistory ?? []}
          archetypeName={data.profile?.archetypeName ?? null}
        />
      {/if}
    {:else if activeTab === 'timeline'}
      <BotTimeline events={data.timeline} />
    {:else if activeTab === 'lineage'}
      {#if data.lineage.length > 0}
        <div class="lineage-container">
          <LineageTree nodes={data.lineage} />
        </div>
      {:else}
        <p class="no-data-text">No lineage data available</p>
      {/if}
    {:else if activeTab === 'ledger'}
      <ExperimentLedger rows={data.ledger} />
    {:else if activeTab === 'skills'}
      {#if data.loadout === null}
        <p class="no-data-text">Failed to load skill loadout</p>
      {:else}
        <SkillLoadoutEditor
          loadout={data.loadout}
          availableSkills={data.skills ?? []}
          onequip={handleEquip}
          onunequip={handleUnequip}
          onreorder={handleReorder}
        />
      {/if}
    {/if}
  </div>
</div>

<style>
  .bot-detail-page {
    max-width: 900px;
    padding: var(--space-2xl) var(--space-xl) var(--space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .back-link {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    text-decoration: none;
    display: inline-block;
    margin-bottom: var(--space-sm);
    transition: color 0.15s ease;
  }

  .back-link:hover {
    color: var(--bo-text);
  }

  .identity-section {
    margin-bottom: var(--space-sm);
  }

  .runtime-section {
    margin-bottom: var(--space-sm);
  }

  /* Tab navigation */
  .tab-nav {
    display: flex;
    align-items: center;
    gap: 0;
    border-bottom: 1px solid var(--bo-border);
    margin-bottom: var(--space-lg);
  }

  .tab-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--space-sm) var(--space-lg);
    cursor: pointer;
    margin-bottom: -1px;
    transition: color 0.15s ease, border-color 0.15s ease;
  }

  .tab-btn:hover {
    color: var(--bo-muted);
  }

  .tab-btn.active {
    color: var(--bo-text);
    border-bottom-color: var(--bo-violet);
  }

  /* Tab content */
  .tab-content {
    min-height: 200px;
  }

  .lineage-container {
    background: var(--bo-card);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    overflow-x: auto;
  }

  .no-data-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-faint);
    padding: var(--space-xl);
    text-align: center;
  }
</style>
