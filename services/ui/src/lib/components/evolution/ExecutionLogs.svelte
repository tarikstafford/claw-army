<script lang="ts">
  import { onMount } from 'svelte';

  interface LogEntry {
    id: string;
    timestamp: string;
    eventType: 'lifecycle' | 'task' | 'guardrail' | 'tool_call';
    toolName?: string;
    durationMs?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    status: 'ok' | 'rejected' | 'error';
    rejected?: boolean;
    rejectionReason?: string | null;
    requestSummary?: unknown;
    responseSummary?: unknown;
    raw: Record<string, unknown>;
  }

  interface Step {
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

  type FilterType = 'all' | 'lifecycle' | 'task' | 'guardrail' | 'tool_call';
  let activeFilter = $state<FilterType>('all');
  let entries = $state<LogEntry[]>([]);
  let expandedId = $state<string | null>(null);
  let loading = $state(true);
  let isConnected = $state(false);

  const FILTERS: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'ALL' },
    { id: 'lifecycle', label: 'LIFECYCLE' },
    { id: 'task', label: 'TASK' },
    { id: 'guardrail', label: 'GUARDRAIL' },
    { id: 'tool_call', label: 'TOOL CALL' },
  ];

  const filteredEntries = $derived(
    activeFilter === 'all'
      ? entries
      : entries.filter((e) => e.eventType === activeFilter)
  );

  function mapEventType(type: string): LogEntry['eventType'] {
    if (type === 'bot_started' || type === 'bot_stopped' || type === 'bot_failed') return 'lifecycle';
    if (type === 'task_started' || type === 'task_completed' || type === 'task_failed') return 'task';
    if (type === 'guardrail_triggered' || type === 'guardrail_passed') return 'guardrail';
    return 'tool_call';
  }

  function entryStatus(entry: LogEntry): 'ok' | 'rejected' | 'error' {
    if (entry.status === 'rejected') return 'rejected';
    if (entry.eventType === 'lifecycle' && ('bot_failed' in entry.raw || 'error' in entry.raw)) return 'error';
    return 'ok';
  }

  function formatTimestamp(ts: string): string {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  }

  function formatDuration(ms: number | undefined): string {
    if (ms === undefined || ms === null) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  function formatTokens(tokens: number | undefined | null): string {
    if (tokens === undefined || tokens === null) return '—';
    return tokens.toLocaleString();
  }

  function toggleExpand(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  async function loadHistorical() {
    try {
      const res = await fetch(`/api/execution/bots/${botId}/detail`);
      if (!res.ok) return;
      const data = await res.json();
      const steps: Step[] = data.steps ?? [];
      for (const step of steps) {
        entries = [
          ...entries,
          {
            id: step.invocationId,
            timestamp: step.invokedAt,
            eventType: 'tool_call',
            toolName: step.toolName,
            durationMs: step.durationMs ?? undefined,
            promptTokens: step.promptTokens ?? undefined,
            completionTokens: step.completionTokens ?? undefined,
            totalTokens: step.totalTokens ?? undefined,
            status: step.rejected ? 'rejected' : 'ok',
            rejected: step.rejected,
            rejectionReason: step.rejectionReason,
            requestSummary: step.requestSummary,
            responseSummary: step.responseSummary,
            raw: step as unknown as Record<string, unknown>,
          },
        ];
      }
    } catch { /* silent */ }
  }

  onMount(() => {
    loadHistorical().then(() => { loading = false; });

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      eventSource = new EventSource(`/api/execution/bots/${botId}/logs`);
      isConnected = true;

      eventSource.addEventListener('message', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const entry: LogEntry = {
            id: (payload.invocationId as string) ?? crypto.randomUUID(),
            timestamp: payload.timestamp ?? new Date().toISOString(),
            eventType: mapEventType(payload.type ?? ''),
            toolName: payload.toolName,
            durationMs: payload.durationMs,
            totalTokens: payload.totalTokens,
            status: payload.rejected ? 'rejected' : 'ok',
            rejected: payload.rejected,
            rejectionReason: payload.rejectionReason,
            requestSummary: payload.requestSummary,
            responseSummary: payload.responseSummary,
            raw: payload,
          };
          entries = [...entries, entry];
        } catch { /* ignore parse errors */ }
      });

      eventSource.addEventListener('tool_invocation', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const entry: LogEntry = {
            id: (payload.invocationId as string) ?? crypto.randomUUID(),
            timestamp: payload.invokedAt ?? new Date().toISOString(),
            eventType: 'tool_call',
            toolName: payload.toolName,
            durationMs: payload.durationMs,
            totalTokens: payload.totalTokens,
            status: payload.rejected ? 'rejected' : 'ok',
            rejected: payload.rejected,
            rejectionReason: payload.rejectionReason,
            raw: payload,
          };
          entries = [...entries, entry];
        } catch { /* ignore parse errors */ }
      });

      eventSource.addEventListener('bot_lifecycle', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const entry: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: payload.timestamp ?? new Date().toISOString(),
            eventType: 'lifecycle',
            status: payload.type === 'bot_failed' ? 'error' : 'ok',
            raw: payload,
          };
          entries = [...entries, entry];
        } catch { /* ignore parse errors */ }
      });

      eventSource.addEventListener('task_lifecycle', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const entry: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: payload.timestamp ?? new Date().toISOString(),
            eventType: 'task',
            status: 'ok',
            raw: payload,
          };
          entries = [...entries, entry];
        } catch { /* ignore parse errors */ }
      });

      eventSource.addEventListener('guardrail_event', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const entry: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: payload.timestamp ?? new Date().toISOString(),
            eventType: 'guardrail',
            status: payload.type === 'guardrail_triggered' ? 'rejected' : 'ok',
            rejectionReason: payload.reason,
            raw: payload,
          };
          entries = [...entries, entry];
        } catch { /* ignore parse errors */ }
      });

      eventSource.onerror = () => {
        isConnected = false;
        eventSource?.close();
        eventSource = null;
        reconnectTimeout = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      eventSource?.close();
    };
  });
