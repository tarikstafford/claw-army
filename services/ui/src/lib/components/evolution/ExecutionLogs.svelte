<script lang="ts">
  type EventType = 'lifecycle' | 'task' | 'guardrail' | 'tool_call';
  type LogEntry = {
    id: string;
    timestamp: string;
    eventType: EventType;
    toolName: string | null;
    duration: number | null;
    tokenUsage: { prompt: number | null; completion: number | null; total: number | null };
    status: 'rejected' | 'success' | 'error' | 'pending';
    rejected: boolean;
    rejectionReason: string | null;
    requestSummary: unknown;
    responseSummary: unknown;
  };

  interface DetailStep {
    toolName: string;
    invocationId: string;
    rejected: boolean;
    rejectionReason: string | null;
    durationMs: number | null;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    requestSummary: unknown;
    responseSummary: unknown;
    invokedAt: string;
  }

  let { botId }: { botId: string } = $props();

  let mode = $state<'realtime' | 'historical'>('historical');
  let logs = $state<LogEntry[]>([]);
  let loading = $state(true);
  let connected = $state(false);
  let activeFilters = $state<Set<EventType>>(new Set(['lifecycle', 'task', 'guardrail', 'tool_call']));
  let expandedIds = $state<Set<string>>(new Set());
  let error = $state<string | null>(null);

  const EVENT_TYPE_LABELS: Record<EventType, string> = {
    lifecycle: 'LIFECYCLE',
    task: 'TASK',
    guardrail: 'GUARDRAIL',
    tool_call: 'TOOL CALL',
  };

  const EVENT_COLORS: Record<EventType, string> = {
    lifecycle: 'var(--bo-violet)',
    task: 'var(--bo-teal)',
    guardrail: 'var(--bo-amber)',
    tool_call: 'var(--bo-rose)',
  };

  const filteredLogs = $derived(
    logs.filter(log => activeFilters.has(log.eventType))
  );

  function formatTimestamp(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatDuration(ms: number | null): string {
    if (ms === null) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function statusLabel(rejected: boolean, status: string): string {
    if (rejected) return 'REJECTED';
    if (status === 'error') return 'ERROR';
    return 'OK';
  }

  function statusColor(rejected: boolean, status: string): string {
    if (rejected) return 'var(--bo-rose)';
    if (status === 'error') return 'var(--bo-rose)';
    return 'var(--bo-teal)';
  }

  function toggleFilter(type: EventType) {
    const next = new Set(activeFilters);
    if (next.has(type)) {
      if (next.size > 1) next.delete(type);
    } else {
      next.add(type);
    }
    activeFilters = next;
  }

  function toggleExpand(id: string) {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedIds = next;
  }

  function sseToLogEntry(payload: Record<string, unknown>): LogEntry {
    return {
      id: (payload.invocationId as string) ?? crypto.randomUUID(),
      timestamp: (payload.invokedAt as string) ?? new Date().toISOString(),
      eventType: 'tool_call' as EventType,
      toolName: (payload.toolName as string) ?? null,
      duration: (payload.durationMs as number) ?? null,
      tokenUsage: {
        prompt: null,
        completion: null,
        total: (payload.totalTokens as number) ?? null,
      },
      status: (payload.rejected as boolean) ? 'rejected' : 'success',
      rejected: (payload.rejected as boolean) ?? false,
      rejectionReason: (payload.rejectionReason as string) ?? null,
      requestSummary: null,
      responseSummary: null,
    };
  }

  async function loadHistorical() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`/api/akasa/evolution/bots/${botId}/detail`);
      if (!res.ok) throw new Error('Failed to load detail');
      const data = await res.json() as { steps: DetailStep[] };
      logs = data.steps.map((step) => ({
        id: step.invocationId,
        timestamp: step.invokedAt,
        eventType: 'tool_call' as EventType,
        toolName: step.toolName,
        duration: step.durationMs,
        tokenUsage: {
          prompt: step.promptTokens,
          completion: step.completionTokens,
          total: step.totalTokens,
        },
        status: step.rejected ? 'rejected' : 'success',
        rejected: step.rejected,
        rejectionReason: step.rejectionReason,
        requestSummary: step.requestSummary,
        responseSummary: step.responseSummary,
      }));
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  let eventSource: EventSource | null = null;

  function startRealtime() {
    stopRealtime();
    mode = 'realtime';
    error = null;
    const url = `/api/akasa/bots/${botId}/logs`;
    eventSource = new EventSource(url);
    eventSource.onopen = () => { connected = true; loading = false; };
    eventSource.onerror = () => { connected = false; error = 'Connection lost'; };
    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data) as Record<string, unknown>;
        if (payload.type === 'tool_invocation') {
          const entry = sseToLogEntry(payload);
          logs = [entry, ...logs];
        }
      } catch { /* ignore parse errors */ }
    };
  }

  function stopRealtime() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    connected = false;
  }

  $effect(() => {
    if (mode === 'historical') {
      loadHistorical();
    } else {
      startRealtime();
    }
    return () => stopRealtime();
  });
