<script lang="ts">
  let { children } = $props();
</script>

<div class="onboarding-shell">
  {@render children()}
</div>

<style>
  .onboarding-shell {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 120px 24px 48px;
    position: relative;
    z-index: 1;
  }
</style>
