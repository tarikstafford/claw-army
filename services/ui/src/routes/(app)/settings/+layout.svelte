<script lang="ts">
  import { page } from '$app/stores';

  let { children } = $props();

  const navItems = [
    { href: '/settings/tools', label: 'Tools' },
    { href: '/settings/billing', label: 'Billing' },
    { href: '/settings/preferences', label: 'Preferences' },
    { href: '/settings/api-keys', label: 'API Keys' },
    { href: '/settings/account', label: 'Account' },
  ] as const;

  let pathname = $derived($page.url.pathname);

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + '/');
  }
</script>

<div class="settings-layout">
  <aside class="settings-sidebar">
    <h1 class="settings-title">Settings</h1>
    <nav class="settings-nav" aria-label="Settings navigation">
      {#each navItems as item}
        <a
          href={item.href}
          class="nav-link"
          class:active={isActive(item.href)}
          aria-current={isActive(item.href) ? 'page' : undefined}
        >
          {item.label}
        </a>
      {/each}
    </nav>
  </aside>

  <main class="settings-content">
    {@render children()}
  </main>
</div>

<style>
  .settings-layout {
    display: flex;
    width: 100%;
    min-height: calc(100vh - 60px);
  }

  .settings-sidebar {
    width: 200px;
    flex-shrink: 0;
    padding: 32px 0 32px 28px;
    border-right: 1px solid var(--border, #E8E4DC);
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .settings-title {
    font-family: var(--font-display);
    font-size: clamp(22px, 3vw, 30px);
    font-weight: 600;
    color: var(--ink, var(--text));
    line-height: 1.1;
    margin: 0;
    padding-right: 20px;
  }

  .settings-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .nav-link {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    color: var(--muted, #8E8880);
    text-decoration: none;
    padding: 8px 16px 8px 12px;
    border-radius: var(--radius-sm, 6px);
    transition: color 0.15s, background 0.15s;
    border-left: 2px solid transparent;
  }

  .nav-link:hover {
    color: var(--text, #2A2520);
    background: var(--bg2, #F0EDE6);
  }

  .nav-link.active {
    color: var(--accent, #7C3AED);
    font-weight: 500;
    border-left-color: var(--accent, #7C3AED);
    background: var(--accent-dim, rgba(124, 58, 237, 0.06));
  }

  .settings-content {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
  }

  @media (max-width: 768px) {
    .settings-layout {
      flex-direction: column;
    }

    .settings-sidebar {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--border, #E8E4DC);
      padding: 20px 16px 16px;
      gap: 16px;
    }

    .settings-nav {
      flex-direction: row;
      gap: 4px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 4px;
    }

    .nav-link {
      white-space: nowrap;
      border-left: none;
      border-bottom: 2px solid transparent;
      padding: 6px 12px;
      font-size: 12px;
    }

    .nav-link.active {
      border-left-color: transparent;
      border-bottom-color: var(--accent, #7C3AED);
    }

    .settings-content {
      overflow-y: visible;
    }
  }
</style>
