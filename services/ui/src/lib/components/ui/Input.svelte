<script lang="ts">
  let {
    id,
    label,
    value = $bindable(''),
    placeholder = '',
    type = 'text',
    error = '',
  }: {
    id: string;
    label: string;
    value?: string;
    placeholder?: string;
    type?: string;
    error?: string;
  } = $props();

  const errorId = `${id}-error`;
</script>

<label class="field" for={id}>
  <span class="field-label" id={`${id}-label`}>{label}</span>
  <input
    bind:value
    class:error={!!error}
    {id}
    {type}
    {placeholder}
    aria-required="true"
    aria-invalid={!!error}
    aria-describedby={error ? errorId : undefined}
  />
  {#if error}
    <span class="field-error" id={errorId} role="alert">{error}</span>
  {/if}
</label>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  input {
    min-height: 44px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    font: inherit;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
  }

  input.error {
    border-color: var(--error);
  }

  .field-error {
    color: var(--error);
    font-size: 12px;
  }
</style>