</script>

<div class="exec-logs">
  <div class="logs-header">
    <div class="filter-row">
      {#each FILTERS as f}
        <button
          class="filter-btn"
          class:active={activeFilter === f.id}
          onclick={() => (activeFilter = f.id)}
        >{f.label}</button>
      {/each}
    </div>
    <div class="connection-badge" class:connected={isConnected}>
      <span class="connection-dot"></span>
      <span class="connection-label">{isConnected ? 'LIVE' : 'RECONNECTING'}</span>
    </div>
  </div>

  {#if loading}
    <div class="logs-empty">Loading execution logs...</div>
  {:else if filteredEntries.length === 0}
    <div class="logs-empty">No log entries{activeFilter !== 'all' ? ' for selected filter' : ''}</div>
  {:else}
    <div class="logs-table-wrap">
      <table class="logs-table">
        <thead>
          <tr>
            <th class="col-time">TIME</th>
            <th class="col-type">TYPE</th>
            <th class="col-tool">TOOL / EVENT</th>
            <th class="col-dur">DURATION</th>
            <th class="col-tokens">TOKENS</th>
            <th class="col-status">STATUS</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredEntries as entry (entry.id)}
            <tr class="log-row" class:expanded={expandedId === entry.id}>
              <td class="col-time">{formatTimestamp(entry.timestamp)}</td>
              <td class="col-type">
                <span class="type-badge type-{entry.eventType}">{entry.eventType.toUpperCase()}</span>
              </td>
              <td class="col-tool">{entry.toolName ?? (entry.raw.type as string ?? '—')}</td>
              <td class="col-dur">{formatDuration(entry.durationMs)}</td>
              <td class="col-tokens">{formatTokens(entry.totalTokens)}</td>
              <td class="col-status">
                <span class="status-badge status-{entry.status}">{entry.status.toUpperCase()}</span>
              </td>
            </tr>
            {#if expandedId === entry.id}
              <tr class="detail-row">
                <td colspan="6">
                  <div class="detail-panel">
                    {#if entry.rejectionReason}
                      <div class="detail-field">
                        <span class="detail-label">REJECTION REASON</span>
                        <span class="detail-value error">{entry.rejectionReason}</span>
                      </div>
                    {/if}
                    {#if entry.promptTokens !== undefined}
                      <div class="detail-field">
                        <span class="detail-label">PROMPT TOKENS</span>
                        <span class="detail-value">{formatTokens(entry.promptTokens)}</span>
                      </div>
                    {/if}
                    {#if entry.completionTokens !== undefined}
                      <div class="detail-field">
                        <span class="detail-label">COMPLETION TOKENS</span>
                        <span class="detail-value">{formatTokens(entry.completionTokens)}</span>
                      </div>
                    {/if}
                    {#if entry.requestSummary}
                      <div class="detail-field">
                        <span class="detail-label">REQUEST SUMMARY</span>
                        <pre class="detail-pre">{JSON.stringify(entry.requestSummary, null, 2)}</pre>
                      </div>
                    {/if}
                    {#if entry.responseSummary}
                      <div class="detail-field">
                        <span class="detail-label">RESPONSE SUMMARY</span>
                        <pre class="detail-pre">{JSON.stringify(entry.responseSummary, null, 2)}</pre>
                      </div>
                    {/if}
                    {#if !entry.requestSummary && !entry.responseSummary && !entry.rejectionReason}
                      <span class="detail-empty">No additional details available</span>
                    {/if}
                  </div>
                </td>
              </tr>
            {/if}
            <tr class="expand-trigger" onclick={() => toggleExpand(entry.id)}>
              <td colspan="6" class="expand-cell">
                <span class="expand-hint">{expandedId === entry.id ? '▲' : '▼'}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .exec-logs {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .logs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .filter-row {
    display: flex;
    gap: var(--space-xs);
  }

  .filter-btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    background: none;
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-sm);
    padding: 4px 10px;
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease;
  }

  .filter-btn:hover {
    color: var(--bo-muted);
    border-color: var(--bo-bhi);
  }

  .filter-btn.active {
    color: var(--bo-violet);
    border-color: var(--bo-violet);
    background: rgba(124, 58, 237, 0.08);
  }

  .connection-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
  }

  .connection-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--bo-faint);
  }

  .connection-badge.connected .connection-dot {
    background: var(--bo-teal);
    box-shadow: 0 0 4px var(--bo-teal);
  }

  .connection-badge.connected .connection-label {
    color: var(--bo-teal);
  }

  .logs-empty {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-faint);
    text-align: center;
    padding: var(--space-xl);
  }

  .logs-table-wrap {
    overflow-x: auto;
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
  }

  .logs-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-body);
    font-size: 12px;
  }

  .logs-table thead {
    border-bottom: 1px solid var(--bo-border);
  }

  .logs-table th {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    padding: var(--space-sm) var(--space-md);
    text-align: left;
    font-weight: normal;
  }

  .log-row {
    cursor: pointer;
    transition: background 0.1s ease;
  }

  .log-row:hover {
    background: rgba(236, 232, 255, 0.04);
  }

  .log-row.expanded {
    background: rgba(124, 58, 237, 0.06);
  }

  .logs-table td {
    padding: var(--space-sm) var(--space-md);
    color: var(--bo-text);
    vertical-align: middle;
  }

  .col-time {
    width: 100px;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--bo-caption) !important;
  }

  .col-type {
    width: 100px;
  }

  .col-tool {
    min-width: 120px;
  }

  .col-dur, .col-tokens {
    width: 90px;
    text-align: right;
  }

  .col-status {
    width: 80px;
    text-align: center;
  }

  .type-badge {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid;
  }

  .type-lifecycle {
    color: var(--bo-violet);
    border-color: rgba(124, 58, 237, 0.30);
    background: rgba(124, 58, 237, 0.08);
  }

  .type-task {
    color: var(--bo-amber);
    border-color: rgba(251, 191, 36, 0.30);
    background: rgba(251, 191, 36, 0.08);
  }

  .type-guardrail {
    color: var(--bo-rose);
    border-color: rgba(244, 114, 182, 0.30);
    background: rgba(244, 114, 182, 0.08);
  }

  .type-tool_call {
    color: var(--bo-teal);
    border-color: rgba(45, 212, 191, 0.30);
    background: rgba(45, 212, 191, 0.08);
  }

  .status-badge {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .status-ok {
    color: var(--bo-teal);
    background: rgba(45, 212, 191, 0.08);
  }

  .status-rejected {
    color: var(--bo-rose);
    background: rgba(244, 114, 182, 0.08);
  }

  .status-error {
    color: var(--bo-amber);
    background: rgba(251, 191, 36, 0.08);
  }

  .detail-row td {
    padding: 0;
  }

  .detail-panel {
    padding: var(--space-md);
    background: var(--bo-card);
    border-top: 1px solid var(--bo-border);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .detail-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .detail-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
  }

  .detail-value {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-text);
  }

  .detail-value.error {
    color: var(--bo-rose);
  }

  .detail-pre {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--bo-muted);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    line-height: 1.6;
  }

  .detail-empty {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-faint);
  }

  .expand-trigger {
    cursor: pointer;
  }

  .expand-trigger:hover {
    background: rgba(236, 232, 255, 0.02);
  }

  .expand-cell {
    padding: 0 !important;
    text-align: center;
  }

  .expand-hint {
    font-size: 10px;
    color: var(--bo-faint);
  }
</style>
