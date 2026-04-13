<script lang="ts">
  import { goto } from '$app/navigation';
  import Button from '$lib/components/ui/Button.svelte';
  import { authClient } from '$lib/auth-client';

  let {
    variant,
    pathname,
    session,
  }: {
    variant: 'marketing' | 'app';
    pathname: string;
    session: { user?: unknown } | null;
  } = $props();

  const tabs = [
    { href: '/indra', label: 'INDRA' },
    { href: '/office', label: 'OFFICE' },
    { href: '/chat', label: 'CHAT' },
    { href: '/sanctum', label: 'SANCTUM' },
    { href: '/tools', label: 'TOOLS' },
    { href: '/evolution', label: 'EVOLUTION' },
    { href: '/akashic', label: 'AKASHIC' },
    { href: '/skills', label: 'SKILLS' },
  ] as const;

  const showTabs = $derived(variant === 'app' && !!session?.user && !pathname.startsWith('/auth') && !pathname.startsWith('/onboarding'));

  function isActive(href: string) {
    return pathname.startsWith(href);
  }
</script>

<nav class={`nav-shell ${variant}`}>
  <div class="nav-frame">
    <a href={session?.user ? '/indra' : '/'} class="logo" aria-label="Akasa home">
      <div class="logo-mark">
        <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g class="lm-outer">
            <polygon points="17,3 31,17 17,31 3,17" stroke="currentColor" stroke-width="1" fill="none"/>
          </g>
          <g class="lm-inner">
            <polygon points="17,8 26,17 17,26 8,17" stroke="currentColor" stroke-width="1" fill="rgba(255,255,255,0.04)"/>
          </g>
          <circle class="lm-core" cx="17" cy="17" r="2.5" fill="currentColor"/>
        </svg>
      </div>
      <span class="logo-text">Akasa</span>
    </a>

    {#if showTabs}
      <div class="nav-tabs" aria-label="Primary navigation">
        {#each tabs as tab}
          <a href={tab.href} class="nav-tab" class:active={isActive(tab.href)}>
            {tab.label}
          </a>
        {/each}
      </div>
    {/if}

    <div class="nav-actions">
      {#if variant === 'marketing'}
        {#if session?.user}
          <Button href="/indra" variant="nav">Dashboard</Button>
        {:else}
          <Button href="/auth" variant="ghost" class="nav-action">Login</Button>
          <Button href="/#access" variant="nav">Request access</Button>
        {/if}
      {:else if session?.user && !pathname.startsWith('/onboarding')}
        <a href="/guide" class="guide-link" aria-label="Guide">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </a>
        <button
          class="sign-out-btn"
          type="button"
          aria-label="Sign out"
          onclick={async () => {
            await authClient.signOut();
            goto('/auth');
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>
</nav>

<style>
  .nav-shell {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
    padding: 18px 24px;
  }

  .nav-frame {
    max-width: 1240px;
    margin: 0 auto;
    min-height: 56px;
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 10px 16px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: color-mix(in srgb, var(--bg) 78%, transparent);
    backdrop-filter: blur(18px) saturate(1.2);
    box-shadow: 0 12px 30px rgba(14, 13, 11, 0.08);
    view-transition-name: app-nav;
  }

  .logo {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    color: var(--accent);
    text-decoration: none;
    flex-shrink: 0;
    view-transition-name: app-logo;
  }

  .logo-mark {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
  }

  .logo-mark svg {
    width: 34px;
    height: 34px;
    overflow: visible;
  }

  .logo-text {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text);
  }

  .nav-tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .nav-tab {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    padding: 0 12px;
    border-radius: 8px;
    color: var(--text-muted);
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.1em;
    text-decoration: none;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .nav-tab:hover {
    background: var(--bg2);
    color: var(--accent);
  }

  .nav-tab.active {
    background: var(--accent);
    color: #fff;
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  .nav-action {
    min-width: 88px;
  }

  .guide-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
    text-decoration: none;
    transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }

  .guide-link:hover {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--bg2);
  }

  .sign-out-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }

  .sign-out-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--bg2);
  }

  .marketing .nav-frame {
    background: rgba(245, 242, 236, 0.82);
  }

  :global(.lm-outer) {
    animation: lm-spin 18s linear infinite;
    transform-origin: 17px 17px;
  }

  :global(.lm-inner) {
    animation: lm-spin-r 12s linear infinite;
    transform-origin: 17px 17px;
  }

  :global(.lm-core) {
    animation: lm-pulse 3s ease-in-out infinite;
  }

  @keyframes lm-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes lm-spin-r {
    from { transform: rotate(0deg); }
    to { transform: rotate(-360deg); }
  }

  @keyframes lm-pulse {
    0%, 100% { opacity: 1; r: 2.5; }
    50% { opacity: 0.6; r: 2; }
  }

  @media (max-width: 900px) {
    .nav-frame {
      flex-wrap: wrap;
    }

    .nav-tabs {
      order: 3;
      width: 100%;
      overflow-x: auto;
      padding-top: 4px;
    }
  }
</style>
