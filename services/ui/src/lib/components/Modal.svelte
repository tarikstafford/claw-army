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

	let dialogEl: HTMLDivElement | undefined = $state();
	let previousFocus: HTMLElement | null = null;

	$effect(() => {
		if (open) {
			previousFocus = document.activeElement as HTMLElement;
			dialogEl?.focus();
		} else if (previousFocus) {
			previousFocus.focus();
			previousFocus = null;
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
		if (e.key === 'Tab') {
			const focusable = dialogEl?.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			if (!focusable || focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}
</script>

{#if open}
<div
	class="modal-overlay"
	onclick={onclose}
	onkeydown={handleKeydown}
	role="dialog"
	aria-modal="true"
	aria-labelledby="modal-title"
	tabindex="-1"
	bind:this={dialogEl}
>
	<div class="modal-box" onclick={(e) => e.stopPropagation()}>
		<div class="modal-header">
			<div class="modal-header-text">
				{#if tag}<span class="modal-tag">{tag}</span>{/if}
				<h2 class="modal-title" id="modal-title">{title}</h2>
			</div>
			<button class="modal-close" onclick={onclose} aria-label="Close modal">&#10005;</button>
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
		color: white;
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
