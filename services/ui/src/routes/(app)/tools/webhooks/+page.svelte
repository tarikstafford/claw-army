<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import SlidePanel from '$lib/components/SlidePanel.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import WebhookRuleForm from '$lib/components/tools/WebhookRuleForm.svelte';
	import WebhookLogEntry from '$lib/components/tools/WebhookLogEntry.svelte';
	import { TOOL_CATALOG, TOOL_EVENT_TYPES, SAMPLE_PAYLOADS } from '$lib/tool-catalog';

	let { data } = $props();

	let showRuleForm: boolean = $state(false);
	let deleteTarget: { id: string; eventType: string } | null = $state(null);
	let submitting: boolean = $state(false);
	let formError: string | null = $state(null);

	// Webhook URLs per connection
	interface WebhookUrlEntry {
		connectionId: string;
		url: string;
		loading: boolean;
		copied: boolean;
	}
	let webhookUrls: WebhookUrlEntry[] = $state([]);
	let fetchingUrls: boolean = $state(false);

	// Retry state
	let retryTarget: { id: string; toolId: string; eventType: string; payload: Record<string, unknown> } | null = $state(null);
	let retrying: boolean = $state(false);
	let retryResult: { success: boolean; message: string } | null = $state(null);

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
		const webhookConnections = data.connections.filter((c: { status: string }) => c.status !== 'disconnected');
		if (webhookConnections.length === 0) return;

		fetchingUrls = true;
		const results: WebhookUrlEntry[] = [];

		await Promise.allSettled(
			webhookConnections.map(async (conn: { id: string; toolId: string }) => {
				try {
					const res = await fetch('/api/akasa/webhooks/generate-url', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ connectionId: conn.id }),
					});
					if (res.ok) {
						const data = await res.json();
						results.push({ connectionId: conn.id, url: data.webhookUrl, loading: false, copied: false });
					}
				} catch {
					results.push({ connectionId: conn.id, url: '', loading: false, copied: false });
				}
			})
		);

		webhookUrls = results;
		fetchingUrls = false;
	}

	async function copyWebhookUrl(connectionId: string) {
		const entry = webhookUrls.find((u) => u.connectionId === connectionId);
		if (!entry || !entry.url) return;

		try {
			await navigator.clipboard.writeText(entry.url);
			entry.copied = true;
			setTimeout(() => {
				const e = webhookUrls.find((u) => u.connectionId === connectionId);
				if (e) e.copied = false;
			}, 2000);
		} catch {
			// Fallback: select text
		}
	}

	function getWebhookUrl(connectionId: string): string {
		return webhookUrls.find((u) => u.connectionId === connectionId)?.url ?? '';
	}

	function openRetry(log: {
		id: string;
		toolId: string;
		action: string;
		requestSummary: string | null;
	}) {
		const eventType = log.action.startsWith('webhook:') ? log.action.slice('webhook:'.length) : log.action;
		let payload: Record<string, unknown> = {};
		if (log.requestSummary) {
			try {
				payload = JSON.parse(log.requestSummary);
			} catch {
				payload = { eventType };
			}
		}
		retryTarget = { id: log.id, toolId: log.toolId, eventType, payload };
		retryResult = null;
	}

	function closeRetry() {
		retryTarget = null;
		retryResult = null;
	}

	async function handleRetry() {
		if (!retryTarget) return;
		retrying = true;
		retryResult = null;

		try {
			const res = await fetch(`/api/akasa/webhooks/${retryTarget.toolId}/simulate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: data.userId,
					eventType: retryTarget.eventType,
					payload: retryTarget.payload,
				}),
			});
			const result = await res.json();
			if (res.ok) {
				retryResult = {
					success: result.matched,
					message: result.matched
						? `Delivered to agent ${result.agentName ?? result.agentId ?? '--'}`
						: 'No routing rule matched',
				};
			} else {
				retryResult = { success: false, message: result.error ?? 'Retry failed' };
			}
		} catch {
			retryResult = { success: false, message: 'Network error' };
		} finally {
			retrying = false;
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
	{#if data.connections.filter((c: { status: string }) => c.status !== 'disconnected').length > 0}
		<div class="webhook-urls-section">
			<div class="section-header">
				<h2 class="section-heading">Webhook URLs</h2>
				<button
					class="fetch-urls-btn"
					onclick={() => { fetchWebhookUrls(); }}
					disabled={fetchingUrls}
				>
					{fetchingUrls ? 'Loading...' : 'Refresh URLs'}
				</button>
			</div>
			<div class="webhook-urls-list">
				{#each data.connections.filter((c: { status: string }) => c.status !== 'disconnected') as conn (conn.id)}
					{@const webhookUrl = getWebhookUrl(conn.id)}
					{@const urlEntry = webhookUrls.find((u) => u.connectionId === conn.id)}
					<div class="webhook-url-row">
						<div class="webhook-url-info">
							<span class="webhook-url-tool">{getToolName(conn.toolId)}</span>
							{#if webhookUrl}
								<code class="webhook-url-code">{webhookUrl}</code>
							{:else}
								<span class="webhook-url-loading">
									{urlEntry?.loading ? 'Generating...' : 'Click Refresh to generate URL'}
								</span>
							{/if}
						</div>
						<div class="webhook-url-actions">
							{#if webhookUrl}
								<button
									class="copy-btn"
									class:copied={urlEntry?.copied}
									onclick={() => { copyWebhookUrl(conn.id); }}
								>
									{urlEntry?.copied ? 'Copied!' : 'Copy'}
								</button>
							{/if}
						</div>
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
					<WebhookLogEntry {log} onretry={(l) => { openRetry(l); }} />
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

<!-- Retry Modal -->
{#if retryTarget}
	<Modal open={true} title="Retry Webhook Delivery" onclose={() => { closeRetry(); }}>
		<div class="retry-form">
			<p class="retry-desc">
				Re-send this event to test routing rules.
			</p>
			<div class="retry-info">
				<span class="retry-tool">{getToolName(retryTarget.toolId)}</span>
				<span class="retry-event-type">{retryTarget.eventType}</span>
			</div>
			<div class="retry-payload">
				<span class="payload-label">Payload</span>
				<pre class="payload-preview">{JSON.stringify(retryTarget.payload, null, 2)}</pre>
			</div>
			{#if retryResult}
				<div class="retry-result" class:success={retryResult.success} class:failed={!retryResult.success}>
					<p class="retry-result-message">{retryResult.message}</p>
				</div>
			{/if}
			<div class="retry-actions">
				<button class="cancel-btn" onclick={() => { closeRetry(); }}>Cancel</button>
				<button
					class="retry-btn"
					onclick={() => { handleRetry(); }}
					disabled={retrying}
				>
					{retrying ? 'Retrying...' : 'Retry Delivery'}
				</button>
			</div>
		</div>
	</Modal>
{/if}

<style>
	.webhooks-page {
		display: flex;
		flex-direction: column;
	}

	.webhook-urls-section {
		margin-bottom: var(--space-2xl);
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
	}

	.webhook-url-tool {
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 500;
		color: var(--text);
	}

	.webhook-url-code {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-muted);
		background: var(--bg);
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		word-break: break-all;
	}

	.webhook-url-loading {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
	}

	.webhook-url-actions {
		flex-shrink: 0;
	}

	.fetch-urls-btn {
		min-height: 44px;
		border: 1px solid var(--accent);
		color: var(--accent);
		background: transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-body);
		font-size: 13px;
		cursor: pointer;
		padding: 0 var(--space-lg);
		transition: background 0.15s ease;
	}

	.fetch-urls-btn:hover:not(:disabled) {
		background: var(--accent-dim);
	}

	.fetch-urls-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.copy-btn {
		min-height: 36px;
		border: 1px solid var(--border);
		color: var(--text-muted);
		background: transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-body);
		font-size: 12px;
		cursor: pointer;
		padding: 0 var(--space-md);
		transition: all 0.15s ease;
	}

	.copy-btn:hover {
		border-color: var(--accent);
		color: var(--text);
	}

	.copy-btn.copied {
		border-color: var(--success);
		color: var(--success);
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

	/* Retry Modal Styles */
	.retry-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		margin: var(--space-md) 0;
	}

	.retry-desc {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
	}

	.retry-info {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.retry-tool {
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 500;
		color: var(--text);
	}

	.retry-event-type {
		font-family: var(--font-label);
		font-size: 6px;
		color: var(--accent);
		letter-spacing: 0.08em;
	}

	.retry-payload {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.payload-label {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
	}

	.retry-result {
		border-radius: var(--radius-md);
		padding: var(--space-md);
	}

	.retry-result.success {
		background: rgba(45, 212, 191, 0.08);
		border: 1px solid var(--success);
	}

	.retry-result.failed {
		background: rgba(248, 113, 113, 0.08);
		border: 1px solid var(--error);
	}

	.retry-result-message {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text);
	}

	.retry-actions {
		display: flex;
		gap: var(--space-sm);
		justify-content: flex-end;
		margin-top: var(--space-xs);
	}

	.cancel-btn {
		min-height: 44px;
		border: 1px solid var(--border);
		color: var(--text-muted);
		background: transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-body);
		font-size: 13px;
		cursor: pointer;
		padding: 0 var(--space-lg);
		transition: background 0.15s ease;
	}

	.cancel-btn:hover {
		background: rgba(148, 110, 255, 0.05);
	}

	.retry-btn {
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

	.retry-btn:hover:not(:disabled) {
		background: rgba(45, 212, 191, 0.08);
	}

	.retry-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
