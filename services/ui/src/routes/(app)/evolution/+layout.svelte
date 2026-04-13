<script lang="ts">
  import { page } from '$app/stores';

  let { children } = $props();

  const evolutionTabs = [
    { href: '/evolution',            label: 'FLEET' },
    { href: '/evolution/agents',     label: 'AGENTS' },
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
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    padding: 0 var(--space-xl);
  }

  .evolution-tab {
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

  .evolution-tab:hover {
    color: var(--text);
  }

  .evolution-tab.active {
    border-bottom-color: var(--accent);
    color: var(--text);
  }

  .evolution-content {
    padding: var(--space-2xl) var(--space-xl) var(--space-xl);
  }

  @media (max-width: 768px) {
    .evolution-tab-bar {
      padding: 0 var(--space-md);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .evolution-tab-bar::-webkit-scrollbar {
      display: none;
    }

    .evolution-tab {
      padding: 0 var(--space-lg);
      font-size: 6px;
    }

    .evolution-content {
      padding: var(--space-lg) var(--space-md) var(--space-lg);
    }
  }

  @media (max-width: 480px) {
    .evolution-tab {
      padding: 0 var(--space-md);
      font-size: 5px;
    }
  }
</style>
