<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import ToolBelt from '$lib/components/tools/ToolBelt.svelte';
  import Modal from '$lib/components/Modal.svelte';

  let { data } = $props();

  let disconnectTarget = $state<{ connectionId: string; toolName: string } | null>(null);
  let successBanner = $state<string | null>(null);
  let errorBanner = $state<string | null>(null);
  let testingConnectionId = $state<string | null>(null);

  onMount(() => {
    if (data.connected) {
      successBanner = `Connected to ${data.connected}`;
      setTimeout(() => { successBanner = null; }, 4000);
    }
    if (data.oauthError) {
      errorBanner = 'Connection failed. Check your account permissions and try again.';
      setTimeout(() => { errorBanner = null; }, 4000);
    }
  });

  function startOAuth(toolId: string) {
    window.location.href =
      '/api/akasa/tool-connections/oauth/' + toolId +
      '/start?userId=' + encodeURIComponent(data.userId) +
      '&redirectUri=' + encodeURIComponent(window.location.origin + '/api/akasa/tool-connections/oauth/' + toolId + '/callback');
  }

  async function handleTestConnection(connectionId: string) {
    testingConnectionId = connectionId;
    errorBanner = null;
    try {
      const res = await fetch(`/api/akasa/tool-connections/${connectionId}/test`, {
        method: 'POST',
      });
      const result = await res.json();
      if (result.success) {
        successBanner = 'Connection test successful';
        setTimeout(() => { successBanner = null; }, 4000);
      } else {
        errorBanner = `Connection test failed: ${result.error ?? 'Unknown error'}`;
        setTimeout(() => { errorBanner = null; }, 4000);
      }
    } catch {
      errorBanner = 'Failed to test connection. Please try again.';
      setTimeout(() => { errorBanner = null; }, 4000);
    } finally {
      testingConnectionId = null;
    }
  }

  async function handleDisconnect() {
    if (!disconnectTarget) return;
    try {
      const res = await fetch(`/api/akasa/tool-connections/${disconnectTarget.connectionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        disconnectTarget = null;
        await invalidateAll();
      } else {
        errorBanner = 'Failed to disconnect. Please try again.';
        setTimeout(() => { errorBanner = null; }, 4000);
        disconnectTarget = null;
      }
    } catch {
      errorBanner = 'Failed to disconnect. Please try again.';
      setTimeout(() => { errorBanner = null; }, 4000);
      disconnectTarget = null;
    }
  }
</script>

<div class="belt-page">
  {#if successBanner}
    <div class="banner banner-success">{successBanner}</div>
  {/if}
  {#if errorBanner}
    <div class="banner banner-error">{errorBanner}</div>
  {/if}

  <ToolBelt
    connections={data.connections}
    connectionStats={data.connectionStats}
    onstartOAuth={startOAuth}
    ondisconnect={(connId, name) => { disconnectTarget = { connectionId: connId, toolName: name }; }}
    ontestConnection={handleTestConnection}
  />
</div>

{#if disconnectTarget}
  <Modal
    open={true}
    title="Disconnect {disconnectTarget.toolName}?"
    onclose={() => { disconnectTarget = null; }}
  >
    <p>This will remove the connection. Any agents using this tool will lose access immediately.</p>
    <button class="disconnect-confirm-btn" onclick={handleDisconnect}>Disconnect Tool</button>
  </Modal>
{/if}

<style>
  .belt-page {
    padding: var(--space-2xl) var(--space-xl);
    position: relative;
  }

  .banner {
    margin-bottom: var(--space-lg);
    padding: var(--space-md) var(--space-lg);
    border-radius: var(--radius-md);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    background: var(--card);
    line-height: 1.5;
  }

  .banner-success {
    border: 1px solid var(--success, #2DD4BF);
    color: var(--success, #2DD4BF);
  }

  .banner-error {
    border: 1px solid var(--error);
    color: var(--error);
  }

  .disconnect-confirm-btn {
    min-height: 44px;
    border: 1px solid var(--error);
    color: var(--error);
    background: transparent;
    border-radius: var(--radius-md);
    font-family: var(--font-body);
    font-size: 13px;
    cursor: pointer;
    padding: 0 var(--space-lg);
    margin-top: var(--space-md);
    transition: background 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .disconnect-confirm-btn:hover {
    background: rgba(248, 113, 113, 0.08);
  }
</style>
