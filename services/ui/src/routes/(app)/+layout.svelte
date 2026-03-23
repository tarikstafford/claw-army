<script lang="ts">
  import '../../app.css';
  import { onMount } from 'svelte';
  import { signOut } from '@auth/sveltekit/client';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { connectLifecycleSSE } from '$lib/sse';
  import type { LifecycleNotification } from '$lib/types';
  import ParticleCanvas from '$lib/components/ParticleCanvas.svelte';

  let { children, data } = $props();
  let session = $derived(data.session);

  // ── Sidebar state ──────────────────────────────────────────────
  let sidebarOpen = $state(false);

  function isActive(href: string): boolean {
    const path = $page.url.pathname;
    if (href === '/dashboard') return path === '/dashboard' || path === '/';
    return path.startsWith(href);
  }

  // Close sidebar on navigation (mobile)
  $effect(() => {
    $page.url.pathname;
    sidebarOpen = false;
  });

  // ── Lifecycle notification toasts ──────────────────────────────
  let notifications = $state<(LifecycleNotification & { id: string })[]>([]);

  function addNotification(event: LifecycleNotification) {
    const id = crypto.randomUUID().slice(0, 8);
    notifications = [{ ...event, id }, ...notifications].slice(0, 5);
    setTimeout(() => {
      notifications = notifications.filter(n => n.id !== id);
    }, 8000);
  }

  $effect(() => {
    if (!browser) return;
    const cleanup = connectLifecycleSSE(addNotification);
    return () => cleanup?.();
  });

  function dismissNotification(id: string) {
    notifications = notifications.filter(n => n.id !== id);
  }

  function getNotificationIcon(type: LifecycleNotification['type']): string {
    switch (type) {
      case 'soul_promoted':   return 'UP';
      case 'soul_demoted':    return 'DN';
      case 'soul_retired':    return 'RT';
      case 'pioneer_detected': return 'P1';
    }
  }

  function getNotificationColor(type: LifecycleNotification['type']): string {
    switch (type) {
      case 'soul_promoted':    return 'var(--bo-teal)';
      case 'soul_demoted':     return 'var(--karma)';
      case 'soul_retired':     return 'var(--bo-rose)';
      case 'pioneer_detected': return 'var(--karma)';
    }
  }
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap" />
</svelte:head>

<ParticleCanvas />

