<script lang="ts">
  interface Props {
    rating?: number;
    maxStars?: number;
    interactive?: boolean;
    size?: 'sm' | 'md' | 'lg';
    onrate?: (rating: number) => void;
  }

  let {
    rating = 0,
    maxStars = 5,
    interactive = false,
    size = 'md',
    onrate,
  }: Props = $props();

  let hoveredStar = $state(0);

  function handleClick(star: number) {
    if (!interactive) return;
    onrate?.(star);
  }

  function handleMouseEnter(star: number) {
    if (!interactive) return;
    hoveredStar = star;
  }

  function handleMouseLeave() {
    if (!interactive) return;
    hoveredStar = 0;
  }

  const displayRating = $derived(hoveredStar > 0 ? hoveredStar : rating);
</script>

<div
  class="star-rating star-rating--{size}"
  class:star-rating--interactive={interactive}
  role={interactive ? 'radiogroup' : 'img'}
  aria-label={interactive ? 'Rate this item' : `Rating: ${rating} out of ${maxStars}`}
  onmouseleave={handleMouseLeave}
>
  {#each Array(maxStars) as _, i}
    {@const star = i + 1}
    {@const filled = star <= displayRating}
    {#if interactive}
      <button
        type="button"
        class="star"
        class:star--filled={filled}
        aria-label="{star} star{star > 1 ? 's' : ''}"
        onclick={() => handleClick(star)}
        onmouseenter={() => handleMouseEnter(star)}
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={filled ? 'currentColor' : 'none'}
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    {:else}
      <span class="star" class:star--filled={filled}>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={filled ? 'currentColor' : 'none'}
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    {/if}
  {/each}
</div>

<style>
  .star-rating {
    display: inline-flex;
    gap: 2px;
    align-items: center;
  }

  .star-rating--interactive {
    cursor: pointer;
  }

  .star {
    display: inline-flex;
    color: var(--bo-border);
    transition: color 0.15s;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    line-height: 1;
  }

  .star--filled {
    color: var(--bo-amber);
  }

  .star-rating--interactive .star:hover {
    color: var(--bo-amber);
  }

  .star-rating--interactive .star {
    cursor: pointer;
  }

  .star-rating--sm .star svg {
    width: 14px;
    height: 14px;
  }

  .star-rating--md .star svg {
    width: 18px;
    height: 18px;
  }

  .star-rating--lg .star svg {
    width: 24px;
    height: 24px;
  }
</style>
