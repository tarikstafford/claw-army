<script lang="ts">
  import '../../app.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import NavBar from '$lib/components/NavBar.svelte';
  import { connectWebSocket, subscribeWS, type LiveEvent } from '$lib/ws';

  let { children, data } = $props();
  let session = $derived(data.session);
  let companyId = $derived(data.companyId);

  // ── Toast notification system ──────────────────────────────────
  let notifications = $state<Array<{ id: string; type: string; text: string }>>([]);

  function addToast(text: string, type: string = 'info') {
    const id = crypto.randomUUID().slice(0, 8);
    notifications = [{ id, type, text }, ...notifications].slice(0, 5);
    setTimeout(() => {
      notifications = notifications.filter(n => n.id !== id);
    }, 4000);
  }

  function dismissToast(id: string) {
    notifications = notifications.filter(n => n.id !== id);
  }

  // ── WebSocket connection ───────────────────────────────────────
  let wsConnected = $state(false);
  let wsDisconnectVisible = $state(false);

  onMount(() => {
    if (!browser || !companyId) return;

    const cleanup = connectWebSocket(companyId);

    const unsub = subscribeWS((event: LiveEvent) => {
      wsConnected = true;
      wsDisconnectVisible = false;

      // Route events to toasts
      if (event.type === 'chat.message.created') {
        addToast('New message received', 'chat');
      }
      // Add more event type handlers as needed
    });

    return () => {
      cleanup?.();
      unsub();
    };
  });
</script>

<NavBar />

{#if wsDisconnectVisible}
  <div class="ws-banner">Connection lost - reconnecting...</div>
{/if}

{#if notifications.length > 0}
  <div class="toast-container">
    {#each notifications as notif (notif.id)}
      <div class="toast">
        <span class="toast-text">{notif.text}</span>
        <button class="toast-dismiss" onclick={() => dismissToast(notif.id)} aria-label="Dismiss">×</button>
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

  /* ── WS disconnect banner ─────────────────────────── */
  .ws-banner {
    position: fixed;
    top: 44px;
    left: 0;
    right: 0;
    z-index: 500;
    background: var(--fo-gold, #B8860B);
    color: #ffffff;
    font-family: var(--font-body, 'DM Sans', sans-serif);
    font-size: 13px;
    text-align: center;
    padding: 6px;
    transition: opacity 0.2s ease;
  }

  /* ── Toast container ──────────────────────────────── */
  .toast-container {
    position: fixed;
    top: 56px;
    right: 20px;
    z-index: 600;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: var(--fo-card, #FFFFFF);
    border: 1px solid var(--fo-border, #E8E4DC);
    border-radius: var(--radius-md, 10px);
    padding: 12px 14px;
    animation: slideIn 0.25s ease-out;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    pointer-events: all;
  }

  :global(body.back-office) .toast {
    background: var(--card);
    border-color: var(--border);
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(16px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  .toast-text {
    font-family: var(--font-body, 'DM Sans', sans-serif);
    font-size: 13px;
    font-weight: 400;
    color: var(--text-muted, #6B6260);
    line-height: 1.5;
    flex: 1;
    min-width: 0;
  }

  .toast-dismiss {
    background: none;
    border: none;
    color: var(--muted, #8A7E70);
    cursor: pointer;
    padding: 0;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
    transition: color 0.2s ease;
  }

  .toast-dismiss:hover { color: var(--text-muted, #6B6260); }
</style>
