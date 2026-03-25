<script lang="ts">
  import { TOOL_CATALOG } from '$lib/tool-catalog';
  import StatusBadge from './StatusBadge.svelte';

  let {
    connections,
    onstartOAuth,
    ondisconnect,
  }: {
    connections: Array<{ id: string; toolId: string; status: string; displayLabel?: string; lastUsedAt: string | null }>;
    onstartOAuth: (toolId: string) => void;
    ondisconnect: (connectionId: string, toolName: string) => void;
  } = $props();

  const activeConnections = $derived(connections.filter(c => c.status !== 'disconnected'));

  function formatLastUsed(ts: string | null): string {
    if (!ts) return '--';
    try {
      return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
    } catch {
      return '--';
    }
  }

  function getToolName(toolId: string): string {
    return TOOL_CATALOG.find(t => t.id === toolId)?.name ?? toolId;
  }
</script>

{#if activeConnections.length === 0}
  <div class="empty-state">
    <h3 class="empty-heading">No tools connected</h3>
    <p class="empty-body">Connect a tool from the Catalog to give your agents access to external services.</p>
  </div>
{:else}
  <div class="belt-list">
    {#each activeConnections as conn (conn.id)}
      <div class="belt-row">
        <div class="belt-left">
          <span class="tool-name">{getToolName(conn.toolId)}</span>
          {#if conn.displayLabel}
            <span class="tool-label">{conn.displayLabel}</span>
          {/if}
          <span class="tool-last-used">Last used: {formatLastUsed(conn.lastUsedAt)}</span>
        </div>
        <div class="belt-right">
          <StatusBadge status={conn.status} />
          {#if conn.status === 'expired'}
            <button
              class="btn btn-reauth"
              onclick={() => onstartOAuth(conn.toolId)}
            >
              Re-authorise
            </button>
          {:else if conn.status === 'connected'}
            <button
              class="btn btn-disconnect"
              onclick={() => ondisconnect(conn.id, getToolName(conn.toolId))}
            >
              Disconnect Tool
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .empty-state {
    padding: var(--space-2xl) 0;
    text-align: center;
  }

  .empty-heading {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    color: var(--bo-text);
    margin: 0 0 var(--space-sm) 0;
  }

  .empty-body {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    color: var(--bo-muted);
    margin: 0;
    line-height: 1.5;
  }

  .belt-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .belt-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    gap: var(--space-md);
  }

  .belt-left {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .tool-name {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    color: var(--bo-text);
  }

  .tool-label {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 400;
    color: var(--bo-caption);
  }

  .tool-last-used {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 400;
    color: var(--bo-caption);
  }

  .belt-right {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-shrink: 0;
  }

  .btn {
    min-height: 44px;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    background: transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    padding: 0 var(--space-md);
    white-space: nowrap;
    transition: background 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-reauth {
    border: 1px solid var(--bo-rose);
    color: var(--bo-rose);
  }

  .btn-reauth:hover {
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
