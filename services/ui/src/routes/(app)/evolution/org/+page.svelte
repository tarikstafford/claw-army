<script lang="ts">
  import OrgMap from '$lib/components/evolution/OrgMap.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="org-page">
  <h1 class="page-title">Fleet Organisation</h1>
  {#if data.orgData}
    <div class="org-container">
      <OrgMap data={data.orgData} />
    </div>
  {:else}
    <div class="org-empty">
      <p class="empty-heading">No fleet data</p>
      <p class="empty-body">Deploy agents to see your fleet organisation map.</p>
    </div>
  {/if}
</div>

<style>
  .org-page {
    padding: 0;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-xl);
  }

  .org-container {
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    overflow-x: auto;
  }

  .org-empty {
    padding: var(--space-2xl);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .empty-heading {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-sm);
  }

  .empty-body {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
  }
</style>
