<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import SlidePanel from '$lib/components/SlidePanel.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import WebhookRuleForm from '$lib/components/tools/WebhookRuleForm.svelte';
	import WebhookLogEntry from '$lib/components/tools/WebhookLogEntry.svelte';
	import { TOOL_CATALOG, TOOL_EVENT_TYPES, SAMPLE_PAYLOADS } from '$lib/tool-catalog';

	let { data } = $props();

	let showRuleForm: boolean = $state(false);
	let showSimulateForm: boolean = $state(false);
	let deleteTarget: { id: string; eventType: string } | null = $state(null);
	let submitting: boolean = $state(false);
	let formError: string | null = $state(null);
	let simulateError: string | null = $state(null);
	let simulateResult: {
		eventType: string;
		matchedRuleId: string | null;
		assignToAgentId: string | null;
		rules: Array<{ id: string; eventType: string; condition: string | null; assignToAgentId: string | null; isMatch: boolean }>;
		dryRun: boolean;
	} | null = $state(null);

	let simulateToolId: string = $state('');
	let simulateEventType: string = $state('');
	let simulatePayload: string = $state('');
	let simulateSubmitting: boolean = $state(false);

	function getToolName(toolId: string): string {
		return TOOL_CATALOG.find((t) => t.id === toolId)?.name ?? toolId;
	}

	function getAgentName(agentId: string | null | undefined): string {
		if (!agentId) return '--';
		return (data.agents as Array<{ id: string; name: string }>).find((a) => a.id === agentId)?.name ?? agentId;
	}

	const availableSimulateEventTypes = $derived(
		simulateToolId ? (TOOL_EVENT_TYPES[simulateToolId] ?? []) : []
	);

	$effect(() => {
		if (simulateToolId && simulateEventType) {
			const toolSamples = SAMPLE_PAYLOADS[simulateToolId];
			const sample = toolSamples?.[simulateEventType];
			simulatePayload = sample ? JSON.stringify(sample, null, 2) : '{}';
		}
	});

	$effect(() => {
		if (simulateToolId && availableSimulateEventTypes.length > 0 && !availableSimulateEventTypes.includes(simulateEventType)) {
			simulateEventType = availableSimulateEventTypes[0] ?? '';
		} else if (!simulateToolId) {
			simulateEventType = '';
		}
	});

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

	async function handleSimulate() {
		simulateError = null;
		simulateResult = null;
		simulateSubmitting = true;
		try {
			let payload: Record<string, unknown> = {};
			try { payload = JSON.parse(simulatePayload); } catch { /* ignore */ }
			const res = await fetch(`/api/akasa/webhooks/${simulateToolId}/simulate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: data.userId,
					eventType: simulateEventType,
					payload
				})
			});
			if (res.ok) {
				simulateResult = await res.json();
			} else {
				const err = await res.json().catch(() => ({ error: 'Simulation failed' }));
				simulateError = err.error ?? 'Simulation failed';
			}
		} catch {
			simulateError = 'Simulation failed. Please try again.';
		} finally {
			simulateSubmitting = false;
		}
	}

	function openSimulate() {
		simulateResult = null;
		simulateError = null;
		const connections = data.connections.filter((c: { status: string }) => c.status !== 'disconnected');
		simulateToolId = connections[0]?.toolId ?? '';
		simulateEventType = simulateToolId ? (TOOL_EVENT_TYPES[simulateToolId]?.[0] ?? '') : '';
		showSimulateForm = true;
	}
</script>

<div class="webhooks-page">
	<!-- Routing Rules Section -->
	<div>
		<div class="section-header">
			<h2 class="section-heading">Routing Rules</h2>
			<div class="section-actions">
				<button
					class="simulate-btn"
					onclick={openSimulate}
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

<!-- SlidePanel for simulating a webhook event -->
<SlidePanel open={showSimulateForm} title="Send Test Event" onclose={() => { showSimulateForm = false; }}>
	<div class="simulate-form">
		{#if simulateError}
			<p class="inline-error">{simulateError}</p>
		{/if}

		<div class="field">
			<label for="sim-tool">Tool</label>
			<select id="sim-tool" bind:value={simulateToolId}>
				<option value="">Select a tool</option>
				{#each [...new Map(data.connections.filter((c: { status: string; toolId: string }) => c.status !== 'disconnected').map((c: { toolId: string }) => [c.toolId, c])).values()] as conn}
					<option value={conn.toolId}>{getToolName(conn.toolId)}</option>
				{/each}
			</select>
		</div>

		<div class="field">
			<label for="sim-event">Event Type</label>
			<select id="sim-event" bind:value={simulateEventType} disabled={!simulateToolId}>
				<option value="">Select an event</option>
				{#each availableSimulateEventTypes as evt}
					<option value={evt}>{evt}</option>
				{/each}
			</select>
		</div>

		<div class="field">
			<label for="sim-payload">Payload</label>
			<textarea
				id="sim-payload"
				bind:value={simulatePayload}
				rows="10"
				disabled={!simulateToolId}
			></textarea>
		</div>

		<div class="form-actions">
			<button class="cancel-btn" type="button" onclick={() => { showSimulateForm = false; }}>Cancel</button>
			<button
				class="submit-btn"
				type="button"
				onclick={handleSimulate}
				disabled={!simulateToolId || !simulateEventType || simulateSubmitting}
			>
				{simulateSubmitting ? 'Simulating...' : 'Simulate'}
			</button>
		</div>

		{#if simulateResult}
			<div class="simulate-result">
				<div class="result-header">Simulation Result</div>
				<div class="result-event">Event: <strong>{simulateResult.eventType}</strong></div>
				<div class="result-match">
					Matched Rule: <strong>{simulateResult.matchedRuleId ? 'Yes' : 'No'}</strong>
					{#if simulateResult.assignToAgentId}
						<span class="result-agent"> → Agent: <strong>{getAgentName(simulateResult.assignToAgentId)}</strong></span>
					{/if}
				</div>
				{#if simulateResult.rules.length > 0}
					<div class="result-rules-header">All Rules ({simulateResult.rules.length})</div>
					{#each simulateResult.rules as rule}
						<div class="result-rule" class:matched={rule.isMatch}>
							<span class="rule-event">{rule.eventType}</span>
							{#if rule.condition}<span class="rule-condition">{rule.condition}</span>{/if}
							<span class="rule-agent">{rule.assignToAgentId ? getAgentName(rule.assignToAgentId) : '--'}</span>
							<span class="rule-status">{rule.isMatch ? '✓ matched' : '✗'}</span>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</SlidePanel>

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

	.section-actions {
		display: flex;
		gap: var(--space-sm);
	}

	.simulate-btn {
		min-height: 44px;
		border: 1px solid var(--teal, #14B8A6);
		color: var(--teal, #14B8A6);
		background: transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-body);
		font-size: 13px;
		cursor: pointer;
		padding: 0 var(--space-lg);
		transition: background 0.15s ease;
	}

	.simulate-btn:hover {
		background: rgba(20, 184, 166, 0.08);
	}

	.simulate-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.simulate-form .field {
		display: flex;
		flex-direction: column;
	}

	.simulate-form label {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text);
		margin-bottom: var(--space-xs);
		display: block;
	}

	.simulate-form select,
	.simulate-form textarea {
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

	.simulate-form textarea {
		min-height: 200px;
		resize: vertical;
		font-family: monospace;
	}

	.simulate-form select:focus,
	.simulate-form textarea:focus {
		border-color: var(--teal, #14B8A6);
		outline: none;
	}

	.simulate-form select:disabled,
	.simulate-form textarea:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.simulate-form .form-actions {
		display: flex;
		gap: var(--space-sm);
		justify-content: flex-end;
		margin-top: var(--space-xs);
	}

	.simulate-form .cancel-btn {
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

	.simulate-form .cancel-btn:hover {
		background: rgba(148, 110, 255, 0.05);
	}

	.simulate-form .submit-btn {
		min-height: 44px;
		border: 1px solid var(--teal, #14B8A6);
		color: var(--teal, #14B8A6);
		background: transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-body);
		font-size: 13px;
		cursor: pointer;
		padding: 0 var(--space-lg);
		transition: background 0.15s ease;
	}

	.simulate-form .submit-btn:hover:not(:disabled) {
		background: rgba(20, 184, 166, 0.08);
	}

	.simulate-form .submit-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.simulate-result {
		margin-top: var(--space-md);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		background: var(--bg);
	}

	.result-header {
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: var(--space-sm);
	}

	.result-event,
	.result-match {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
		margin-bottom: var(--space-xs);
	}

	.result-agent {
		color: var(--text);
	}

	.result-rules-header {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
		margin-top: var(--space-md);
		margin-bottom: var(--space-xs);
	}

	.result-rule {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		font-family: var(--font-body);
		font-size: 12px;
		padding: var(--space-xs) 0;
		border-bottom: 1px solid var(--border);
	}

	.result-rule:last-child {
		border-bottom: none;
	}

	.result-rule.matched {
		color: var(--teal, #14B8A6);
	}

	.rule-event {
		font-weight: 600;
	}

	.rule-condition {
		color: var(--text-muted);
		flex: 1;
	}

	.rule-agent {
		color: var(--text-muted);
	}

	.rule-status {
		font-weight: 600;
	}
</style>
