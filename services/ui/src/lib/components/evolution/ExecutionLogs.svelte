<script lang="ts">
	import Accordion from '$lib/components/Accordion.svelte';

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

	interface LogEvent {
		type: string;
		botId?: string;
		[key: string]: unknown;
	}

	let { botId }: { botId: string } = $props();

	let historicalSteps = $state<Step[]>([]);
	let liveEvents = $state<LogEvent[]>([]);
	let loading = $state(true);
	let viewMode = $state<'live' | 'history'>('history');
	let expandedId = $state<string | null>(null);

	type EventTypeFilter = 'all' | 'lifecycle' | 'task' | 'guardrail' | 'tool_call';
	let eventFilter = $state<EventTypeFilter>('all');

	const EVENT_TYPE_LABELS: Record<string, string> = {
		bot_started: 'LIFECYCLE',
		bot_stopped: 'LIFECYCLE',
		bot_failed: 'LIFECYCLE',
		task_claimed: 'TASK',
		task_completed: 'TASK',
		task_failed: 'TASK',
		guardrail_triggered: 'GUARDRAIL',
		tool_invocation: 'TOOL',
	};

	const LIFECYCLE_TYPES = new Set(['bot_started', 'bot_stopped', 'bot_failed']);
	const TASK_TYPES = new Set(['task_claimed', 'task_completed', 'task_failed']);
	const GUARDRAIL_TYPES = new Set(['guardrail_triggered']);

	function getEventType(type: string): EventTypeFilter {
		if (LIFECYCLE_TYPES.has(type)) return 'lifecycle';
		if (TASK_TYPES.has(type)) return 'task';
		if (GUARDRAIL_TYPES.has(type)) return 'guardrail';
		if (type === 'tool_invocation') return 'tool_call';
		return 'all';
	}

	const filteredHistorical = $derived(
		historicalSteps.filter((s) => eventFilter === 'all' || getEventType('tool_invocation') === eventFilter)
	);

	const filteredLiveEvents = $derived(
		liveEvents.filter((e) => eventFilter === 'all' || getEventType(e.type) === eventFilter)
	);

	function formatTimestamp(ts: string): string {
		return new Date(ts).toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		});
	}

	function formatDuration(ms: number | null): string {
		if (ms === null) return '—';
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	async function loadHistory() {
		try {
			const res = await fetch(`/api/bots/${botId}/detail`);
			if (res.ok) {
				const data = await res.json();
				historicalSteps = data.steps ?? [];
			}
		} catch { /* silent */ }
		loading = false;
	}

	let esInstance: EventSource | null = null;

	function connectSSE() {
		if (esInstance) esInstance.close();
		esInstance = new EventSource(`/api/bots/${botId}/logs`);
		esInstance.addEventListener('tool_invocation', (e) => {
			try {
				const payload = JSON.parse(e.data);
				liveEvents = [...liveEvents, { type: 'tool_invocation', ...payload }];
			} catch { /* silent */ }
		});
		esInstance.addEventListener('message', (e) => {
			try {
				const payload = JSON.parse(e.data);
				liveEvents = [...liveEvents, payload];
			} catch { /* silent */ }
		});
	}

	$effect(() => {
		if (viewMode === 'history') {
			loadHistory();
		} else {
			loading = false;
			connectSSE();
		}
		return () => {
			if (esInstance) {
				esInstance.close();
				esInstance = null;
			}
		};
	});
</script>

<div class="exec-logs">
	<div class="logs-toolbar">
		<div class="view-toggle">
			<button
				class="toggle-btn"
				class:active={viewMode === 'history'}
				onclick={() => (viewMode = 'history')}
			>History</button>
			<button
				class="toggle-btn"
				class:active={viewMode === 'live'}
				onclick={() => (viewMode = 'live')}
			>Live</button>
		</div>

		<div class="filter-row">
			<span class="filter-label">FILTER</span>
			{#each ['all', 'lifecycle', 'task', 'guardrail', 'tool_call'] as f}
				<button
					class="filter-btn"
					class:active={eventFilter === f}
					onclick={() => (eventFilter = f)}
				>{f === 'tool_call' ? 'TOOL CALL' : f.toUpperCase()}</button>
			{/each}
		</div>
	</div>

	{#if loading}
		<div class="logs-empty">
			<p class="empty-body">Loading execution logs…</p>
		</div>
	{:else if viewMode === 'history'}
		{#if filteredHistorical.length === 0}
			<div class="logs-empty">
				<p class="empty-heading">No tool invocations recorded</p>
				<p class="empty-body">Tool call history will appear after the first execution completes.</p>
			</div>
		{:else}
			<div class="logs-table-wrap">
				<table class="logs-table">
					<thead>
						<tr>
							<th scope="col">Time</th>
							<th scope="col">Type</th>
							<th scope="col">Tool</th>
							<th scope="col">Duration</th>
							<th scope="col">Tokens</th>
							<th scope="col">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredHistorical as step (step.invocationId)}
							{@const isExpanded = expandedId === step.invocationId}
							<tr class="log-row" class:rejected={step.rejected} onclick={() => toggleExpand(step.invocationId)}>
								<td class="cell-time">{formatTimestamp(step.invokedAt)}</td>
								<td class="cell-type">TOOL CALL</td>
								<td class="cell-tool">{step.toolName}</td>
								<td class="cell-dur">{formatDuration(step.durationMs)}</td>
								<td class="cell-tokens">
									{#if step.totalTokens != null}
										{step.totalTokens.toLocaleString()}
									{:else}
										—
									{/if}
								</td>
								<td class="cell-status">
									{#if step.rejected}
										<span class="status-badge rejected">REJECTED</span>
									{:else}
										<span class="status-badge ok">OK</span>
									{/if}
								</td>
							</tr>
							{#if isExpanded}
								<tr class="expand-row">
									<td colspan="6">
										<div class="expand-content">
											{#if step.rejected && step.rejectionReason}
												<div class="rejection-note">⚠ {step.rejectionReason}</div>
											{/if}
											<div class="detail-grid">
												{#if step.promptTokens != null}
													<div class="detail-item">
														<span class="detail-label">PROMPT TOKENS</span>
														<span class="detail-value">{step.promptTokens.toLocaleString()}</span>
													</div>
												{/if}
												{#if step.completionTokens != null}
													<div class="detail-item">
														<span class="detail-label">COMPLETION TOKENS</span>
														<span class="detail-value">{step.completionTokens.toLocaleString()}</span>
													</div>
												{/if}
												{#if step.totalTokens != null}
													<div class="detail-item">
														<span class="detail-label">TOTAL TOKENS</span>
														<span class="detail-value">{step.totalTokens.toLocaleString()}</span>
													</div>
												{/if}
												{#if step.durationMs != null}
													<div class="detail-item">
														<span class="detail-label">DURATION</span>
														<span class="detail-value">{step.durationMs}ms</span>
													</div>
												{/if}
											</div>
											{#if step.requestSummary}
												<Accordion label="REQUEST" color="var(--bo-teal)">
													<pre class="json-pre">{JSON.stringify(step.requestSummary, null, 2)}</pre>
												</Accordion>
											{/if}
											{#if step.responseSummary}
												<Accordion label="RESPONSE" color="var(--bo-violet)">
													<pre class="json-pre">{JSON.stringify(step.responseSummary, null, 2)}</pre>
												</Accordion>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{:else}
		{#if filteredLiveEvents.length === 0}
			<div class="logs-empty">
				<p class="empty-heading">Waiting for events…</p>
				<p class="empty-body">Live events will stream here during active execution.</p>
			</div>
		{:else}
			<div class="logs-table-wrap">
				<table class="logs-table">
					<thead>
						<tr>
							<th scope="col">Time</th>
							<th scope="col">Type</th>
							<th scope="col">Data</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredLiveEvents as event (event.invocationId ?? JSON.stringify(event))}
							<tr class="log-row">
								<td class="cell-time">{formatTimestamp(event.invokedAt ?? new Date().toISOString())}</td>
								<td class="cell-type">{EVENT_TYPE_LABELS[event.type] ?? event.type?.toUpperCase() ?? '—'}</td>
								<td class="cell-tool">
									{#if event.toolName}
										{event.toolName}
									{:else if event.type === 'bot_started'}
										Bot started
									{:else if event.type === 'bot_stopped'}
										Bot stopped
									{:else if event.type === 'bot_failed'}
										Bot failed: {event.error ?? ''}
									{:else if event.type === 'task_claimed'}
										Task claimed
									{:else if event.type === 'task_completed'}
										Task completed
									{:else if event.type === 'task_failed'}
										Task failed
									{:else if event.type === 'guardrail_triggered'}
										Guardrail: {event.guardrailName ?? event.reason ?? ''}
									{:else}
										{event.type ?? '—'}
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>

<style>
	.exec-logs {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.logs-toolbar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-md);
	}

	.view-toggle {
		display: flex;
		border: 1px solid var(--bo-border);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.toggle-btn {
		font-family: var(--font-label);
		font-size: 7px;
		letter-spacing: 0.10em;
		color: var(--bo-faint);
		background: none;
		border: none;
		padding: var(--space-xs) var(--space-md);
		cursor: pointer;
		transition: color 0.15s ease, background 0.15s ease;
	}

	.toggle-btn.active {
		color: var(--bo-text);
		background: var(--bo-card);
	}

	.filter-row {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.filter-label {
		font-family: var(--font-label);
		font-size: 6px;
		letter-spacing: 0.10em;
		color: var(--bo-caption);
		margin-right: var(--space-xs);
	}

	.filter-btn {
		font-family: var(--font-label);
		font-size: 6px;
		letter-spacing: 0.10em;
		color: var(--bo-faint);
		background: none;
		border: 1px solid var(--bo-border);
		border-radius: var(--radius-sm);
		padding: 2px 6px;
		cursor: pointer;
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.filter-btn.active {
		color: var(--bo-violet);
		border-color: var(--bo-violet);
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

	.logs-table-wrap {
		overflow-x: auto;
		border: 1px solid var(--bo-border);
		border-radius: var(--radius-md);
	}

	.logs-table {
		width: 100%;
		border-collapse: collapse;
	}

	.logs-table th {
		font-family: var(--font-label);
		font-size: 6px;
		font-weight: 400;
		letter-spacing: 0.10em;
		text-transform: uppercase;
		color: var(--bo-faint);
		text-align: left;
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--bo-border);
		white-space: nowrap;
	}

	.logs-table td {
		font-size: 13px;
		color: var(--bo-text);
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		font-family: var(--font-body);
	}

	.log-row {
		cursor: pointer;
		transition: background 0.15s ease;
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

	.cell-type {
		font-family: var(--font-label);
		font-size: 7px;
		letter-spacing: 0.10em;
		color: var(--bo-muted);
	}

	.cell-tool {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--bo-text);
	}

	.cell-dur {
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		color: var(--bo-muted);
	}

	.cell-tokens {
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		color: var(--bo-muted);
	}

	.cell-status {
		font-family: var(--font-label);
		font-size: 7px;
		letter-spacing: 0.10em;
	}

	.status-badge {
		padding: 2px 6px;
		border-radius: 3px;
	}

	.status-badge.ok {
		color: var(--bo-teal);
		background: rgba(20, 184, 166, 0.1);
		border: 1px solid rgba(20, 184, 166, 0.24);
	}

	.status-badge.rejected {
		color: var(--bo-rose);
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.24);
	}

	.expand-row td {
		padding: 0;
		border-bottom: 1px solid var(--bo-border);
	}

	.expand-content {
		padding: var(--space-md);
		background: var(--bo-card);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.rejection-note {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--bo-rose);
		padding: var(--space-sm);
		background: rgba(239, 68, 68, 0.08);
		border-radius: var(--radius-sm);
	}

	.detail-grid {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
	}

	.detail-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.detail-label {
		font-family: var(--font-label);
		font-size: 5px;
		letter-spacing: 0.10em;
		color: var(--bo-caption);
	}

	.detail-value {
		font-family: var(--font-mono, monospace);
		font-size: 12px;
		color: var(--bo-text);
	}

	.json-pre {
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		color: var(--bo-text);
		white-space: pre-wrap;
		word-break: break-word;
		margin: 0;
		line-height: 1.6;
	}
</style>
