<script lang="ts" module>
  const PARTICLE_COLS = [
    'rgba(124,58,237,',
    'rgba(167,139,250,',
    'rgba(196,181,253,',
    'rgba(251,191,36,',
    'rgba(45,212,191,',
  ];

  // Defined at module scope to avoid Svelte's nested-class perf warning
  class Particle {
    x: number; y: number; vx: number; vy: number;
    r: number; alpha: number; maxA: number;
    life: number; maxL: number; col: string;
    W: number; H: number;
    ctx: CanvasRenderingContext2D;

    constructor(W: number, H: number, ctx: CanvasRenderingContext2D, init: boolean) {
      this.W = W; this.H = H; this.ctx = ctx;
      this.x = Math.random() * W;
      this.y = init ? Math.random() * H : H + 10;
      this.vy = -(0.10 + Math.random() * 0.22);
      this.vx = (Math.random() - 0.5) * 0.14;
      this.r = 0.5 + Math.random() * 1.6;
      this.alpha = 0;
      this.maxA = 0.12 + Math.random() * 0.22;
      this.life = 0;
      this.maxL = 200 + Math.random() * 260;
      this.col = PARTICLE_COLS[Math.floor(Math.random() * PARTICLE_COLS.length)];
    }

    update(W: number, H: number) { this.W = W; this.H = H; }

    tick() {
      this.life++; this.x += this.vx; this.y += this.vy;
      const t = this.life / this.maxL;
      if (t < 0.12)      this.alpha = (t / 0.12) * this.maxA;
      else if (t > 0.75) this.alpha = ((1 - t) / 0.25) * this.maxA;
      else               this.alpha = this.maxA;
      if (this.life > this.maxL) {
        this.life = 0; this.x = Math.random() * this.W;
        this.y = this.H + 10; this.alpha = 0;
      }
    }

    draw() {
      this.ctx.beginPath();
      this.ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      this.ctx.fillStyle = this.col + this.alpha + ')';
      this.ctx.fill();
    }
  }
</script>

<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { signOut } from '@auth/sveltekit/client';
  import { browser } from '$app/environment';
  import { connectLifecycleSSE } from '$lib/sse';
  import type { LifecycleNotification } from '$lib/types';

  let { children, data } = $props();
  let session = $derived(data.session);
  let navEl: HTMLElement | null = null;

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
      case 'soul_promoted':    return 'var(--teal)';
      case 'soul_demoted':     return 'var(--amber)';
      case 'soul_retired':     return 'var(--rose)';
      case 'pioneer_detected': return 'var(--amber)';
    }
  }

  onMount(() => {
    const onScroll = () => navEl?.classList.toggle('stuck', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });

    // Particles
    const canvas = document.getElementById('particles') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0;

    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      particles.forEach(p => p.update(W, H));
    };
    window.addEventListener('resize', onResize, { passive: true });
    onResize();

    const particles = Array.from({ length: 130 }, (_, i) => new Particle(W, H, ctx, i < 80));
    let raf: number;

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => { p.tick(); p.draw(); });
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  });
</script>

<canvas id="particles"></canvas>

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

      <ul class="nav-links">
        <li><a href="/guide">Guide</a></li>
        <li><a href="/verdicts">Verdicts</a></li>
        <li><a href="/billing">Billing</a></li>
      </ul>

      <div class="nav-right">
        <div class="status-pill">
          <span class="live-dot"></span>Platform live
        </div>
        {#if session?.user}
          <button class="btn-nav" onclick={() => signOut({ redirectTo: '/' })}>Sign out</button>
        {:else}
          <a href="#access" class="btn-nav">Request access</a>
        {/if}
      </div>

    </div>
  </div>
</nav>

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

<main>
  {@render children()}
</main>

<style>
  :global(canvas#particles) {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 1;
  }

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

  .nav-links {
    display: flex; gap: 40px; list-style: none;
  }

  .nav-links a {
    color: var(--text-muted); text-decoration: none;
    font-size: 13.5px; font-weight: 400; letter-spacing: 0.01em;
    transition: color 0.2s;
  }

  .nav-links a:hover { color: var(--violet-light); }

  .nav-right { display: flex; align-items: center; gap: 20px; }

  .status-pill {
    display: flex; align-items: center; gap: 7px;
    font-family: var(--font-mono); font-size: 10.5px;
    color: var(--text-faint); letter-spacing: 0.07em;
  }

  main { position: relative; z-index: 2; }

  @media (max-width: 960px) {
    .nav-links { display: none; }
  }

  /* ── Lifecycle toasts ─────────────────────────── */
  .lifecycle-toasts {
    position: fixed;
    top: 80px;
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
    background: var(--bg-card);
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
    color: var(--text-faint);
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
    color: var(--text-faint);
    cursor: pointer;
    padding: 0;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
    transition: color 0.2s;
  }

  .toast-dismiss:hover { color: var(--text-muted); }
</style>
