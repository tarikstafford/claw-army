<script lang="ts">
  import '../app.css';
  import { signOut } from '@auth/sveltekit/client';
  import { browser } from '$app/environment';
  import { connectLifecycleSSE } from '$lib/sse';
  import type { LifecycleNotification } from '$lib/types';

  let { children, data } = $props();
  let session = $derived(data.session);

  let notifications = $state<(LifecycleNotification & { id: string })[]>([]);

  function addNotification(event: LifecycleNotification) {
    const id = crypto.randomUUID().slice(0, 8);
    notifications = [{ ...event, id }, ...notifications].slice(0, 5);
    // Auto-dismiss after 8 seconds
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
      case 'soul_promoted': return 'UP';
      case 'soul_demoted': return 'DN';
      case 'soul_retired': return 'RT';
      case 'pioneer_detected': return 'P1';
    }
  }

  function getNotificationColor(type: LifecycleNotification['type']): string {
    switch (type) {
      case 'soul_promoted': return '#4ade80';
      case 'soul_demoted': return '#fb923c';
      case 'soul_retired': return '#f87171';
      case 'pioneer_detected': return '#fbbf24';
    }
  }
</script>

<nav>
  <div class="nav-inner">
    <a href="/" class="brand">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 1.5L17.5 5.75V14.25L10 18.5L2.5 14.25V5.75L10 1.5Z"
          stroke="#3d7eff" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
        <circle cx="10" cy="10" r="3" fill="#3d7eff"/>
      </svg>
      <span>Claw Army</span>
    </a>
    <div class="nav-right">
      <a href="/guide" class="nav-link">Guide</a>
      <a href="/verdicts" class="nav-link">Verdicts</a>
      <a href="/billing" class="nav-link">Billing</a>
      {#if session?.user}
        <div class="user-info">
          {#if session.user.image}
            <img
              src={session.user.image}
              alt={session.user.name ?? 'User avatar'}
              class="user-avatar"
              width="28"
              height="28"
            />
          {/if}
          <span class="user-name">{session.user.name}</span>
          <button class="sign-out-btn" onclick={() => signOut({ redirectTo: '/' })}>
            Sign out
          </button>
        </div>
      {:else}
        <a href="/new-execution" class="nav-cta">Deploy Crew</a>
      {/if}
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
        <button class="toast-dismiss" onclick={() => dismissNotification(notif.id)} aria-label="Dismiss">x</button>
      </div>
    {/each}
  </div>
{/if}

<main>
  {@render children()}
</main>

<style>
  nav {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(9, 13, 24, 0.92);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
  }

  .nav-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 var(--s-6);
    height: 52px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    color: var(--text-primary);
    font-weight: 700;
    font-size: 0.875rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .brand:hover {
    color: var(--text-primary);
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: var(--s-4);
  }

  .nav-link {
    font-size: 0.875rem;
    color: var(--text-secondary);
    transition: color 0.15s;
  }

  .nav-link:hover {
    color: var(--text-primary);
  }

  .nav-cta {
    padding: 0.375rem 0.875rem;
    background: var(--signal);
    color: #fff;
    font-size: 0.8125rem;
    font-weight: 600;
    border-radius: var(--r-sm);
    letter-spacing: 0.01em;
    transition: background 0.15s;
  }

  .nav-cta:hover {
    background: #5a8fff;
    color: #fff;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: var(--s-3);
  }

  .user-avatar {
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--border);
  }

  .user-name {
    font-size: 0.875rem;
    color: var(--text-secondary);
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sign-out-btn {
    font-size: 0.8125rem;
    color: var(--text-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
  }

  .sign-out-btn:hover {
    color: var(--text-secondary);
  }

  main {
    width: 100%;
    padding: var(--s-8) var(--s-6);
  }

  .lifecycle-toasts {
    position: fixed;
    top: 60px;
    right: 16px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 380px;
  }

  .lifecycle-toast {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: rgba(17, 24, 39, 0.95);
    border: 1px solid var(--border, #1f2937);
    border-left-width: 3px;
    border-radius: 6px;
    padding: 10px 12px;
    animation: slideIn 0.25s ease-out;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .toast-icon {
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .toast-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .toast-type {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary, #9ca3af);
  }

  .toast-desc {
    font-size: 0.8125rem;
    color: var(--text-primary, #f9fafb);
    line-height: 1.4;
  }

  .toast-dismiss {
    background: none;
    border: none;
    color: var(--text-muted, #6b7280);
    cursor: pointer;
    padding: 0;
    font-size: 0.875rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .toast-dismiss:hover {
    color: var(--text-secondary, #9ca3af);
  }
</style>
