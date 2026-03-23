<script lang="ts">
	let {
		tag,
		title,
		summary,
		ctaLabel = 'CLICK TO EXPAND \u2192',
		onclick
	}: {
		tag: string;
		title: string;
		summary: string;
		ctaLabel?: string;
		onclick?: () => void;
	} = $props();
</script>

<div
	class="mcard"
	role="button"
	tabindex="0"
	{onclick}
	onkeydown={(e) => e.key === 'Enter' && onclick?.()}
>
	<span class="mcard-tag">{tag}</span>
	<h3 class="mcard-title">{title}</h3>
	<p class="mcard-summary">{summary}</p>
	<span class="mcard-cta">{ctaLabel}</span>
</div>

<style>
	.mcard {
		background: var(--bo-card);
		border: 1px solid var(--bo-border);
		border-radius: var(--radius-md);
		padding: 18px 20px;
		cursor: pointer;
		transition: border-color 0.2s, transform 0.15s;
	}

	.mcard:hover {
		border-color: rgba(148, 110, 255, 0.38);
		transform: translateY(-2px);
	}

	.mcard-tag {
		font-family: var(--font-label);
		font-size: 6px;
		color: var(--bo-vb);
		letter-spacing: 0.10em;
		display: block;
		margin-bottom: 9px;
	}

	.mcard-title {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 600;
		color: var(--bo-text);
		margin-bottom: 6px;
		line-height: 1.2;
	}

	.mcard-summary {
		font-family: var(--font-body);
		font-size: 12px;
		font-style: italic;
		color: rgba(236, 232, 255, 0.42);
		line-height: 1.5;
	}

	.mcard-cta {
		font-family: var(--font-label);
		font-size: 5px;
		color: var(--bo-vb);
		display: block;
		margin-top: 10px;
		opacity: 0.65;
		letter-spacing: 0.05em;
	}
</style>
