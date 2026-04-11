<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { toggleMode, getMode } from '$lib/mode';
  import { authClient } from '$lib/auth-client';
  import { browser } from '$app/environment';

  let { activeTab }: { activeTab?: 'indra' | 'office' | 'chat' | 'sanctum' | 'tools' | 'evolution' } = $props();

  let isDark = $state(false);

  $effect(() => {
    if (!browser) return;
    isDark = getMode() === 'back-office';
  });

  function handleToggle() {
    const newMode = toggleMode();
    isDark = newMode === 'back-office';
  }

  const tabs = [
    { href: '/indra',     label: 'INDRA',     key: 'indra' },
    { href: '/office',    label: 'OFFICE',    key: 'office' },
    { href: '/chat',      label: 'CHAT',      key: 'chat' },
    { href: '/sanctum',   label: 'SANCTUM',   key: 'sanctum' },
    { href: '/tools',     label: 'TOOLS',     key: 'tools' },
    { href: '/evolution', label: 'EVOLUTION', key: 'evolution' },
    { href: '/settings',  label: 'SETTINGS',  key: 'settings' },
  ] as const;

  function isActive(href: string, key: string): boolean {
    if (activeTab) return activeTab === key;
    return $page.url.pathname.startsWith(href);
  }
</script>

<nav class="navbar">
  <div class="navbar-left">
    <a href="/indra" class="logo">
      <span class="logo-gem"></span>
      <span class="logo-text">Akasa</span>
    </a>
    <div class="nav-tabs">
      {#each tabs as tab}
        <a href={tab.href} class="nav-tab" class:active={isActive(tab.href, tab.key)}>
          {tab.label}
        </a>
      {/each}
    </div>
  </div>
  <div class="navbar-right">
    <button
      class="theme-btn"
      type="button"
      onclick={handleToggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {#if isDark}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      {:else}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      {/if}
    </button>
    <button class="sign-out-btn" type="button" onclick={async () => {
      await authClient.signOut();
      goto('/auth');
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    </button>
  </div>
</nav>

<style>
  .navbar {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 9999;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(245, 242, 236, 0.85);
    border-bottom: 1px solid var(--border);
    transition: background 0.4s, border-color 0.4s;
  }

  :global(body.back-office) .navbar {
    background: rgba(6, 5, 14, 0.85);
  }

  .navbar-left {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    flex-shrink: 0;
  }

  .logo-gem {
    display: inline-block;
    width: 10px; height: 10px;
    background: var(--karma);
    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
    animation: gem-spin 5s linear infinite;
    flex-shrink: 0;
  }

  @keyframes gem-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  .logo-text {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--accent);
  }

  .nav-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .nav-tab {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.05em;
    text-decoration: none;
    padding: 6px 10px;
    border-radius: 4px;
    transition: all 0.2s;
    color: var(--text-muted);
    background: transparent;
  }

  .nav-tab:hover {
    color: var(--accent);
    background: var(--bg2);
  }

  .nav-tab.active {
    color: #fff;
    background: var(--accent);
  }

  .navbar-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .theme-btn, .sign-out-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px; height: 28px;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    background: transparent;
    color: var(--text-muted);
    transition: all 0.2s;
    padding: 0;
  }

  .theme-btn:hover, .sign-out-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
