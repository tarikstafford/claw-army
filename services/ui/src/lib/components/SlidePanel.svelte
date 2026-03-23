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

<div class="slide-panel" class:open={open}>
	<div class="panel-header">
		<div class="panel-header-text">
			{#if tag}<span class="panel-tag">{tag}</span>{/if}
			<h2 class="panel-title">{title}</h2>
		</div>
		<button class="panel-close" onclick={onclose} aria-label="Close">&#10005;</button>
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
		background: #080714;
		border-left: 1px solid rgba(148, 110, 255, 0.30);
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
		border-bottom: 1px solid rgba(148, 110, 255, 0.12);
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
		color: var(--bo-vb);
		letter-spacing: 0.10em;
		display: block;
		margin-bottom: 7px;
	}

	.panel-title {
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 600;
		color: var(--bo-text);
		line-height: 1.2;
	}

	.panel-close {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: rgba(148, 110, 255, 0.12);
		border: 1px solid rgba(148, 110, 255, 0.25);
		color: var(--bo-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.panel-close:hover {
		background: var(--bo-violet);
		color: #fff;
		border-color: var(--bo-violet);
	}

	.panel-body {
		flex: 1;
		overflow-y: auto;
		padding: 20px 22px;
		scrollbar-width: thin;
		scrollbar-color: rgba(148, 110, 255, 0.20) transparent;
	}
</style>
