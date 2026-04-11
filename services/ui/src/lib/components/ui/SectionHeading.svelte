<script lang="ts">
  let {
    eyebrow,
    title,
    emphasis = '',
  }: {
    eyebrow: string;
    title: string;
    emphasis?: string;
  } = $props();
</script>

<div class="section-heading">
  <span class="eyebrow">{eyebrow}</span>
  <h2>
    {title}
    {#if emphasis}
      <em>{emphasis}</em>
    {/if}
  </h2>
</div>

<style>
  .section-heading {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .eyebrow {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.12em;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  h2 {
    font-family: var(--font-display);
    font-size: clamp(28px, 3.4vw, 44px);
    line-height: 1.05;
    color: var(--text);
  }

  em {
    color: var(--accent);
    font-style: italic;
  }
</style>
