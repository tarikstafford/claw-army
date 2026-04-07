<script lang="ts">
  import StatusBadge from './StatusBadge.svelte';

  let {
    tool,
    connection,
    onconnect,
    ondisconnect,
  }: {
    tool: { id: string; name: string; category: string; description: string; authType: string };
    connection: { id: string; status: string; lastUsedAt: string | null } | null;
    onconnect: (toolId: string) => void;
    ondisconnect: (connectionId: string, toolName: string) => void;
  } = $props();

  const isConnected = $derived(connection !== null && connection.status !== 'disconnected');
  const isExpired = $derived(connection !== null && connection.status === 'expired');
</script>

<div class="tool-card">
  {#if isConnected}
    <div class="badge-corner">
      <StatusBadge status={connection!.status} />
    </div>
  {/if}

  <span class="tool-category">{tool.category}</span>
  <h3 class="tool-name">{tool.name}</h3>
  <p class="tool-description">{tool.description}</p>

  <div class="tool-actions">
    {#if isExpired}
      <button
        class="btn btn-connect"
        onclick={() => onconnect(tool.id)}
      >
        Re-authorise
      </button>
    {:else if isConnected}
      <button
        class="btn btn-disconnect"
        onclick={() => ondisconnect(connection!.id, tool.name)}
      >
        Disconnect Tool
      </button>
    {:else}
      <button
        class="btn btn-connect"
        onclick={() => onconnect(tool.id)}
      >
        Connect Tool
      </button>
    {/if}
  </div>
</div>

<style>
  .tool-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    position: relative;
    transition: transform 0.15s ease, border-color 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .tool-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
  }

  .badge-corner {
    position: absolute;
    top: var(--space-md);
    right: var(--space-md);
  }

  .tool-category {
    font-family: var(--font-label);
    font-size: 7px;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: var(--space-sm);
    display: block;
  }

  .tool-name {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    color: var(--text);
    margin: 0;
  }

  .tool-description {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
    margin-top: var(--space-xs);
  }

  .tool-actions {
    margin-top: var(--space-md);
  }

  .btn {
    width: 100%;
    min-height: 44px;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    background: transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-connect {
    border: 1px solid var(--rose, #F472B6);
    color: var(--rose, #F472B6);
  }

  .btn-connect:hover {
    background: rgba(244, 114, 182, 0.08);
  }

  .btn-disconnect {
    border: 1px solid var(--error);
    color: var(--error);
  }

  .btn-disconnect:hover {
    background: rgba(248, 113, 113, 0.08);
  }
</style>
