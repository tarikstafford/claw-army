<script lang="ts">
  let {
    icon = '○',
    eyebrow = '',
    title,
    description = '',
    ctaLabel = '',
    href = '',
    onclick,
    variant = 'front-office',
  }: {
    icon?: string;
    eyebrow?: string;
    title: string;
    description?: string;
    ctaLabel?: string;
    href?: string;
    onclick?: (() => void) | undefined;
    variant?: 'front-office' | 'back-office';
  } = $props();
</script>

<div class="empty-state {variant}" role="status" aria-busy="false">
  <span class="empty-icon" aria-hidden="true">{icon}</span>
  {#if eyebrow}
    <span class="empty-eyebrow">{eyebrow}</span>
  {/if}
  <p class="empty-heading">{title}</p>
  {#if description}
    <p class="empty-description">{description}</p>
  {/if}
  {#if ctaLabel}
    {#if href}
      <a {href} class="empty-cta">{ctaLabel}</a>
    {:else if onclick}
      <button type="button" class="empty-cta" on:click={onclick}>{ctaLabel}</button>
    {/if}
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    padding: var(--space-3xl) var(--space-lg);
    text-align: center;
  }

  .empty-icon {
    font-size: 40px;
    line-height: 1;
    opacity: 0.4;
  }

  .empty-eyebrow {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .front-office .empty-eyebrow {
    color: var(--text-muted);
  }

  .back-office .empty-eyebrow {
    color: var(--bo-faint);
  }

  .empty-heading {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    margin: 0;
  }

  .front-office .empty-heading {
    color: var(--fo-plum);
  }

  .back-office .empty-heading {
    color: var(--bo-text);
  }

  .empty-description {
    font-family: var(--font-body);
    font-size: 13px;
    max-width: 320px;
    margin: 0;
    line-height: 1.5;
  }

  .front-office .empty-description {
    color: var(--text-muted);
  }

  .back-office .empty-description {
    color: var(--bo-faint);
  }

  .empty-cta {
    display: inline-flex;
    align-items: center;
    padding: 10px 18px;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    border-radius: var(--radius-md);
    border: none;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
    margin-top: var(--space-sm);
  }

  .front-office .empty-cta {
    background: var(--fo-plum);
    color: #fff;
  }

  .front-office .empty-cta:hover {
    background: var(--fo-plum-m);
    transform: translateY(-1px);
  }

  .back-office .empty-cta {
    background: var(--bo-violet);
    color: #fff;
  }

  .back-office .empty-cta:hover {
    background: color-mix(in srgb, var(--bo-violet) 85%, white);
    transform: translateY(-1px);
  }
</style>
