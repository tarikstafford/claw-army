<script lang="ts">
  let {
    class: className = '',
    children,
  }: {
    class?: string;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<div class={`card ${className}`.trim()}>
  {@render children?.()}
</div>

<style>
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 12px 30px rgba(14, 13, 11, 0.06);
  }
</style>
