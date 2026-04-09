<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
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

  const evolutionTabs = [
    { href: '/evolution',            label: 'FLEET' },
    { href: '/evolution/agents',     label: 'AGENTS' },
    { href: '/evolution/skills',     label: 'SKILLS' },
    { href: '/evolution/benchmarks', label: 'BENCHMARKS' },
    { href: '/evolution/org',        label: 'ORG' },
  ] as const;

  function isTabActive(href: string): boolean {
    if (href === '/evolution') {
      return $page.url.pathname === '/evolution';
    }
    return $page.url.pathname.startsWith(href);
  }
</script>

<div class="evolution-layout">
  <nav class="evolution-tab-bar">
    {#each evolutionTabs as tab}
      <a href={tab.href} class="evolution-tab" class:active={isTabActive(tab.href)}>
        {tab.label}
      </a>
    {/each}
  </nav>
  <div class="evolution-content">
    {@render children()}
  </div>
</div>

<style>
  .evolution-tab-bar {
    height: 44px;
    display: flex;
    align-items: center;
    gap: 0;
    background: var(--bo-bg);
    border-bottom: 1px solid var(--bo-border);
    padding: 0 var(--space-xl);
  }

  .evolution-tab {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    text-decoration: none;
    padding: 0 var(--space-xl);
    height: 44px;
    display: flex;
    align-items: center;
    border-bottom: 2px solid transparent;
    transition: color 0.15s ease;
  }

  .evolution-tab:hover {
    color: var(--bo-text);
  }

  .evolution-tab.active {
    border-bottom-color: var(--bo-violet);
    color: var(--bo-text);
  }

  .evolution-content {
    padding: var(--space-2xl) var(--space-xl) var(--space-xl);
  }
</style>
