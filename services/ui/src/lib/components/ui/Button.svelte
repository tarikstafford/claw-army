<script lang="ts">
  let {
    href,
    type = 'button',
    variant = 'primary',
    disabled = false,
    class: className = '',
    onclick,
    children,
  }: {
    href?: string;
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'ghost' | 'secondary' | 'nav';
    disabled?: boolean;
    class?: string;
    onclick?: ((event: MouseEvent) => void) | undefined;
    children?: import('svelte').Snippet;
  } = $props();
</script>

{#if href}
  <a
    href={href}
    class={`button ${variant} ${className}`.trim()}
    aria-disabled={disabled}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    type={type}
    class={`button ${variant} ${className}`.trim()}
    {disabled}
    {onclick}
  >
    {@render children?.()}
  </button>
{/if}

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 42px;
    padding: 0 18px;
    border-radius: 8px;
    border: 1px solid transparent;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-decoration: none;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
    cursor: pointer;
  }

  .button:disabled,
  .button[aria-disabled='true'] {
    opacity: 0.65;
    cursor: not-allowed;
    pointer-events: none;
  }

  .primary {
    background: var(--accent);
    color: #fff;
  }

  .primary:hover {
    background: var(--accent-m);
    transform: translateY(-1px);
    box-shadow: 0 10px 24px color-mix(in srgb, var(--accent) 28%, transparent);
  }

  .ghost {
    background: transparent;
    color: var(--text);
    border-color: var(--border);
  }

  .ghost:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .secondary {
    background: var(--card);
    color: var(--text-muted);
    border-color: var(--border);
  }

  .nav {
    min-height: 34px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 500;
  }
</style>
