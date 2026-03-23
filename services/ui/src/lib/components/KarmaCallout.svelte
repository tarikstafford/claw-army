<script lang="ts">
	let { text }: { text: string } = $props();
</script>

<div class="karma-callout">
	<span class="karma-diamond">&#9670;</span>
	<span class="karma-text">{text}</span>
</div>

<style>
	.karma-callout {
		display: inline-flex;
		align-items: flex-start;
		gap: 6px;
		background: rgba(251, 191, 36, 0.10);
		border: 1px solid rgba(251, 191, 36, 0.30);
		border-radius: var(--radius-sm);
		padding: 8px 12px;
		margin-top: 8px;
	}

	.karma-diamond {
		color: var(--bo-amber);
		font-size: 12px;
		line-height: 1.6;
		flex-shrink: 0;
	}

	.karma-text {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--bo-amber);
		line-height: 1.6;
	}
</style>
