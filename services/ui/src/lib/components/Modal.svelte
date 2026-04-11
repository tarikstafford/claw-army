<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open,
		tag,
		title,
		onclose,
		children
	}: {
		open: boolean;
		tag?: string;
		title: string;
		onclose: () => void;
		children: Snippet;
	} = $props();
</script>

{#if open}
<div class="modal-overlay" onclick={onclose} role="dialog" aria-modal="true">
	<div class="modal-box" onclick={(e) => e.stopPropagation()}>
		<div class="modal-header">
			<div class="modal-header-text">
				{#if tag}<span class="modal-tag">{tag}</span>{/if}
				<h2 class="modal-title">{title}</h2>
			</div>
			<button class="modal-close" onclick={onclose} aria-label="Close">&#10005;</button>
		</div>
		<div class="modal-body">
			{@render children()}
		</div>
	</div>
</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 9000;
		background: color-mix(in srgb, var(--text) 35%, transparent);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-box {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		width: 560px;
		max-width: calc(100vw - 40px);
		max-height: 80vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		padding: 22px 26px;
		border-bottom: 1px solid var(--border);
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		position: sticky;
		top: 0;
		background: var(--card);
		z-index: 1;
		flex-shrink: 0;
	}

	.modal-header-text {
		display: flex;
		flex-direction: column;
	}

	.modal-tag {
		font-family: var(--font-label);
		font-size: 6px;
		color: var(--accent);
		letter-spacing: 0.10em;
		display: block;
		margin-bottom: 7px;
	}

	.modal-title {
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 600;
		color: var(--text);
	}

	.modal-close {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--accent-dim);
		border: 1px solid var(--border);
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.modal-close:hover {
		background: var(--accent);
		color: #fff;
		border-color: var(--accent);
	}

	.modal-body {
		padding: 22px 26px;
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-muted);
		line-height: 1.85;
	}
</style>
