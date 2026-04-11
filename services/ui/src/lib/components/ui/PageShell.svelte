<script lang="ts">
  let {
    width = '1120px',
    class: className = '',
    children,
  }: {
    width?: string;
    class?: string;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<div class={`page-shell ${className}`.trim()} style={`--page-shell-width:${width};`}>
  {@render children?.()}
</div>

<style>
  .page-shell {
    width: min(var(--page-shell-width), calc(100% - 48px));
    margin: 0 auto;
    position: relative;
    z-index: 1;
  }
</style>
