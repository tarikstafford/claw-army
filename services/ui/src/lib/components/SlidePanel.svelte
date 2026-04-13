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

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onclose();
		}
	}
</script>

<div
	class="slide-panel"
	class:open={open}
	onkeydown={handleKeydown}
	role="dialog"
	aria-modal="true"
	aria-labelledby="panel-title"
>
	<div class="panel-header">
		<div class="panel-header-text">
			{#if tag}<span class="panel-tag">{tag}</span>{/if}
			<h2 class="panel-title" id="panel-title">{title}</h2>
		</div>
		<button class="panel-close" onclick={onclose} aria-label="Close panel">&#10005;</button>
	</div>
	<div class="panel-body">
		{@render children()}
	</div>
</div>

<style>
	.slide-panel {
		position: fixed;
		top: 44px;
		right: 0;
		width: 380px;
		height: calc(100vh - 44px);
		background: var(--card);
		border-left: 1px solid var(--border);
		z-index: 200;
		display: flex;
		flex-direction: column;
		transform: translateX(100%);
		transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.slide-panel.open {
		transform: translateX(0);
	}

	.panel-header {
		padding: 20px 22px;
		border-bottom: 1px solid var(--border);
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		flex-shrink: 0;
	}

	.panel-header-text {
		display: flex;
		flex-direction: column;
	}

	.panel-tag {
		font-family: var(--font-label);
		font-size: 6px;
		color: var(--accent);
		letter-spacing: 0.10em;
		display: block;
		margin-bottom: 7px;
	}

	.panel-title {
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 600;
		color: var(--text);
		line-height: 1.2;
	}

	.panel-close {
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

	.panel-close:hover {
		background: var(--accent);
		color: #fff;
		border-color: var(--accent);
	}

	.panel-body {
		flex: 1;
		overflow-y: auto;
		padding: 20px 22px;
		scrollbar-width: thin;
		scrollbar-color: var(--accent-dim) transparent;
	}
</style>
