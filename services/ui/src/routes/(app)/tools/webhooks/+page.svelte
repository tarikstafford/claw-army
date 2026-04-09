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

	let showSimulator: boolean = $state(false);
	let simConnectionId: string = $state('');
	let simEventType: string = $state('');
	let simPayload: string = $state('');
	let simResult: { matchedRule: { id: string; eventType: string; assignToAgentId: string | null } | null; allRules: Array<{ id: string; eventType: string; assignToAgentId: string | null }>; dryRun: boolean } | null = $state(null);
	let simLoading: boolean = $state(false);
	let simError: string | null = $state(null);

	function getToolName(toolId: string): string {
		return TOOL_CATALOG.find((t) => t.id === toolId)?.name ?? toolId;
	}

	function getAgentName(agentId: string | null | undefined): string {
		if (!agentId) return '--';
		return (data.agents as Array<{ id: string; name: string }>).find((a) => a.id === agentId)?.name ?? agentId;
	}

	const activeConnections = $derived(
		(data.connections as Array<{ id: string; toolId: string; status: string }>).filter((c) => c.status !== 'disconnected')
	);

	const simSelectedToolId = $derived(
		activeConnections.find((c) => c.id === simConnectionId)?.toolId ?? ''
	);

	const simAvailableEventTypes = $derived(
		simSelectedToolId ? (TOOL_EVENT_TYPES[simSelectedToolId] ?? []) : []
	);

	const simSamplePayload = $derived(
		simSelectedToolId && simEventType
			? SAMPLE_PAYLOADS[simSelectedToolId]?.[simEventType] ?? {}
			: {}
	);

	$effect(() => {
		if (simSelectedToolId && simEventType) {
			simPayload = JSON.stringify(simSamplePayload, null, 2);
		}
	});

	$effect(() => {
		if (simConnectionId) {
			simEventType = '';
			simResult = null;
		}
	});

	async function handleSimulate() {
		simError = null;
		simResult = null;
		simLoading = true;
		try {
			const conn = activeConnections.find((c) => c.id === simConnectionId);
			if (!conn) return;
			const res = await fetch(`/api/akasa/webhooks/${conn.toolId}/simulate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: data.userId,
					eventType: simEventType,
					payload: JSON.parse(simPayload),
				}),
			});
			if (res.ok) {
				simResult = await res.json();
			} else {
				simError = 'Simulation failed';
			}
		} catch {
			simError = 'Simulation failed';
		} finally {
			simLoading = false;
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
		<!-- Routing Rules Section -->
	<div>
		<div class="section-header">
			<h2 class="section-heading">Routing Rules</h2>
			<div class="header-actions">
				<button
					class="simulate-btn"
					onclick={() => { showSimulator = true; }}
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

		{#if simResult}
			<div class="sim-result">
				<h3 class="sim-result-heading">Simulation Result</h3>
				{#if simResult.matchedRule}
					<p class="sim-result-match">
						Event <strong>{simResult.matchedRule.eventType}</strong> would be dispatched to agent <strong>{getAgentName(simResult.matchedRule.assignToAgentId)}</strong>
					</p>
				{:else}
					<p class="sim-result-no-match">No routing rule matched this event type.</p>
				{/if}
				<div class="sim-result-rules">
					<span class="sim-result-label">All active rules:</span>
					{#each simResult.allRules as r}
						<div class="sim-result-rule">
							<span>{r.eventType}</span>
							<span class="sim-arrow">→</span>
							<span>{getAgentName(r.assignToAgentId)}</span>
						</div>
					{/each}
				</div>
				<p class="sim-dry-run">Dry-run only — no agent was actually notified.</p>
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
					<WebhookLogEntry {log} />
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

<!-- Simulator Modal -->
{#if showSimulator}
	<Modal open={true} title="Send Test Event" onclose={() => { showSimulator = false; }}>
		<div class="sim-form">
			<div class="field">
				<label for="sim-connection">Tool Connection</label>
				<select id="sim-connection" bind:value={simConnectionId}>
					<option value="">Select a connection</option>
					{#each activeConnections as conn}
						<option value={conn.id}>{getToolName(conn.toolId)} ({conn.status})</option>
					{/each}
				</select>
			</div>

			<div class="field">
				<label for="sim-event-type">Event Type</label>
				<select
					id="sim-event-type"
					bind:value={simEventType}
					disabled={!simConnectionId}
				>
					<option value="">Select an event</option>
					{#each simAvailableEventTypes as et}
						<option value={et}>{et}</option>
					{/each}
				</select>
			</div>

			<div class="field">
				<label for="sim-payload">Payload</label>
				<textarea
					id="sim-payload"
					bind:value={simPayload}
					rows="10"
					disabled={!simEventType}
				></textarea>
			</div>

			{#if simError}
				<p class="sim-error">{simError}</p>
			{/if}

			<div class="sim-actions">
				<button
					class="sim-run-btn"
					onclick={handleSimulate}
					disabled={!simConnectionId || !simEventType || !simPayload || simLoading}
				>
					{simLoading ? 'Simulating...' : 'Run Simulation'}
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

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-lg);
	}

	.section-heading {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
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

	.header-actions {
		display: flex;
		gap: var(--space-sm);
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

	.simulate-btn:hover {
		background: rgba(45, 212, 191, 0.08);
	}

	.sim-result {
		margin-top: var(--space-lg);
		padding: var(--space-lg);
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	.sim-result-heading {
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: var(--space-md);
	}

	.sim-result-match {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text);
		margin-bottom: var(--space-md);
	}

	.sim-result-no-match {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
		margin-bottom: var(--space-md);
	}

	.sim-result-rules {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin-bottom: var(--space-md);
	}

	.sim-result-label {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
		margin-bottom: var(--space-xs);
	}

	.sim-result-rule {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
	}

	.sim-arrow {
		color: var(--rose, #F472B6);
	}

	.sim-dry-run {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
		font-style: italic;
	}

	.sim-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		margin-top: var(--space-md);
	}

	.sim-form .field {
		display: flex;
		flex-direction: column;
	}

	.sim-form label {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text);
		margin-bottom: var(--space-xs);
		display: block;
	}

	.sim-form select,
	.sim-form textarea {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-sm) var(--space-md);
		min-height: 44px;
		width: 100%;
		box-sizing: border-box;
	}

	.sim-form select:focus,
	.sim-form textarea:focus {
		border-color: var(--teal, #2DD4BF);
		outline: none;
	}

	.sim-form select:disabled,
	.sim-form textarea:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.sim-form textarea {
		resize: vertical;
		font-family: monospace;
		font-size: 12px;
	}

	.sim-error {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--error);
	}

	.sim-actions {
		display: flex;
		justify-content: flex-end;
	}

	.sim-run-btn {
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

	.sim-run-btn:hover:not(:disabled) {
		background: rgba(45, 212, 191, 0.08);
	}

	.sim-run-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
