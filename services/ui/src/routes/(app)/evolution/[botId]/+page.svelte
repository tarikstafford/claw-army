<script lang="ts">
  import LineageTree from '$lib/components/evolution/LineageTree.svelte';
  import BotTimeline from '$lib/components/evolution/BotTimeline.svelte';
  import ExperimentLedger from '$lib/components/evolution/ExperimentLedger.svelte';
  import IdentityCard from '$lib/components/evolution/IdentityCard.svelte';
  import ProfileTab from '$lib/components/evolution/ProfileTab.svelte';
  import RuntimeStatus from '$lib/components/evolution/RuntimeStatus.svelte';
  import MutationDiff from '$lib/components/evolution/MutationDiff.svelte';
  import ExecutionLogs from '$lib/components/evolution/ExecutionLogs.svelte';
  import SkillLoadout from '$lib/components/evolution/SkillLoadout.svelte';
  import SoulLineagePanel from '$lib/components/evolution/SoulLineagePanel.svelte';
  import DecisionTraceViewer from '$lib/components/evolution/DecisionTraceViewer.svelte';
  import DnaPatterns from '$lib/components/evolution/DnaPatterns.svelte';
  import NegativeSignals from '$lib/components/evolution/NegativeSignals.svelte';
  import type { PageData } from './$types';
  import type { MutationType } from '$lib/components/evolution/MutationDiff.svelte';

  let { data }: { data: PageData } = $props();

  let activeTab = $state<'profile' | 'timeline' | 'lineage' | 'ledger' | 'logs' | 'skills' | 'traces' | 'dna' | 'signals'>('profile');
  let diffState = $state<{
    childId: string;
    parentId: string;
    mutationType: MutationType;
  } | null>(null);

  const TABS = [
    { id: 'profile' as const, label: 'PROFILE' },
    { id: 'skills' as const, label: 'SKILLS' },
    { id: 'timeline' as const, label: 'TIMELINE' },
    { id: 'lineage' as const, label: 'LINEAGE' },
    { id: 'ledger' as const, label: 'LEDGER' },
    { id: 'logs' as const, label: 'LOGS' },
    { id: 'traces' as const, label: 'TRACES' },
    { id: 'dna' as const, label: 'DNA' },
    { id: 'signals' as const, label: 'SIGNALS' },
  ];

  function detectMutationType(parentContent: string, childContent: string): MutationType {
    const parentSections = parseSoulSections(parentContent);
    const childSections = parseSoulSections(childContent);

    const parentKeys = Object.keys(parentSections);
    const childKeys = Object.keys(childSections);
    const allKeys = new Set([...parentKeys, ...childKeys]);

    let sectionsChanged = 0;
    let linesAdded = 0;
    let linesRemoved = 0;
    let newSections = 0;

    for (const key of allKeys) {
      const pLines = parentSections[key] ?? [];
      const cLines = childSections[key] ?? [];

      if (pLines.length === 0 && cLines.length > 0) newSections++;
      if (pLines.join('\n') !== cLines.join('\n')) sectionsChanged++;
      linesRemoved += pLines.filter(l => !cLines.includes(l)).length;
      linesAdded += cLines.filter(l => !pLines.includes(l)).length;
    }

    if (newSections > 0 && sectionsChanged <= 2) return 'introduction';
    if (linesRemoved > linesAdded * 2) return 'attenuation';
    if (linesAdded > linesRemoved * 2) return 'amplification';
    if (sectionsChanged > 2) return 'recombination';
    return 'substitution';
  }

  function parseSoulSections(content: string): Record<string, string[]> {
    const sections: Record<string, string[]> = {};
    const parts = content.split(/^## /m);
    for (const part of parts) {
      if (!part.trim()) continue;
      const newlineIdx = part.indexOf('\n');
      if (newlineIdx === -1) continue;
      const header = part.slice(0, newlineIdx).trim();
      const body = part.slice(newlineIdx + 1).trim();
      sections[header] = body.split('\n').filter(l => l.trim());
    }
    return sections;
  }

  async function handleDiffRequest(childId: string, parentId: string) {
    try {
      const [parentRes, childRes] = await Promise.all([
        fetch(`/api/akasa/souls/${parentId}`),
        fetch(`/api/akasa/souls/${childId}`),
      ]);
      if (parentRes.ok && childRes.ok) {
        const [parentData, childData] = await Promise.all([parentRes.json(), childRes.json()]);
        const detected = detectMutationType(parentData.soulContent, childData.soulContent);
        diffState = { childId, parentId, mutationType: detected };
      }
    } catch { /* silent */ }
  }

  function closeDiff() {
    diffState = null;
  }

  async function handleLedgerDiffRequest(soulId: string, parentId: string, mutationType: MutationType) {
    diffState = { childId: soulId, parentId, mutationType };
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
        <SoulLineagePanel nodes={data.lineage} />
      {:else}
        <p class="no-data-text">No lineage data available</p>
      {/if}
    {:else if activeTab === 'ledger'}
      <ExperimentLedger rows={data.ledger} ondiff={handleLedgerDiffRequest} />
    {:else if activeTab === 'skills'}
      <SkillLoadout
        botId={data.botId}
        userId={data.userId}
        agentClass={data.profile?.currentClass ?? null}
      />
    {:else if activeTab === 'logs'}
      <ExecutionLogs botId={data.botId} />
    {:else if activeTab === 'traces'}
      <DecisionTraceViewer botId={data.botId} />
    {:else if activeTab === 'dna'}
      <DnaPatterns botId={data.botId} category={data.profile?.taskCategory ?? null} />
    {:else if activeTab === 'signals'}
      <NegativeSignals botId={data.botId} />
    {/if}
  </div>

  {#if diffState}
    <MutationDiff
      childSoulId={diffState.childId}
      parentSoulId={diffState.parentId}
      mutationType={diffState.mutationType}
      onClose={closeDiff}
    />
  {/if}
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
