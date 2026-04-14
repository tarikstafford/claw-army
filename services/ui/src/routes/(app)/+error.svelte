<script lang="ts">
  import { page } from '$app/stores';
</script>

<div class="error-page">
  <h1 class="error-code">{$page.status}</h1>
  <p class="error-message">
    {#if $page.status === 404}
      Nothing here. <a href="/">Head back to the briefing.</a>
    {:else}
      Something went wrong. Try refreshing - if this keeps happening, check your connection.
    {/if}
  </p>
</div>

<style>
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 44px);
    text-align: center;
    padding: var(--space-2xl);
  }

  .error-code {
    font-family: var(--font-display);
    font-size: clamp(48px, 8vw, 80px);
    font-weight: 600;
    color: var(--muted);
    margin: 0 0 var(--space-md) 0;
  }

  .error-message {
    font-family: var(--font-body);
    font-size: 16px;
    color: var(--muted);
    line-height: 1.65;
  }

  .error-message a {
    color: var(--accent);
    text-decoration: underline;
  }
</style>
