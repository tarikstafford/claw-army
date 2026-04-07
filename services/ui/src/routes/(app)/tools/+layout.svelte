<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { setMode, getMode, type AkasaMode } from '$lib/mode';

  let { children } = $props();
  let previousMode: AkasaMode | null = $state(null);

  onMount(() => {
    previousMode = getMode();
    setMode('back-office');
    return () => {
      if (previousMode && previousMode !== 'back-office') {
        setMode(previousMode);
      }
    };
  });

  const toolsTabs = [
    { href: '/tools/catalog', label: 'CATALOG' },
    { href: '/tools/belt', label: 'MY TOOLS' },
    { href: '/tools/webhooks', label: 'WEBHOOKS' },
  ] as const;

  function isTabActive(href: string): boolean {
    return $page.url.pathname.startsWith(href);
  }
</script>

<div class="tools-layout">
  <nav class="tools-tab-bar">
    {#each toolsTabs as tab}
      <a href={tab.href} class="tools-tab" class:active={isTabActive(tab.href)}>
        {tab.label}
      </a>
    {/each}
  </nav>
  <div class="tools-content">
    {@render children()}
  </div>
</div>

<style>
  .tools-tab-bar {
    height: 44px;
    display: flex;
    align-items: center;
    gap: 0;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    padding: 0 var(--space-xl);
  }

  .tools-tab {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
    text-decoration: none;
    padding: 0 var(--space-xl);
    height: 44px;
    display: flex;
    align-items: center;
    border-bottom: 2px solid transparent;
    transition: color 0.15s ease;
  }

  .tools-tab:hover {
    color: var(--text);
  }

  .tools-tab.active {
    border-bottom-color: var(--rose, #F472B6);
    color: var(--text);
  }

  .tools-content {
    padding: var(--space-2xl) var(--space-xl) var(--space-xl);
  }
</style>
