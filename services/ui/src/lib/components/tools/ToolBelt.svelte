<script lang="ts">
  import { TOOL_CATALOG } from '$lib/tool-catalog';
  import StatusBadge from './StatusBadge.svelte';

  let {
    connections,
    onstartOAuth,
    ondisconnect,
    analytics = {},
  }: {
    connections: Array<{ id: string; toolId: string; status: string; displayLabel?: string; lastUsedAt: string | null }>;
    onstartOAuth: (toolId: string) => void;
    ondisconnect: (connectionId: string, toolName: string) => void;
    analytics?: Record<string, { callCount: number; avgLatencyMs: number | null; errorCount: number; lastSuccessAt: string | null }>;
  } = $props();

  let testingConnection: string | null = $state(null);
  let testResults: Record<string, { success: boolean; message: string }> = $state({});

  const activeConnections = $derived(connections.filter(c => c.status !== 'disconnected'));

  function formatLastUsed(ts: string | null): string {
    if (!ts) return '--';
    try {
      return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
    } catch {
      return '--';
    }
  }

  function formatLastSuccess(ts: string | null): string {
    if (!ts) return 'Never';
    try {
      return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
    } catch {
      return 'Never';
    }
  }

  function getToolName(toolId: string): string {
    return TOOL_CATALOG.find(t => t.id === toolId)?.name ?? toolId;
  }

  async function handleTestConnection(connectionId: string) {
    testingConnection = connectionId;
    testResults[connectionId] = { success: false, message: 'Testing...' };

    try {
      const res = await fetch(`/api/akasa/tool-connections/${connectionId}/test`, {
        method: 'POST',
      });
      const result = await res.json();
      testResults[connectionId] = {
        success: result.success,
        message: result.success ? 'Connection OK' : (result.error ?? 'Test failed'),
      };
    } catch {
      testResults[connectionId] = { success: false, message: 'Network error' };
    } finally {
      testingConnection = null;
    }
  }

  function getAnalytics(connId: string) {
    return analytics[connId] ?? { callCount: 0, avgLatencyMs: null, errorCount: 0, lastSuccessAt: null };
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
      {@const stats = getAnalytics(conn.id)}
      {@const testResult = testResults[conn.id]}
      <div class="belt-row">
        <div class="belt-left">
          <span class="tool-name">{getToolName(conn.toolId)}</span>
          {#if conn.displayLabel}
            <span class="tool-label">{conn.displayLabel}</span>
          {/if}
          <div class="tool-stats">
            <span class="tool-stat">
              <span class="stat-label">Calls:</span>
              <span class="stat-value">{stats.callCount}</span>
            </span>
            {#if stats.avgLatencyMs !== null}
              <span class="tool-stat">
                <span class="stat-label">Avg:</span>
                <span class="stat-value">{stats.avgLatencyMs}ms</span>
              </span>
            {/if}
            {#if stats.errorCount > 0}
              <span class="tool-stat error-stat">
                <span class="stat-label">Errors:</span>
                <span class="stat-value">{stats.errorCount}</span>
              </span>
            {/if}
          </div>
          <span class="tool-last-success">
            Last success: {formatLastSuccess(stats.lastSuccessAt)}
          </span>
        </div>
        <div class="belt-right">
          <StatusBadge status={conn.status} />
          {#if testResult}
            <span class="test-result" class:success={testResult.success} class:failed={!testResult.success}>
              {testResult.message}
            </span>
          {/if}
          {#if conn.status === 'connected'}
            <button
              class="btn btn-test"
              onclick={() => { handleTestConnection(conn.id); }}
              disabled={testingConnection === conn.id}
            >
              {testingConnection === conn.id ? 'Testing...' : 'Test Connection'}
            </button>
          {/if}
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
              Disconnect
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
    color: var(--text);
    margin: 0 0 var(--space-sm) 0;
  }

  .empty-body {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    color: var(--text-muted);
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
    background: var(--card);
    border: 1px solid var(--border);
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
    font-weight: 500;
    color: var(--text);
  }

  .tool-label {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted);
  }

  .tool-stats {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-top: var(--space-xs);
  }

  .tool-stat {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .stat-label {
    font-family: var(--font-label);
    font-size: 6px;
    color: var(--text-muted);
    letter-spacing: 0.08em;
  }

  .stat-value {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text);
  }

  .error-stat .stat-value {
    color: var(--error);
  }

  .tool-last-success {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .belt-right {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-shrink: 0;
  }

  .test-result {
    font-family: var(--font-body);
    font-size: 11px;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
  }

  .test-result.success {
    background: rgba(45, 212, 191, 0.10);
    color: var(--success);
  }

  .test-result.failed {
    background: rgba(248, 113, 113, 0.10);
    color: var(--error);
  }

  .btn {
    min-height: 36px;
    font-family: var(--font-body);
    font-size: 12px;
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

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-test {
    border: 1px solid var(--teal, #2DD4BF);
    color: var(--teal, #2DD4BF);
  }

  .btn-test:hover:not(:disabled) {
    background: rgba(45, 212, 191, 0.08);
  }

  .btn-reauth {
    border: 1px solid var(--rose, #F472B6);
    color: var(--rose, #F472B6);
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
