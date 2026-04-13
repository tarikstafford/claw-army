<script lang="ts">
  let {
    variant = 'front-office',
    type = 'text',
    width = '100%',
    height = '16px',
    lines = 1,
  }: {
    variant?: 'front-office' | 'back-office';
    type?: 'text' | 'card' | 'avatar' | 'heading' | 'button';
    width?: string;
    height?: string;
    lines?: number;
  } = $props();
</script>

{#if type === 'card'}
  <div class="skeleton-card {variant}" style="width: {width}">
    <div class="skeleton-line heading" style="width: 60%; height: 20px;"></div>
    <div class="skeleton-line" style="width: 90%; height: 14px;"></div>
    <div class="skeleton-line" style="width: 75%; height: 14px;"></div>
  </div>
{:else if type === 'avatar'}
  <div class="skeleton-avatar {variant}" style="width: {width}; height: {height}"></div>
{:else if type === 'heading'}
  <div class="skeleton-line heading {variant}" style="width: {width}; height: {height}"></div>
{:else if type === 'button'}
  <div class="skeleton-button {variant}" style="width: {width}; height: {height}"></div>
{:else if type === 'text' && lines > 1}
  <div class="skeleton-text-group {variant}" style="width: {width}">
    {#each Array(lines) as _, i}
      <div
        class="skeleton-line {variant}"
        style="width: {i === lines - 1 ? '60%' : '100%'}; height: {height}"
      ></div>
    {/each}
  </div>
{:else}
  <div class="skeleton-line {variant}" style="width: {width}; height: {height}"></div>
{/if}

<style>
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  .skeleton-line,
  .skeleton-card,
  .skeleton-avatar,
  .skeleton-button {
    border-radius: var(--radius-md);
  }

  .front-office .skeleton-line,
  .front-office .skeleton-card,
  .front-office .skeleton-avatar,
  .front-office .skeleton-button {
    background: linear-gradient(
      90deg,
      var(--fo-bg2) 0%,
      var(--fo-bg3) 50%,
      var(--fo-bg2) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  .back-office .skeleton-line,
  .back-office .skeleton-card,
  .back-office .skeleton-avatar,
  .back-office .skeleton-button {
    background: linear-gradient(
      90deg,
      var(--bo-card) 0%,
      var(--bo-bhi) 50%,
      var(--bo-card) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  .skeleton-line.heading {
    height: 24px !important;
    border-radius: var(--radius-sm);
  }

  .skeleton-card {
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .skeleton-avatar {
    border-radius: 50%;
    flex-shrink: 0;
  }

  .skeleton-button {
    min-width: 80px;
    flex-shrink: 0;
  }

  .skeleton-text-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
</style>
