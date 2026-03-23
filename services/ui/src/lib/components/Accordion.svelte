<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		sublabel,
		meta,
		color,
		open = false,
		children
	}: {
		label: string;
		sublabel?: string;
		meta?: string;
		color: string;
		open?: boolean;
		children: Snippet;
	} = $props();

	let isOpen = $state(open);

	function toggle() {
		isOpen = !isOpen;
	}
</script>

<div class="accordion" style="--acc-color: {color}">
	<button class="accordion-header" onclick={toggle} aria-expanded={isOpen}>
		<div class="accordion-left">
			<span class="acc-dot" style="background: {color}"></span>
			<div class="acc-labels">
				<span class="acc-label">{label}</span>
				{#if sublabel}<span class="acc-sublabel">{sublabel}</span>{/if}
			</div>
		</div>
		<div class="accordion-right">
			{#if meta}<span class="acc-meta">{meta}</span>{/if}
			<span class="acc-arrow" class:open={isOpen}>&#9660;</span>
		</div>
	</button>
	<div class="accordion-body" class:open={isOpen}>
		<div class="accordion-inner">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.accordion {
		background: var(--bo-card);
		border: 1px solid var(--acc-color);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.accordion-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		cursor: pointer;
		background: none;
		border: none;
		width: 100%;
		text-align: left;
		color: inherit;
	}

	.accordion-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.accordion-right {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.acc-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.acc-labels {
		display: flex;
		flex-direction: column;
	}

	.acc-label {
		font-family: var(--font-label);
		font-size: 7px;
		color: var(--acc-color);
		margin-bottom: 5px;
		display: block;
	}

	.acc-sublabel {
		font-family: var(--font-body);
		font-size: 12px;
		color: rgba(236, 232, 255, 0.40);
		margin-top: 3px;
		display: block;
	}

	.acc-meta {
		font-family: var(--font-label);
		font-size: 7px;
		color: rgba(236, 232, 255, 0.40);
	}

	.acc-arrow {
		font-size: 11px;
		color: rgba(236, 232, 255, 0.35);
		transition: transform 0.2s;
		display: inline-block;
	}

	.acc-arrow.open {
		transform: rotate(180deg);
	}

	.accordion-body {
		max-height: 0;
		overflow: hidden;
		transition: max-height 0.3s ease;
	}

	.accordion-body.open {
		max-height: 600px;
	}

	.accordion-inner {
		padding: 0 20px 20px;
		border-top: 1px solid rgba(148, 110, 255, 0.12);
		font-family: var(--font-body);
		font-size: 14px;
		color: rgba(236, 232, 255, 0.55);
		line-height: 1.8;
	}
</style>
