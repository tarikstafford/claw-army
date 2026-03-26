<script lang="ts">
  import LineageTree from '$lib/components/evolution/LineageTree.svelte';
  import BotTimeline from '$lib/components/evolution/BotTimeline.svelte';
  import ExperimentLedger from '$lib/components/evolution/ExperimentLedger.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="bot-detail-page">
  <a href="/evolution/agents" class="back-link">← Back to Fleet</a>
  <h1 class="page-title">Bot <span class="bot-id">{data.botId.slice(0, 8)}</span></h1>

  {#if data.lineage.length > 0}
    <section class="detail-section">
      <h2 class="section-title">Soul Lineage</h2>
      <div class="lineage-container">
        <LineageTree nodes={data.lineage} />
      </div>
    </section>
  {/if}

  <section class="detail-section">
    <h2 class="section-title">Evolution Timeline</h2>
    <BotTimeline events={data.timeline} />
  </section>

  <section class="detail-section">
    <h2 class="section-title">Experiment Ledger</h2>
    <ExperimentLedger rows={data.ledger} />
  </section>
</div>

<style>
  .bot-detail-page {
    max-width: 900px;
    padding: var(--space-2xl) var(--space-xl) var(--space-xl);
  }

  .back-link {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    text-decoration: none;
    display: inline-block;
    margin-bottom: var(--space-md);
    transition: color 0.15s ease;
  }

  .back-link:hover {
    color: var(--bo-text);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-xl);
  }

  .bot-id {
    font-family: var(--font-mono);
    color: var(--bo-violet);
  }

  .detail-section {
    margin-bottom: var(--space-2xl);
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-md);
  }

  .lineage-container {
    background: var(--bo-card);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    overflow-x: auto;
  }
</style>
