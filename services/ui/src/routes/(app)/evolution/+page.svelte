<script lang="ts">
  import FleetOverview from '$lib/components/evolution/FleetOverview.svelte';
  import FleetSkillHeatmap from '$lib/components/evolution/FleetSkillHeatmap.svelte';
  import VerdictConfirm from '$lib/components/evolution/VerdictConfirm.svelte';

  let { data } = $props();
  let pendingVerdicts = $state(data.pendingVerdicts ?? []);

  function handleVerdictAction(action: 'confirmed' | 'rejected', id: string) {
    pendingVerdicts = pendingVerdicts.filter((v: any) => v.id !== id);
  }
</script>

<div class="fleet-page">
  {#if data.fleet === null && data.agents.length === 0}
    <p class="error-state">Failed to load fleet data. Refresh to retry.</p>
  {/if}

  <!-- Section 1: Class Distribution Grid + Score Trend -->
  <FleetOverview fleet={data.fleet} agents={data.agents} />

  <!-- Section 2: Pending Verdicts -->
  {#if pendingVerdicts.length > 0}
    <section class="pending-section">
      <h2 class="section-heading">Awaiting Your Decision</h2>
      <div class="pending-list">
        {#each pendingVerdicts as v (v.id)}
          <VerdictConfirm verdict={v} onaction={handleVerdictAction} />
        {/each}
      </div>
    </section>
  {/if}

  <!-- Section 3: Fleet Skill Heatmap -->
  {#if data.heatmap && data.heatmap.agents.length > 0 && data.heatmap.skills.length > 0}
    <section class="heatmap-section">
      <h2 class="section-heading">Fleet Skill Effectiveness</h2>
      <FleetSkillHeatmap
        agents={data.heatmap.agents}
        skills={data.heatmap.skills}
        matrix={data.heatmap.matrix}
      />
    </section>
  {/if}
</div>

<style>
  .fleet-page {
    padding: var(--space-2xl) var(--space-xl) var(--space-xl);
    max-width: 960px;
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .error-state {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-muted);
    margin: 0;
  }

  .pending-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .section-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0;
  }

  .pending-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .heatmap-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
</style>
