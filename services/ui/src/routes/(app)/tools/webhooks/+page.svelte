<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import SlidePanel from '$lib/components/SlidePanel.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import WebhookRuleForm from '$lib/components/tools/WebhookRuleForm.svelte';
	import WebhookLogEntry from '$lib/components/tools/WebhookLogEntry.svelte';
	import { TOOL_CATALOG, TOOL_EVENT_TYPES, SAMPLE_PAYLOADS } from '$lib/tool-catalog';

	let { data } = $props();

	onMount(() => {
		fetchWebhookUrls();
	});

	let showRuleForm: boolean = $state(false);
	let deleteTarget: { id: string; eventType: string } | null = $state(null);
	let submitting: boolean = $state(false);
	let formError: string | null = $state(null);
	let retryingLogId: string | null = $state(null);

	// Webhook URLs per connection
	interface WebhookUrlEntry {
		connectionId: string;
		toolId: string;
		toolName: string;
		webhookUrl: string;
	}
	let webhookUrls = $state<WebhookUrlEntry[]>([]);
	let fetchingUrls: boolean = $state(false);

	// Simulation state
	let showSimulator: boolean = $state(false);
	let selectedToolId: string = $state('');
	let selectedEventType: string = $state('');
	let simulationResult: {
		matched: boolean;
		eventType: string;
		toolId: string;
		matchedRule: { id: string; eventType: string; assignToAgentId: string | null; condition: string | null } | null;
		agentId: string | null;
		agentName: string | null;
	} | null = $state(null);
	let simulationError: string | null = $state(null);
	let isSimulating: boolean = $state(false);

	function getToolName(toolId: string): string {
		return TOOL_CATALOG.find((t) => t.id === toolId)?.name ?? toolId;
	}

	function getAgentName(agentId: string | null | undefined): string {
		if (!agentId) return '--';
		return (data.agents as Array<{ id: string; name: string }>).find((a) => a.id === agentId)?.name ?? agentId;
	}

	function getEventTypesForTool(toolId: string): readonly string[] {
		return TOOL_EVENT_TYPES[toolId] ?? [];
	}

	function getSamplePayload(toolId: string, eventType: string): Record<string, unknown> {
		return (SAMPLE_PAYLOADS[toolId]?.[eventType] ?? { eventType }) as Record<string, unknown>;
	}

	async function fetchWebhookUrls() {
		fetchingUrls = true;
		const activeConnections = (data.connections as Array<{ id: string; toolId: string; status: string }>)
			.filter((c) => c.status !== 'disconnected');
		const results: WebhookUrlEntry[] = [];
		await Promise.allSettled(
			activeConnections.map(async (conn) => {
				const res = await fetch('/api/akasa/webhooks/generate-url', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ connectionId: conn.id }),
				});
				if (res.ok) {
					const data = await res.json();
					results.push({
						connectionId: conn.id,
						toolId: conn.toolId,
						toolName: getToolName(conn.toolId),
						webhookUrl: data.webhookUrl,
					});
				}
			})
		);
		webhookUrls = results;
		fetchingUrls = false;
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Fallback for older browsers
			const textarea = document.createElement('textarea');
			textarea.value = text;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
		}
	}

	async function handleRetryLog(logId: string) {
		retryingLogId = logId;
		try {
			const res = await fetch(`/api/akasa/webhooks/logs/${logId}/retry`, {
				method: 'POST',
			});
			const result = await res.json();
			if (result.success) {
				await invalidateAll();
			} else {
				formError = result.message ?? 'Retry failed';
				setTimeout(() => { formError = null; }, 4000);
			}
		} catch {
			formError = 'Failed to retry webhook delivery';
			setTimeout(() => { formError = null; }, 4000);
		} finally {
			retryingLogId = null;
		}
	}

	function openSimulator() {
		simulationResult = null;
		simulationError = null;
		selectedToolId = '';
		selectedEventType = '';
		showSimulator = true;
	}

	function closeSimulator() {
		showSimulator = false;
		simulationResult = null;
		simulationError = null;
		selectedToolId = '';
		selectedEventType = '';
	}

	async function runSimulation() {
		if (!selectedToolId || !selectedEventType) {
			simulationError = 'Please select a tool and event type';
			return;
		}
		isSimulating = true;
		simulationError = null;
		simulationResult = null;
		try {
			const payload = getSamplePayload(selectedToolId, selectedEventType);
			const res = await fetch(`/api/akasa/webhooks/${selectedToolId}/simulate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: data.userId,
					eventType: selectedEventType,
					payload,
				}),
			});
			if (!res.ok) {
				const err = await res.json();
				simulationError = err.error ?? 'Simulation failed';
				return;
			}
			const result = await res.json();
			if (result.agentId) {
				result.agentName = getAgentName(result.agentId);
			}
			simulationResult = result;
		} catch {
			simulationError = 'Failed to run simulation. Please try again.';
		} finally {
			isSimulating = false;
		}
	}

	async function handleCreateRule(rule: {
		connectionId: string;
		toolId: string;
		eventType: string;
		condition: string;
		assignToAgentId: string;
	}) {
		formError = null;
		try {
			const res = await fetch('/api/akasa/webhook-routing-rules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: data.userId,
					connectionId: rule.connectionId,
					toolId: rule.toolId,
					eventType: rule.eventType,
					condition: rule.condition || null,
					assignToAgentId: rule.assignToAgentId
				})
			});
			if (res.status === 201 || res.ok) {
				showRuleForm = false;
				await invalidateAll();
			} else {
				formError = 'Failed to create rule. Please try again.';
			}
		} catch {
			formError = 'Failed to create rule. Please try again.';
		} finally {
			submitting = false;
		}
	}

	async function handleDeleteRule() {
		if (!deleteTarget) return;
		const id = deleteTarget.id;
		try {
			const res = await fetch(`/api/akasa/webhook-routing-rules/${id}`, {
				method: 'DELETE'
			});
			if (res.status === 204 || res.ok) {
				deleteTarget = null;
				await invalidateAll();
			} else {
				formError = 'Failed to delete rule. Please try again.';
				deleteTarget = null;
			}
		} catch {
			formError = 'Failed to delete rule. Please try again.';
			deleteTarget = null;
		}
	}
</script>

<div class="webhooks-page">
	<!-- Webhook URLs Section -->
	{#if webhookUrls.length > 0}
		<div class="webhook-urls-section">
			<div class="section-header">
				<h2 class="section-heading">Webhook URLs</h2>
				<button
					class="refresh-urls-btn"
					onclick={() => { fetchWebhookUrls(); }}
					disabled={fetchingUrls}
				>
					{fetchingUrls ? 'Loading...' : 'Refresh'}
				</button>
			</div>
			<p class="section-desc">Configure your tool to send webhooks to the URLs below. Each URL is unique to a specific connection.</p>
			<div class="webhook-urls-list">
				{#each webhookUrls as entry}
					<div class="webhook-url-row">
						<div class="webhook-url-info">
							<span class="webhook-url-tool">{entry.toolName}</span>
							<code class="webhook-url-value">{entry.webhookUrl}</code>
						</div>
						<button
							class="copy-btn"
							onclick={() => { copyToClipboard(entry.webhookUrl); }}
						>
							Copy URL
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Routing Rules Section -->
	<div>
		<div class="section-header">
			<h2 class="section-heading">Routing Rules</h2>
			<div class="section-actions">
				<button
					class="test-event-btn"
					onclick={() => { openSimulator(); }}
				>
					Send Test Event
				</button>
				<button
					class="add-rule-btn"
					onclick={() => { showRuleForm = true; }}
				>
					Add Rule
				</button>
			</div>
		</div>

		{#if formError}
			<p class="inline-error">{formError}</p>
		{/if}

		{#if data.rules.length === 0}
			<div class="empty-state">
				<p class="empty-heading">No routing rules</p>
				<p class="empty-body">Add a rule to automatically assign incoming webhooks to an agent.</p>
			</div>
		{:else}
			<div class="rules-list">
				{#each data.rules as rule (rule.id)}
					<div class="rule-row">
						<div class="rule-info">
							<span class="rule-description">
								When <strong>{rule.eventType}</strong> on <strong>{getToolName(rule.toolId)}</strong>
							</span>
							{#if rule.condition}
								<span class="rule-condition">{rule.condition}</span>
							{/if}
						</div>
						<div class="rule-middle">
							<span class="rule-agent">assign to <strong>{getAgentName(rule.assignToAgentId)}</strong></span>
						</div>
						<div class="rule-actions">
							<button
								class="delete-btn"
								onclick={() => { deleteTarget = { id: rule.id, eventType: rule.eventType }; }}
							>
								Delete
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Event Log Section -->
	<div class="event-log-section">
		<div class="section-header">
			<h2 class="section-heading">Event Log</h2>
		</div>

		{#if data.logs.length === 0}
			<div class="empty-state">
				<p class="empty-heading">No webhook events yet</p>
				<p class="empty-body">Incoming webhooks will appear here once a tool sends its first event.</p>
			</div>
		{:else}
			<div class="logs-list">
				{#each data.logs as log (log.id)}
					<WebhookLogEntry {log} onretry={handleRetryLog} />
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- SlidePanel for creating a new routing rule -->
<SlidePanel open={showRuleForm} title="New Routing Rule" onclose={() => { showRuleForm = false; }}>
	<WebhookRuleForm
		connections={data.connections.filter((c: { status: string }) => c.status !== 'disconnected')}
		agents={data.agents}
		onsubmit={handleCreateRule}
		oncancel={() => { showRuleForm = false; }}
	/>
</SlidePanel>

<!-- Delete confirmation Modal -->
{#if deleteTarget}
	<Modal open={true} title="Delete this rule?" onclose={() => { deleteTarget = null; }}>
		<p style="font-family: var(--font-body); font-size: 13px; color: var(--text-muted); margin: var(--space-md) 0;">
			This routing rule will stop processing new webhook events immediately.
		</p>
		<button class="delete-confirm-btn" onclick={handleDeleteRule}>Delete Rule</button>
	</Modal>
{/if}

<!-- Simulation Modal -->
{#if showSimulator}
	<Modal open={true} title="Send Test Event" onclose={() => { closeSimulator(); }}>
		<div class="simulator-form">
			<div class="form-field">
				<label for="tool-select">Tool</label>
				<select
					id="tool-select"
					class="select-input"
					bind:value={selectedToolId}
					onchange={() => { selectedEventType = ''; simulationResult = null; }}
				>
					<option value="">Select a tool</option>
					{#each TOOL_CATALOG as tool}
						<option value={tool.id}>{tool.name}</option>
					{/each}
				</select>
			</div>

			{#if selectedToolId}
				<div class="form-field">
					<label for="event-select">Event Type</label>
					<select
						id="event-select"
						class="select-input"
						bind:value={selectedEventType}
						onchange={() => { simulationResult = null; }}
					>
						<option value="">Select an event type</option>
						{#each getEventTypesForTool(selectedToolId) as eventType}
							<option value={eventType}>{eventType}</option>
						{/each}
					</select>
				</div>
			{/if}

			{#if selectedToolId && selectedEventType}
				<div class="form-field">
					<label>Sample Payload</label>
					<pre class="payload-preview">{JSON.stringify(getSamplePayload(selectedToolId, selectedEventType), null, 2)}</pre>
				</div>

				<button
					class="simulate-btn"
					onclick={() => { runSimulation(); }}
					disabled={isSimulating}
				>
					{isSimulating ? 'Simulating...' : 'Run Simulation'}
				</button>
			{/if}

			{#if simulationError}
				<p class="simulation-error">{simulationError}</p>
			{/if}

			{#if simulationResult}
				<div class="simulation-result" class:matched={simulationResult.matched} class:not-matched={!simulationResult.matched}>
					{#if simulationResult.matched}
						<p class="result-title">Rule Matched</p>
						<p class="result-detail">
							Event type <strong>{simulationResult.eventType}</strong> on <strong>{getToolName(simulationResult.toolId)}</strong>
							would be routed to agent <strong>{simulationResult.agentName ?? simulationResult.agentId ?? '--'}</strong>.
						</p>
						{#if simulationResult.matchedRule?.condition}
							<p class="result-condition">Condition: {simulationResult.matchedRule.condition}</p>
						{/if}
					{:else}
						<p class="result-title">No Match</p>
						<p class="result-detail">
							Event type <strong>{simulationResult.eventType}</strong> on <strong>{getToolName(simulationResult.toolId)}</strong>
							did not match any active routing rules.
						</p>
					{/if}
					<p class="dry-run-note">Dry-run mode — no agent was actually notified.</p>
				</div>
			{/if}
		</div>
	</Modal>
{/if}

<style>
	.webhooks-page {
		display: flex;
		flex-direction: column;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-lg);
	}

	.section-actions {
		display: flex;
		gap: var(--space-sm);
	}

	.section-heading {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
	}

	.test-event-btn {
		min-height: 44px;
		border: 1px solid var(--teal, #2DD4BF);
		color: var(--teal, #2DD4BF);
		background: transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-body);
		font-size: 13px;
		cursor: pointer;
		padding: 0 var(--space-lg);
		transition: background 0.15s ease;
	}

	.test-event-btn:hover {
		background: rgba(45, 212, 191, 0.08);
	}

	.add-rule-btn {
		min-height: 44px;
		border: 1px solid var(--rose, #F472B6);
		color: var(--rose, #F472B6);
		background: transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-body);
		font-size: 13px;
		cursor: pointer;
		padding: 0 var(--space-lg);
		transition: background 0.15s ease;
	}

	.add-rule-btn:hover {
		background: rgba(244, 114, 182, 0.08);
	}

	.inline-error {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--error);
		margin-bottom: var(--space-md);
	}

	.rules-list,
	.logs-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.rule-row {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-md) var(--space-lg);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
	}

	.rule-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		flex: 1;
	}

	.rule-description {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text);
	}

	.rule-condition {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
	}

	.rule-middle {
		flex: 1;
	}

	.rule-agent {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
	}

	.rule-actions {
		flex-shrink: 0;
	}

	.delete-btn {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--error);
		background: transparent;
		border: none;
		cursor: pointer;
		padding: var(--space-xs) var(--space-sm);
		transition: opacity 0.15s ease;
	}

	.delete-btn:hover {
		opacity: 0.7;
	}

	.empty-state {
		text-align: center;
		padding: var(--space-2xl) 0;
	}

	.empty-heading {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text);
		margin-bottom: var(--space-xs);
	}

	.empty-body {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
	}

	.event-log-section {
		margin-top: var(--space-2xl);
	}

	.delete-confirm-btn {
		min-height: 44px;
		border: 1px solid var(--error);
		color: var(--error);
		background: transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-body);
		font-size: 13px;
		cursor: pointer;
		padding: 0 var(--space-lg);
		transition: background 0.15s ease;
	}

	.delete-confirm-btn:hover {
		background: rgba(248, 113, 113, 0.08);
	}

	.simulator-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		margin: var(--space-md) 0;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.form-field label {
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 500;
		color: var(--text);
	}

	.select-input {
		min-height: 40px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--background);
		color: var(--text);
		font-family: var(--font-body);
		font-size: 13px;
		padding: 0 var(--space-sm);
		cursor: pointer;
	}

	.select-input:focus {
		outline: 1px solid var(--teal, #2DD4BF);
		border-color: var(--teal, #2DD4BF);
	}

	.payload-preview {
		background: var(--background);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-sm);
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-muted);
		overflow-x: auto;
		max-height: 200px;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.simulate-btn {
		min-height: 44px;
		border: 1px solid var(--teal, #2DD4BF);
		color: var(--teal, #2DD4BF);
		background: transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-body);
		font-size: 13px;
		cursor: pointer;
		padding: 0 var(--space-lg);
		transition: background 0.15s ease;
	}

	.simulate-btn:hover:not(:disabled) {
		background: rgba(45, 212, 191, 0.08);
	}

	.simulate-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.simulation-error {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--error);
	}

	.simulation-result {
		border-radius: var(--radius-md);
		padding: var(--space-md);
		margin-top: var(--space-sm);
	}

	.simulation-result.matched {
		background: rgba(45, 212, 191, 0.08);
		border: 1px solid var(--teal, #2DD4BF);
	}

	.simulation-result.not-matched {
		background: rgba(244, 114, 182, 0.08);
		border: 1px solid var(--rose, #F472B6);
	}

	.result-title {
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: var(--space-xs);
	}

	.result-detail {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text);
	}

	.result-condition {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
		margin-top: var(--space-xs);
	}

	.dry-run-note {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
		font-style: italic;
		margin-top: var(--space-sm);
	}

	/* Webhook URLs section */
	.webhook-urls-section {
		margin-bottom: var(--space-2xl);
	}

	.webhook-urls-section .section-desc {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
		margin: 0 0 var(--space-lg) 0;
		line-height: 1.5;
	}

	.refresh-urls-btn {
		min-height: 36px;
		border: 1px solid var(--border);
		color: var(--text-muted);
		background: transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-body);
		font-size: 12px;
		cursor: pointer;
		padding: 0 var(--space-md);
		transition: border-color 0.15s ease, color 0.15s ease;
	}

	.refresh-urls-btn:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--text);
	}

	.refresh-urls-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.webhook-urls-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.webhook-url-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-md) var(--space-lg);
		gap: var(--space-md);
	}

	.webhook-url-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		min-width: 0;
		flex: 1;
	}

	.webhook-url-tool {
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 500;
		color: var(--text);
	}

	.webhook-url-value {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-muted);
		background: var(--bg);
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		overflow-x: auto;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.copy-btn {
		min-height: 36px;
		border: 1px solid var(--teal, #2DD4BF);
		color: var(--teal, #2DD4BF);
		background: transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-body);
		font-size: 12px;
		cursor: pointer;
		padding: 0 var(--space-md);
		transition: background 0.15s ease;
		flex-shrink: 0;
	}

	.copy-btn:hover {
		background: rgba(45, 212, 191, 0.08);
	}
</style>
