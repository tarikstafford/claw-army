<script lang="ts">
  import '../../app.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { connectWebSocket, subscribeWS, type LiveEvent } from '$lib/ws';
  import { addToast, removeToast, getToasts, type Toast } from '$lib/toast-store';

  let { children, data } = $props();
  let session = $derived(data.session);
  let companyId = $derived(data.companyId);

  // ── Toast notifications from store ──────────────────────────────
  let storeToasts = $derived(getToasts());

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

      // Heartbeat run status changes — show run status toasts
      if (event.type === 'heartbeat.run.status') {
        const payload = event.payload as Record<string, unknown>;
        const status = String(payload.status ?? '');
        const runId = String(payload.runId ?? '');
        if (status && runId) {
          addToast(`Run ${status}${runId ? ` (${runId.slice(0, 8)})` : ''}`, 'execution');
        }
      }

      // Budget threshold alerts
      if (event.type === 'budget.exceeded') {
        addToast('Budget exceeded! Consider adjusting your spending limits.', 'warning');
      }
      if (event.type === 'budget.threshold.50') {
        addToast('You\'ve reached 50% of your budget', 'info');
      }
      if (event.type === 'budget.threshold.75') {
        addToast('You\'ve reached 75% of your budget', 'warning');
      }
      if (event.type === 'budget.threshold.90') {
        addToast('You\'ve reached 90% of your budget', 'danger');
      }
    });

    return () => {
      cleanup?.();
      unsub();
    };
  });
</script>

{#if wsDisconnectVisible}
  <div class="ws-banner">Connection lost - reconnecting...</div>
{/if}

{#if storeToasts.length > 0}
  <div class="toast-container">
    {#each storeToasts as notif (notif.id)}
      <div class="toast toast-{notif.type}">
        <span class="toast-text">{notif.text}</span>
        {#if notif.retry}
          <button class="toast-retry" onclick={notif.retry} aria-label="Retry">Retry</button>
        {/if}
        <button class="toast-dismiss" onclick={() => removeToast(notif.id)} aria-label="Dismiss">×</button>
      </div>
    {/each}
  </div>
{/if}

<main class="main-content" id="main-content">
  {@render children()}
</main>

<style>
  /* ── Main content ──────────────────────────────────── */
  .main-content {
    position: relative;
    z-index: 2;
    padding-top: 104px;
  }

  /* ── WS disconnect banner ─────────────────────────── */
  .ws-banner {
    position: fixed;
    top: 92px;
    left: 0;
    right: 0;
    z-index: 500;
    background: var(--fo-gold, #B8860B);
    color: white;
    font-family: var(--font-body, 'DM Sans', sans-serif);
    font-size: 13px;
    text-align: center;
    padding: 6px;
    transition: opacity 0.2s ease;
  }

  /* ── Toast container ──────────────────────────────── */
  .toast-container {
    position: fixed;
    top: 104px;
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
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md, 10px);
    padding: 12px 14px;
    animation: slideIn 0.25s ease-out;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    pointer-events: all;
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

  .toast-success { border-color: var(--accent-teal); }
  .toast-error { border-color: var(--error, #DC2626); }
  .toast-warning { border-color: var(--fo-gold, #B8965A); }
  .toast-info { border-color: var(--accent); }
  .toast-chat { border-color: var(--accent-teal); }
  .toast-execution { border-color: var(--karma); }
  .toast-danger { border-color: var(--error, #DC2626); }

  .toast-success .toast-text { color: var(--accent-teal); }
  .toast-error .toast-text { color: var(--error, #DC2626); }
  .toast-warning .toast-text { color: var(--fo-gold, #B8965A); }
  .toast-chat .toast-text { color: var(--accent-teal); }
  .toast-execution .toast-text { color: var(--karma); }
  .toast-danger .toast-text { color: var(--error, #DC2626); }

  .toast-retry {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted, #6B6260);
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 4px;
    font-family: var(--font-body, 'DM Sans', sans-serif);
    font-size: 11px;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .toast-retry:hover {
    border-color: var(--text-muted, #6B6260);
    color: var(--text-muted, #6B6260);
  }
</style>
