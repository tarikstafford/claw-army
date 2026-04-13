<script lang="ts">
	import { TOOL_CATALOG, TOOL_EVENT_TYPES } from '$lib/tool-catalog';

	let {
		connections,
		agents,
		onsubmit,
		oncancel
	}: {
		connections: Array<{ id: string; toolId: string; status: string }>;
		agents: Array<{ id: string; name: string }>;
		onsubmit: (rule: { connectionId: string; toolId: string; eventType: string; condition: string; assignToAgentId: string }) => void;
		oncancel: () => void;
	} = $props();

	let selectedConnectionId: string = $state('');
	let selectedEventType: string = $state('');
	let condition: string = $state('');
	let selectedAgentId: string = $state('');
	let submitting: boolean = $state(false);

	const activeConnections = $derived(
		connections.filter((c) => c.status !== 'disconnected')
	);

	const selectedToolId = $derived(
		activeConnections.find((c) => c.id === selectedConnectionId)?.toolId ?? ''
	);

	const availableEventTypes = $derived(
		selectedToolId ? (TOOL_EVENT_TYPES[selectedToolId] ?? []) : []
	);

	$effect(() => {
		// Reset event type when connection changes
		if (selectedConnectionId) {
			selectedEventType = '';
		}
	});

	function getToolName(toolId: string): string {
		return TOOL_CATALOG.find((t) => t.id === toolId)?.name ?? toolId;
	}

	const isSubmitDisabled = $derived(
		!selectedConnectionId || !selectedEventType || !selectedAgentId || submitting
	);

	function handleSubmit() {
		if (isSubmitDisabled) return;
		submitting = true;
		onsubmit({
			connectionId: selectedConnectionId,
			toolId: selectedToolId,
			eventType: selectedEventType,
			condition,
			assignToAgentId: selectedAgentId
		});
	}
</script>

<div class="rule-form" aria-label="Webhook rule form">
	<div class="field">
		<label for="connection-select">Tool Connection</label>
		<select
			id="connection-select"
			bind:value={selectedConnectionId}
			aria-required="true"
		>
			<option value="">Select a connection</option>
			{#each activeConnections as conn}
				<option value={conn.id}>{getToolName(conn.toolId)} ({conn.status})</option>
			{/each}
		</select>
	</div>

	<div class="field">
		<label for="event-type-select">Event Type</label>
		<select
			id="event-type-select"
			bind:value={selectedEventType}
			disabled={!selectedConnectionId}
			aria-required="true"
		>
			<option value="">Select an event</option>
			{#each availableEventTypes as eventType}
				<option value={eventType}>{eventType}</option>
			{/each}
		</select>
	</div>

	<div class="field">
		<label for="condition-input">Condition <span class="optional-label">(optional)</span></label>
		<input
			id="condition-input"
			type="text"
			bind:value={condition}
			placeholder="e.g. payload.amount > 1000"
			aria-describedby="condition-hint"
		/>
		<span id="condition-hint" class="field-hint">Enter a JavaScript expression to filter events</span>
	</div>

	<div class="field">
		<label for="agent-select">Assign to Agent</label>
		<select id="agent-select" bind:value={selectedAgentId} aria-required="true">
			<option value="">Select an agent</option>
			{#each agents as agent}
				<option value={agent.id}>{agent.name}</option>
			{/each}
		</select>
	</div>

	<div class="form-actions">
		<button class="cancel-btn" type="button" onclick={oncancel} aria-label="Cancel and close form">Cancel</button>
		<button
			class="submit-btn"
			type="button"
			onclick={handleSubmit}
			disabled={isSubmitDisabled}
			aria-label={isSubmitDisabled ? 'Fill in required fields to submit' : 'Add webhook rule'}
		>
			{submitting ? 'Adding...' : 'Add Rule'}
		</button>
	</div>
</div>

<style>
	.rule-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.field {
		display: flex;
		flex-direction: column;
	}

	label {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text);
		margin-bottom: var(--space-xs);
		display: block;
	}

	.optional-label {
		color: var(--text-muted);
		font-size: 11px;
	}

	.field-hint {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
		margin-top: 2px;
	}

	select,
	input {
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

	select:focus,
	input:focus {
		border-color: var(--rose, #F472B6);
		outline: none;
	}

	select:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.form-actions {
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

	.submit-btn {
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

	.submit-btn:hover:not(:disabled) {
		background: rgba(244, 114, 182, 0.08);
	}

	.submit-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
