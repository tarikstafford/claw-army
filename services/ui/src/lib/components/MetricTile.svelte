<script lang="ts">
  let { label, value, sub }: { label: string; value: string; sub?: string } = $props();
</script>

<div class="metric-tile">
  <span class="metric-label">{label}</span>
  <span class="metric-value">{value}</span>
  {#if sub}<span class="metric-sub">{sub}</span>{/if}
</div>

<style>
  .metric-tile {
    background: #fff;
    border: 1px solid var(--fo-rule);
    box-shadow: 2px 2px 0 var(--fo-bg3);
    padding: 12px 14px;
    border-radius: var(--radius-md);
  }

  .metric-label {
    font-family: var(--font-label);
    font-size: 5px;
    color: var(--muted);
    letter-spacing: 0.10em;
    display: block;
    margin-bottom: 7px;
  }

  .metric-value {
    font-family: var(--font-label);
    font-size: 20px;
    color: var(--ink);
    line-height: 1;
    display: block;
  }

  .metric-sub {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--muted);
    display: block;
    margin-top: 3px;
  }
</style>
