<script lang="ts">
  import { goto } from '$app/navigation';
  import { createExecution } from '$lib/api';

  const AVAILABLE_TOOLS = ['llm_call', 'fetch_url', 'write_file'];

  let objective = $state('');
  let maxBots = $state(3);
  let budgetCapDollars = $state(10);
  let allowedTools = $state<string[]>(['llm_call', 'fetch_url', 'write_file']);
  let submitting = $state(false);
  let error = $state<string | null>(null);

  async function handleSubmit() {
    if (!objective.trim()) {
      error = 'Objective is required.';
      return;
    }

    submitting = true;
    error = null;

    try {
      const result = await createExecution({
        objective: objective.trim(),
        maxBots,
        budgetCapCents: budgetCapDollars * 100,
        allowedTools,
      });
      await goto(`/executions/${result.executionId}`);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create execution. Please try again.';
      submitting = false;
    }
  }

  function toggleTool(tool: string) {
    if (allowedTools.includes(tool)) {
      allowedTools = allowedTools.filter((t) => t !== tool);
    } else {
      allowedTools = [...allowedTools, tool];
    }
  }
</script>

<svelte:head>
  <title>New Execution | Claw Army</title>
</svelte:head>

<div class="page">
  <h1>New Execution</h1>
  <p class="subtitle">Define a goal and deploy a crew of AI bots to accomplish it.</p>

  <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
    <div class="field">
      <label for="objective">Objective</label>
      <textarea
        id="objective"
        bind:value={objective}
        placeholder="Describe what you want the bot crew to accomplish..."
        rows="4"
        required
      ></textarea>
    </div>

    <div class="field">
      <label for="maxBots">Bot Count — <strong>{maxBots} bots</strong></label>
      <input
        id="maxBots"
        type="range"
        bind:value={maxBots}
        min="1"
        max="20"
        step="1"
      />
      <div class="range-labels">
        <span>1</span>
        <span>20</span>
      </div>
    </div>

    <div class="field">
      <label for="budgetCap">Budget Cap ($)</label>
      <input
        id="budgetCap"
        type="number"
        bind:value={budgetCapDollars}
        min="1"
        step="1"
      />
    </div>

    <div class="field">
      <fieldset>
        <legend>Allowed Tools</legend>
        {#each AVAILABLE_TOOLS as tool}
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={allowedTools.includes(tool)}
              onchange={() => toggleTool(tool)}
            />
            {tool}
          </label>
        {/each}
      </fieldset>
    </div>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <button type="submit" disabled={submitting}>
      {submitting ? 'Deploying...' : 'Deploy Crew'}
    </button>
  </form>
</div>

<style>
  .page {
    max-width: 600px;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    color: #555;
    margin-bottom: 2rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-weight: 600;
    font-size: 0.9rem;
  }

  textarea {
    width: 100%;
    padding: 0.625rem;
    font-family: inherit;
    font-size: 0.95rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    resize: vertical;
  }

  textarea:focus,
  input[type='number']:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
  }

  input[type='range'] {
    width: 100%;
    accent-color: #0066cc;
  }

  .range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: #777;
  }

  input[type='number'] {
    width: 140px;
    padding: 0.5rem;
    font-family: inherit;
    font-size: 0.95rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  fieldset {
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  legend {
    font-weight: 600;
    font-size: 0.9rem;
    padding: 0 0.25rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: normal;
    cursor: pointer;
  }

  .error {
    color: #cc0000;
    font-size: 0.9rem;
    padding: 0.5rem;
    background: #fff5f5;
    border: 1px solid #ffcccc;
    border-radius: 4px;
  }

  button[type='submit'] {
    align-self: flex-start;
    padding: 0.625rem 1.5rem;
    background: #0066cc;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  button[type='submit']:hover:not(:disabled) {
    background: #0052a3;
  }

  button[type='submit']:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
