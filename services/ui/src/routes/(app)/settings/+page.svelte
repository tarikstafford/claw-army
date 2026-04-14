<script lang="ts">
  // This page redirects to /settings/tools via +page.server.ts.
  // This component is a fallback that should not render.
</script>

<div class="redirect-fallback">
  <p>Redirecting to settings...</p>
</div>

<style>
  .redirect-fallback {
    padding: 40px;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--muted);
  }
</style>
