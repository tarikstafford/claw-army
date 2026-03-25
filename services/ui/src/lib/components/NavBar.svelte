<script lang="ts">
  import { page } from '$app/stores';
  import { toggleMode, getMode } from '$lib/mode';
  import { browser } from '$app/environment';

  let { activeTab }: { activeTab?: 'indra' | 'office' | 'chat' | 'sanctum' | 'tools' } = $props();

  let currentMode = $state<'front-office' | 'back-office'>('front-office');

  $effect(() => {
    if (!browser) return;
    currentMode = getMode();
  });

  const tabs = [
    { href: '/indra',   label: 'INDRA',   key: 'indra' },
    { href: '/office',  label: 'OFFICE',  key: 'office' },
    { href: '/chat',    label: 'CHAT',    key: 'chat' },
    { href: '/sanctum', label: 'SANCTUM', key: 'sanctum' },
    { href: '/tools',   label: 'TOOLS',   key: 'tools' },
  ] as const;

  function isActive(href: string, key: string): boolean {
    if (activeTab) return activeTab === key;
    return $page.url.pathname.startsWith(href);
  }

  function handleToggle(mode: 'front-office' | 'back-office') {
    if (currentMode !== mode) {
      currentMode = toggleMode();
    }
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
    <div class="mode-toggle">
      <button
        class="mode-btn"
        class:active={currentMode === 'front-office'}
        onclick={() => handleToggle('front-office')}
      >FRONT OFFICE</button>
      <button
        class="mode-btn"
        class:active={currentMode === 'back-office'}
        onclick={() => handleToggle('back-office')}
      >BACK OFFICE</button>
    </div>
  </div>
</nav>

<style>
  /* ── NavBar shell ──────────────────────────────── */
  .navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(245, 242, 236, 0.85);
    border-bottom: 1px solid var(--fo-rule);
  }

  :global(body.back-office) .navbar {
    background: rgba(6, 5, 14, 0.85);
    border-bottom: 1px solid var(--bo-border);
  }

  /* ── Left region ───────────────────────────────── */
  .navbar-left {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  /* ── Logo ──────────────────────────────────────── */
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    flex-shrink: 0;
  }

  .logo-gem {
    display: inline-block;
    width: 10px;
    height: 10px;
    background: var(--fo-gold);
    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
    animation: gem-spin 5s linear infinite;
    flex-shrink: 0;
  }

  :global(body.back-office) .logo-gem {
    background: var(--bo-amber);
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
    color: var(--fo-plum);
  }

  :global(body.back-office) .logo-text {
    color: var(--bo-vb);
  }

  /* ── Nav tabs ──────────────────────────────────── */
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
    color: var(--muted);
    background: transparent;
  }

  .nav-tab:hover {
    color: var(--fo-plum);
    background: var(--fo-bg2);
  }

  .nav-tab.active {
    color: #fff;
    background: var(--fo-plum);
  }

  :global(body.back-office) .nav-tab {
    color: var(--bo-faint);
    background: transparent;
  }

  :global(body.back-office) .nav-tab:hover {
    color: var(--bo-text);
    background: rgba(124, 58, 237, 0.10);
  }

  :global(body.back-office) .nav-tab.active {
    color: #fff;
    background: var(--bo-violet);
  }

  /* ── Right region ──────────────────────────────── */
  .navbar-right {
    display: flex;
    align-items: center;
  }

  /* ── Mode toggle ───────────────────────────────── */
  .mode-toggle {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .mode-btn {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.05em;
    padding: 4px 8px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.2s;
    background: transparent;
    color: var(--text-muted);
  }

  .mode-btn.active {
    background: var(--fo-plum);
    color: #fff;
  }

  :global(body.back-office) .mode-btn {
    color: var(--text-muted);
    background: transparent;
  }

  :global(body.back-office) .mode-btn.active {
    background: var(--bo-violet);
    color: #fff;
  }
</style>