</script>

<div class="execution-logs">
  <div class="logs-toolbar">
    <div class="mode-toggle">
      <button
        class="mode-btn"
        class:active={mode === 'historical'}
        onclick={() => { stopRealtime(); mode = 'historical'; }}
      >HISTORICAL</button>
      <button
        class="mode-btn"
        class:active={mode === 'realtime'}
        onclick={() => { mode = 'realtime'; startRealtime(); }}
      >REALTIME
        {#if connected}<span class="live-dot"></span>{/if}
      </button>
    </div>

    <div class="filter-group">
      {#each ['lifecycle', 'task', 'guardrail', 'tool_call'] as type}
        {@const active = activeFilters.has(type)}
        <button
          class="filter-btn"
          class:active={active}
          style="--filt-color: {EVENT_COLORS[type]}"
          onclick={() => toggleFilter(type)}
        >
          {EVENT_TYPE_LABELS[type]}
        </button>
      {/each}
    </div>
  </div>

  {#if loading}
    <div class="logs-empty">
      <p class="empty-body">Loading execution logs...</p>
    </div>
  {:else if error}
    <div class="logs-empty">
      <p class="empty-heading error-text">{error}</p>
    </div>
  {:else if filteredLogs.length === 0}
    <div class="logs-empty">
      <p class="empty-heading">No logs captured</p>
      <p class="empty-body">Tool invocations and lifecycle events will appear here during execution.</p>
    </div>
  {:else}
    <div class="logs-table-wrapper">
      <table class="logs-table">
        <thead>
          <tr>
            <th scope="col">TIME</th>
            <th scope="col">TYPE</th>
            <th scope="col">TOOL</th>
            <th scope="col">DURATION</th>
            <th scope="col">TOKENS</th>
            <th scope="col">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredLogs as entry (entry.id)}
            <tr class="log-row" class:rejected={entry.rejected}>
              <td class="cell-time">{formatTimestamp(entry.timestamp)}</td>
              <td class="cell-type">
                <span class="type-badge" style="color: {EVENT_COLORS[entry.eventType]}">
                  {EVENT_TYPE_LABELS[entry.eventType]}
                </span>
              </td>
              <td class="cell-tool">{entry.toolName ?? '—'}</td>
              <td class="cell-duration">{formatDuration(entry.duration)}</td>
              <td class="cell-tokens">
                {#if entry.tokenUsage.total !== null}
                  {entry.tokenUsage.total.toLocaleString()}
                {:else}
                  —
                {/if}
              </td>
              <td class="cell-status">
                <span class="status-badge" style="color: {statusColor(entry.rejected, entry.status)}">
                  {statusLabel(entry.rejected, entry.status)}
                </span>
              </td>
            </tr>
            {#if entry.requestSummary !== null || entry.responseSummary !== null || entry.rejectionReason}
              <tr class="detail-row">
                <td colspan="6">
                  <button class="expand-toggle" onclick={() => toggleExpand(entry.id)}>
                    {expandedIds.has(entry.id) ? 'Hide' : 'Show'} Details
                  </button>
                  {#if expandedIds.has(entry.id)}
                    <div class="detail-content">
                      {#if entry.rejectionReason}
                        <div class="detail-section rejection">
                          <span class="detail-label">REJECTION REASON</span>
                          <p class="detail-text">{entry.rejectionReason}</p>
                        </div>
                      {/if}
                      {#if entry.requestSummary}
                        <div class="detail-section">
                          <span class="detail-label">REQUEST</span>
                          <pre class="detail-pre">{JSON.stringify(entry.requestSummary, null, 2)}</pre>
                        </div>
                      {/if}
                      {#if entry.responseSummary}
                        <div class="detail-section">
                          <span class="detail-label">RESPONSE</span>
                          <pre class="detail-pre">{JSON.stringify(entry.responseSummary, null, 2)}</pre>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .execution-logs {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .logs-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  .mode-toggle {
    display: flex;
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .mode-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    background: none;
    border: none;
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    transition: color 0.15s ease, background 0.15s ease;
  }

  .mode-btn.active {
    color: var(--bo-text);
    background: var(--bo-card);
  }

  .mode-btn:hover:not(.active) {
    color: var(--bo-muted);
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--bo-teal);
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .filter-group {
    display: flex;
    gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .filter-btn {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    background: none;
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-sm);
    padding: 3px 8px;
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease;
  }

  .filter-btn.active {
    color: var(--filt-color);
    border-color: var(--filt-color);
  }

  .filter-btn:hover:not(.active) {
    color: var(--bo-muted);
  }

  .logs-empty {
    padding: var(--space-xl);
    text-align: center;
  }

  .empty-heading {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-sm);
  }

  .empty-body {
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
  }

  .error-text {
    color: var(--bo-rose);
  }

  .logs-table-wrapper {
    overflow-x: auto;
  }

  .logs-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 600px;
  }

  .logs-table th {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--bo-faint);
    text-align: left;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--bo-border);
    white-space: nowrap;
  }

  .logs-table td {
    font-size: 12px;
    color: var(--bo-text);
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-family: var(--font-body);
  }

  .log-row:hover {
    background: rgba(236, 232, 255, 0.04);
  }

  .log-row.rejected {
    background: rgba(239, 68, 68, 0.04);
  }

  .cell-time {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--bo-caption);
    white-space: nowrap;
  }

  .type-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
  }

  .cell-tool {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--bo-rose);
  }

  .cell-duration {
    font-size: 12px;
    color: var(--bo-muted);
  }

  .cell-tokens {
    font-size: 12px;
    color: var(--bo-muted);
  }

  .status-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
  }

  .detail-row td {
    padding-top: 0;
    padding-bottom: var(--space-sm);
    background: var(--bo-card);
    border-bottom: 1px solid var(--bo-border);
  }

  .expand-toggle {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-violet);
    background: none;
    border: 1px solid var(--bo-violet);
    border-radius: var(--radius-sm);
    padding: 2px 8px;
    cursor: pointer;
    margin-bottom: var(--space-xs);
  }

  .expand-toggle:hover {
    background: rgba(124, 58, 237, 0.08);
  }

  .detail-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-sm);
    background: var(--bo-card);
    border-radius: var(--radius-sm);
  }

  .detail-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .detail-section.rejection .detail-label {
    color: var(--bo-rose);
  }

  .detail-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
  }

  .detail-text {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-rose);
    margin: 0;
  }

  .detail-pre {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: var(--bo-caption);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    background: var(--bo-border);
    border-radius: var(--radius-sm);
    padding: var(--space-sm);
  }
</style>