<script lang="ts">
  let { status }: { status: string } = $props();

  const colorMap: Record<string, string> = {
    connected: 'var(--bo-teal)',
    expired: 'var(--bo-amber)',
    rate_limited: 'var(--bo-amber)',
    errored: 'var(--error)',
    disconnected: 'var(--bo-faint)',
  };

  const color = $derived(colorMap[status] ?? 'var(--bo-faint)');
  const label = $derived(status.toUpperCase().replace(/_/g, ' '));
</script>

<span class="badge" style="border-color: {color}; color: {color};">{label}</span>

<style>
  .badge {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.08em;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    display: inline-flex;
    align-items: center;
    background: transparent;
    border: 1px solid;
    line-height: 1.0;
    white-space: nowrap;
  }
</style>
