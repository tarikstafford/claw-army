<script lang="ts">
  import '../../app.css';
  import { onMount } from 'svelte';
  import { signOut } from '@auth/sveltekit/client';
  import { browser } from '$app/environment';
  import { connectLifecycleSSE } from '$lib/sse';
  import type { LifecycleNotification } from '$lib/types';
  import NavBar from '$lib/components/NavBar.svelte';

  let { children, data } = $props();
  let session = $derived(data.session);

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

<NavBar />

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
  /* ── Main content ──────────────────────────────────── */
  .main-content {
    position: relative;
    z-index: 2;
    padding-top: 44px;
  }

  /* ── Lifecycle toasts ─────────────────────────────── */
  .lifecycle-toasts {
    position: fixed;
    top: 56px;
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
</style>