<aside class="sidebar" class:open={sidebarOpen}>
  <a href="/dashboard" class="sidebar-logo">
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

  {#if session?.user}
    <a href="/new-execution" class="btn-deploy">Deploy crew</a>
  {/if}

  <nav class="sidebar-nav">
    <div class="nav-group">
      <span class="nav-group-tag">OP</span>
      <a href="/dashboard" class="nav-link" class:active={isActive('/dashboard')}>Dashboard</a>
      <a href="/objectives" class="nav-link" class:active={isActive('/objectives')}>Objectives</a>
    </div>
    <div class="nav-group">
      <span class="nav-group-tag">IN</span>
      <a href="/verdicts" class="nav-link" class:active={isActive('/verdicts')}>Verdicts</a>
      <a href="/souls" class="nav-link" class:active={isActive('/souls')}>Souls</a>
      <a href="/billing" class="nav-link" class:active={isActive('/billing')}>Billing</a>
    </div>
    <div class="nav-group">
      <span class="nav-group-tag">RF</span>
      <a href="/guide" class="nav-link" class:active={isActive('/guide')}>Guide</a>
      <a href="/category-benchmarks" class="nav-link" class:active={isActive('/category-benchmarks')}>Benchmarks</a>
      <a href="/negative-signals" class="nav-link" class:active={isActive('/negative-signals')}>Signals</a>
    </div>
  </nav>

  <div class="sidebar-footer">
    <div class="status-pill">
      <span class="live-dot"></span>Platform live
    </div>
    {#if session?.user}
      <span class="user-email">{session.user.email ?? ''}</span>
      <button class="btn-signout" onclick={() => signOut({ redirectTo: '/' })}>Sign out</button>
    {/if}
  </div>
</aside>

{#if sidebarOpen}
  <button class="sidebar-backdrop" onclick={() => sidebarOpen = false} aria-label="Close sidebar"></button>
{/if}

<button class="hamburger" onclick={() => sidebarOpen = !sidebarOpen} aria-label="Toggle navigation">
  <span class="hamburger-bar"></span>
  <span class="hamburger-bar"></span>
  <span class="hamburger-bar"></span>
</button>

{#if notifications.length > 0}
  <div class="lifecycle-toasts">
    {#each notifications as notif (notif.id)}
      <div class="lifecycle-toast" style="border-left-color: {getNotificationColor(notif.type)}">
        <span class="toast-icon" style="color: {getNotificationColor(notif.type)}">{getNotificationIcon(notif.type)}</span>
        <div class="toast-content">
          <span class="toast-type">{notif.type.replace(/_/g, ' ')}</span>
          <span class="toast-desc">{notif.description}</span>
        </div>
        <button class="toast-dismiss" onclick={() => dismissNotification(notif.id)} aria-label="Dismiss">×</button>
      </div>
    {/each}
  </div>
{/if}

<main class="main-content">
  {@render children()}
</main>

<style>
  /* ── Sidebar ──────────────────────────────────────────── */
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 220px;
    z-index: 500;
    background: var(--bg);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 24px 16px 20px;
    overflow-y: auto;
  }

  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    margin-bottom: 24px;
    padding: 0 4px;
  }

  .logo-mark {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    position: relative;
    flex-shrink: 0;
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
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text);
  }

  .btn-deploy {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 1rem;
    background: var(--accent);
    color: white;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    text-decoration: none;
    transition: background 0.15s;
    margin-bottom: 20px;
  }

  .btn-deploy:hover { background: var(--accent-m); }

  /* ── Nav groups ─────────────────────────────────────── */
  .sidebar-nav {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .nav-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .nav-group-tag {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--bo-faint);
    padding: 0 8px;
    margin-bottom: 4px;
  }

  .nav-link {
    display: block;
    padding: 7px 10px;
    border-left: 2px solid transparent;
    border-radius: 0 6px 6px 0;
    font-size: 13.5px;
    font-weight: 400;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.15s, background 0.15s, border-color 0.15s;
  }

  .nav-link:hover {
    color: var(--text);
    background: rgba(124,58,237,0.06);
  }

  .nav-link.active {
    border-left-color: var(--accent-m);
    background: var(--accent-dim);
    color: var(--text);
    font-weight: 500;
  }

  /* ── Sidebar footer ────────────────────────────────── */
  .sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .status-pill {
    display: flex;
    align-items: center;
    gap: 7px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--bo-faint);
    letter-spacing: 0.07em;
  }

  .user-email {
    font-size: 11px;
    color: var(--bo-faint);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-signout {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--bo-faint);
    font-size: 12px;
    font-weight: 400;
    font-family: var(--font-body);
    padding: 4px 0;
    text-align: left;
    transition: color 0.2s;
  }

  .btn-signout:hover { color: var(--text-muted); }

  /* ── Main content ──────────────────────────────────── */
  .main-content {
    position: relative;
    z-index: 2;
    margin-left: 220px;
  }

  /* ── Hamburger (mobile only) ───────────────────────── */
  .hamburger {
    display: none;
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 600;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
    cursor: pointer;
    flex-direction: column;
    gap: 4px;
  }

  .hamburger-bar {
    display: block;
    width: 18px;
    height: 2px;
    background: var(--text-muted);
    border-radius: 1px;
  }

  .sidebar-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 490;
    background: rgba(0,0,0,0.5);
    border: none;
    cursor: default;
  }

  /* ── Mobile ────────────────────────────────────────── */
  @media (max-width: 960px) {
    .sidebar {
      transform: translateX(-100%);
      transition: transform 0.25s cubic-bezier(0.16,1,0.3,1);
    }

    .sidebar.open {
      transform: translateX(0);
    }

    .hamburger {
      display: flex;
    }

    .sidebar-backdrop {
      display: block;
    }

    .main-content {
      margin-left: 0;
    }
  }

  /* ── Lifecycle toasts ─────────────────────────────── */
  .lifecycle-toasts {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 600;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 360px;
    pointer-events: none;
  }

  .lifecycle-toast {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: var(--card);
    border: 1px solid var(--border);
    border-left-width: 3px;
    border-radius: 10px;
    padding: 12px 14px;
    animation: slideIn 0.25s cubic-bezier(0.16,1,0.3,1);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    pointer-events: all;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(16px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  .toast-icon {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    letter-spacing: 0.08em;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .toast-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }

  .toast-type {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--bo-faint);
  }

  .toast-desc {
    font-size: 13px;
    font-weight: 300;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .toast-dismiss {
    background: none;
    border: none;
    color: var(--bo-faint);
    cursor: pointer;
    padding: 0;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
    transition: color 0.2s;
  }

  .toast-dismiss:hover { color: var(--text-muted); }

  /* ── Logo animations ──────────────────────────────── */
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
