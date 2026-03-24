<script lang="ts">
  import '../../app.css';
  import ParticleCanvas from '$lib/components/ParticleCanvas.svelte';

  let { children, data } = $props();
  let session = $derived(data.session);
  let navEl: HTMLElement | null = null;

  import { onMount } from 'svelte';

  onMount(() => {
    const onScroll = () => navEl?.classList.toggle('stuck', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap" />
</svelte:head>

<ParticleCanvas />

<nav id="nav" bind:this={navEl}>
  <div class="w">
    <div class="nav-row">

      <a href="/" class="logo">
        <div class="logo-mark">
          <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="lm-glow">
                <feGaussianBlur stdDeviation="1.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <g class="lm-outer">
              <polygon points="17,3 31,17 17,31 3,17" stroke="rgba(167,139,250,0.5)" stroke-width="1" fill="none"/>
            </g>
            <g class="lm-inner">
              <polygon points="17,8 26,17 17,26 8,17" stroke="rgba(167,139,250,0.35)" stroke-width="1" fill="rgba(124,58,237,0.08)"/>
            </g>
            <circle class="lm-core" cx="17" cy="17" r="2.5" fill="#a78bfa"/>
          </svg>
        </div>
        <span class="logo-text">Akasa</span>
      </a>

      <div class="nav-right">
        {#if session?.user}
          <a href="/indra" class="btn-nav btn-primary">Dashboard</a>
        {:else}
          <a href="/auth" class="btn-nav">Login</a>
          <a href="#access" class="btn-nav btn-primary">Sign up</a>
        {/if}
      </div>

    </div>
  </div>
</nav>

<main>
  {@render children()}
</main>

<style>
  nav {
    position: fixed; top: 0; left: 0; right: 0;
    z-index: 500; padding: 24px 0;
    transition: background 0.5s, border-color 0.5s;
  }

  :global(#nav.stuck) {
    background: rgba(7,6,15,0.92);
    backdrop-filter: blur(20px) saturate(1.6);
    border-bottom: 1px solid var(--border);
  }

  .nav-row {
    display: flex; align-items: center; justify-content: space-between;
  }

  .logo {
    display: flex; align-items: center; gap: 12px;
    text-decoration: none;
  }

  .logo-mark {
    width: 34px; height: 34px;
    display: grid; place-items: center;
    position: relative; flex-shrink: 0;
  }

  .logo-mark svg { width: 34px; height: 34px; overflow: visible; }

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

  .logo-text {
    font-family: var(--font-display); font-size: 20px;
    font-weight: 600; letter-spacing: -0.01em; color: var(--text);
  }

  .nav-right { display: flex; align-items: center; gap: 14px; }

  .btn-nav {
    display: inline-flex; align-items: center;
    padding: 0.45rem 1rem;
    font-size: 13px; font-weight: 500;
    border-radius: 8px;
    text-decoration: none;
    color: var(--text-muted);
    transition: color 0.2s;
  }

  .btn-nav:hover { color: var(--text); }

  .btn-primary {
    background: var(--accent);
    color: white !important;
    font-weight: 600;
    transition: background 0.15s;
  }

  .btn-primary:hover { background: var(--accent-m); }

  main { position: relative; z-index: 2; }

  @keyframes lm-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  @keyframes lm-spin-r {
    from { transform: rotate(0deg); }
    to   { transform: rotate(-360deg); }
  }

  @keyframes lm-pulse {
    0%, 100% { opacity: 1; r: 2.5; }
    50%       { opacity: 0.6; r: 2; }
  }
</style>
