<script lang="ts">
  let { children } = $props();
</script>

<div class="onboarding-shell">
  {@render children()}
</div>

<style>
  .onboarding-shell {
    min-height: 100vh;
    background: var(--fo-bg, #F5F2EC);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
</style>
