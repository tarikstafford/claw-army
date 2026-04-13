<script lang="ts">
	import { TOOL_CATALOG } from '$lib/tool-catalog';

	let {
		log,
		onretry
	}: {
		log: {
			id: string;
			toolId: string;
			action: string;
			agentId: string | null;
			success: boolean;
			errorMessage: string | null;
			requestSummary: string | null;
			responseSummary: string | null;
			latencyMs: number | null;
			createdAt: string;
		};
		onretry?: (logId: string) => void;
	} = $props();

	let expanded: boolean = $state(false);
	let retrying: boolean = $state(false);

	function getToolName(toolId: string): string {
		return TOOL_CATALOG.find((t) => t.id === toolId)?.name ?? toolId;
	}

	function getEventAction(action: string): string {
		return action.startsWith('webhook:') ? action.slice('webhook:'.length) : action;
	}

	function formatTimestamp(isoString: string): string {
		const date = new Date(isoString);
		return new Intl.DateTimeFormat('en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}

	async function handleRetry() {
		if (!onretry || retrying) return;
		retrying = true;
		try {
			await onretry(log.id);
		} finally {
			retrying = false;
		}
	}

	const toolName = $derived(getToolName(log.toolId));
	const eventAction = $derived(getEventAction(log.action));
	const timestamp = $derived(formatTimestamp(log.createdAt));
	const hasDetails = $derived(
		!!log.requestSummary || !!log.responseSummary || !!log.errorMessage || !!log.agentId
	);
	const canRetry = $derived(
		!log.success && onretry && !log.action.includes(':retry')
	);
</script>

<div class="log-entry">
	<div
		class="log-header"
		onclick={() => { if (hasDetails) expanded = !expanded; }}
		role="button"
		tabindex="0"
		onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (hasDetails) expanded = !expanded; } }}
		aria-expanded={expanded}
	>
		<div class="log-left">
			<span class="log-tool">{toolName}</span>
			<span class="log-meta">{eventAction} &middot; {timestamp}</span>
		</div>
		<div class="log-right">
			{#if log.latencyMs !== null}
				<span class="log-latency">{log.latencyMs}ms</span>
			{/if}
			{#if canRetry}
				<button
					class="retry-btn"
					onclick={(e) => { e.stopPropagation(); handleRetry(); }}
					disabled={retrying}
				>
					{retrying ? 'Retrying...' : 'Retry'}
				</button>
			{/if}
			<span
				class="success-dot"
				style="background: {log.success ? 'var(--success, #2DD4BF)' : 'var(--error)'}"
				title={log.success ? 'Success' : 'Failed'}
			></span>
			{#if hasDetails}
				<span class="expand-arrow" class:open={expanded}>&#9660;</span>
			{/if}
		</div>
	</div>

	{#if expanded && hasDetails}
		<div class="log-details">
			{#if log.requestSummary}
				<div class="detail-block">
					<span class="detail-label">Payload</span>
					<pre class="detail-pre">{log.requestSummary}</pre>
				</div>
			{/if}
			{#if log.responseSummary}
				<div class="detail-block">
					<span class="detail-label">Response</span>
					<pre class="detail-pre">{log.responseSummary}</pre>
				</div>
			{/if}
			{#if log.errorMessage}
				<div class="detail-block">
					<span class="detail-label error-label">Error</span>
					<pre class="detail-pre error-pre">{log.errorMessage}</pre>
				</div>
			{/if}
			{#if log.agentId}
				<div class="routed-to">Routed to: {log.agentId}</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.log-entry {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.log-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-md) var(--space-lg);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.log-header:hover {
		background: rgba(148, 110, 255, 0.05);
	}

	.log-left {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.log-right {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.log-tool {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text);
	}

	.log-meta {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
	}

	.log-latency {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
	}

	.success-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		display: inline-block;
		flex-shrink: 0;
	}

	.expand-arrow {
		font-size: 10px;
		color: var(--text-muted);
		transition: transform 0.2s;
		display: inline-block;
	}

	.expand-arrow.open {
		transform: rotate(180deg);
	}

	.log-details {
		padding: var(--space-md) var(--space-lg) var(--space-lg);
		border-top: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.detail-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.detail-label {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
	}

	.error-label {
		color: var(--error);
	}

	.detail-pre {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text);
		overflow-x: auto;
		background: var(--bg);
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		max-height: 200px;
		overflow-y: auto;
		white-space: pre-wrap;
		word-break: break-word;
		margin: 0;
	}

	.error-pre {
		color: var(--error);
	}

	.routed-to {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
	}

	.retry-btn {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--teal, #2DD4BF);
		background: transparent;
		border: 1px solid var(--teal, #2DD4BF);
		border-radius: var(--radius-sm);
		cursor: pointer;
		padding: 2px 8px;
		transition: background 0.15s ease;
	}

	.retry-btn:hover:not(:disabled) {
		background: rgba(45, 212, 191, 0.08);
	}

	.retry-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
