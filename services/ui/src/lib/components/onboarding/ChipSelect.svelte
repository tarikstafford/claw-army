<script lang="ts">
  let { options, allowFreeText = false, onselect }: {
    options: string[];
    allowFreeText?: boolean;
    onselect: (value: string) => void;
  } = $props();

  let freeText = $state('');
  let showInput = $state(false);

  function handleChip(value: string) {
    onselect(value);
  }

  function handleFreeText() {
    if (freeText.trim()) {
      onselect(freeText.trim());
      freeText = '';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFreeText();
    }
  }
</script>

<div class="chip-group" role="group" aria-label="Select an option">
  {#each options as option}
    <button class="chip" type="button" onclick={() => handleChip(option)} aria-label={option}>
      {option}
    </button>
  {/each}

  {#if allowFreeText}
    {#if showInput}
      <div class="free-input">
        <input
          type="text"
          bind:value={freeText}
          onkeydown={handleKeydown}
          placeholder="Type your own..."
          aria-label="Custom option input"
        />
        <button class="send-btn" type="button" onclick={handleFreeText} disabled={!freeText.trim()} aria-label="Submit custom option">
          &#9654;
        </button>
      </div>
    {:else}
      <button class="chip chip-other" type="button" onclick={() => showInput = true} aria-label="Enter custom option">
        Something else...
      </button>
    {/if}
  {/if}
</div>

<style>
  .chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .chip {
    font-family: 'Press Start 2P', monospace;
    font-size: 6px;
    padding: 8px 12px;
    background: var(--fo-bg, #F5F2EC);
    border: 1px solid rgba(14, 13, 11, 0.10);
    color: var(--muted, #7A766D);
    cursor: pointer;
    transition: all 0.15s;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-radius: 4px;
  }

  .chip:hover {
    background: var(--fo-bg3, #E5E0D5);
    color: var(--ink, #0E0D0B);
    border-color: var(--fo-plum, #3D3560);
  }

  .chip-other {
    border-style: dashed;
    opacity: 0.7;
  }

  .chip-other:hover {
    opacity: 1;
  }

  .free-input {
    display: flex;
    gap: 6px;
    width: 100%;
    margin-top: 4px;
  }

  .free-input input {
    flex: 1;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    padding: 8px 12px;
    border: 1px solid var(--fo-border, #D9CEBB);
    border-radius: 6px;
    background: var(--fo-card, #FDFAF6);
    color: var(--ink, #0E0D0B);
    outline: none;
    transition: border-color 0.2s;
  }

  .free-input input:focus {
    border-color: var(--fo-plum, #3D3560);
  }

  .send-btn {
    padding: 8px 14px;
    background: var(--fo-plum, #3D3560);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11px;
    transition: opacity 0.15s;
  }

  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
