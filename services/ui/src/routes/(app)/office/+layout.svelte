<script lang="ts">
  import { page } from '$app/stores';

  let { children } = $props();

  const sections = [
    { href: '/office/agents', label: 'AGENTS' },
    { href: '/office/issues', label: 'ISSUES' },
    { href: '/office/goals', label: 'OBJECTIVES' },
    { href: '/office/projects', label: 'PROJECTS' },
  ];
</script>

<div class="office-layout">
  <nav class="office-subnav" aria-label="Office navigation">
    {#each sections as section}
      <a
        href={section.href}
        class="subnav-item"
        class:active={$page.url.pathname.startsWith(section.href)}
        aria-current={$page.url.pathname.startsWith(section.href) ? 'page' : undefined}
      >
        {section.label}
      </a>
    {/each}
  </nav>
  <div class="office-content">
    {@render children()}
  </div>
</div>

<style>
  .office-layout {
    display: flex;
    min-height: calc(100vh - 44px);
  }

  .office-subnav {
    width: 160px;
    flex-shrink: 0;
    position: sticky;
    top: 44px;
    height: calc(100vh - 44px);
    padding: var(--space-md) 0;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
  }

  .subnav-item {
    display: block;
    padding: 10px 16px;
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
    text-decoration: none;
    background: transparent;
    transition: background 0.15s, color 0.15s;
  }

  .subnav-item:hover {
    background: var(--bg2);
    color: var(--accent);
  }

  .subnav-item.active {
    background: var(--accent);
    color: #fff;
  }

  .office-content {
    flex: 1;
    padding: var(--space-xl) var(--space-2xl);
    min-width: 0;
  }

</style>
