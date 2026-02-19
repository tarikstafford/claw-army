<script lang="ts">
  import { goto } from '$app/navigation';
  import { createExecution } from '$lib/api';

  const TOOLS: { id: string; label: string; description: string }[] = [
    { id: 'llm_call',   label: 'LLM Call',   description: 'Prompt any language model' },
    { id: 'fetch_url',  label: 'Web Fetch',  description: 'Retrieve content from URLs' },
    { id: 'write_file', label: 'File Write', description: 'Write output to the filesystem' },
  ];

  let objective         = $state('');
  let maxBots           = $state(3);
  let budgetCapDollars  = $state(10);
  let allowedTools      = $state<string[]>(['llm_call', 'fetch_url', 'write_file']);
  let submitting        = $state(false);
  let error             = $state<string | null>(null);

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

  function toggleTool(id: string) {
    if (allowedTools.includes(id)) {
      allowedTools = allowedTools.filter((t) => t !== id);
    } else {
      allowedTools = [...allowedTools, id];
    }
  }
</script>

<svelte:head>
  <title>New Mission | Claw Army</title>
</svelte:head>

<div class="briefing">
  <div class="briefing-header">
    <a href="/" class="back-link">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Home
    </a>
    <div class="header-meta">
      <span class="briefing-tag">MISSION BRIEFING</span>
    </div>
    <h1>Define your objective</h1>
    <p class="briefing-sub">Configure the mission parameters. Your crew stands by.</p>
  </div>

  <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>

    <!-- Objective -->
    <div class="panel">
      <div class="panel-label">
        <span class="panel-tag">01</span>
        Mission Objective
      </div>
      <textarea
        id="objective"
        bind:value={objective}
        placeholder="Describe what you want the bot crew to accomplish. Be specific about the desired outcome — the bots will plan and execute the tasks needed to get there."
        rows="5"
        required
      ></textarea>
    </div>

    <!-- Crew Config -->
    <div class="row-panels">
      <div class="panel">
        <div class="panel-label">
          <span class="panel-tag">02</span>
          Crew Size
        </div>
        <div class="crew-control">
          <div class="crew-value">
            <span class="crew-num">{maxBots}</span>
            <span class="crew-unit">bots</span>
          </div>
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
            <span>20 max</span>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-label">
          <span class="panel-tag">03</span>
          Budget Cap
        </div>
        <div class="budget-control">
          <div class="budget-input-wrap">
            <span class="currency">$</span>
            <input
              id="budgetCap"
              type="number"
              bind:value={budgetCapDollars}
              min="1"
              step="1"
            />
          </div>
          <p class="budget-hint">Hard ceiling. Execution stops when this is reached.</p>
        </div>
      </div>
    </div>

    <!-- Tool Permissions -->
    <div class="panel">
      <div class="panel-label">
        <span class="panel-tag">04</span>
        Tool Permissions
      </div>
      <p class="panel-hint">Grant bots access to these capabilities. Unchecked tools are blocked entirely.</p>
      <div class="tools-grid">
        {#each TOOLS as tool}
          <button
            type="button"
            class="tool-toggle"
            class:active={allowedTools.includes(tool.id)}
            onclick={() => toggleTool(tool.id)}
          >
            <div class="tool-indicator">
              {#if allowedTools.includes(tool.id)}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              {:else}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              {/if}
            </div>
            <div class="tool-info">
              <span class="tool-label">{tool.label}</span>
              <span class="tool-desc">{tool.description}</span>
            </div>
            <span class="tool-status">{allowedTools.includes(tool.id) ? 'ALLOWED' : 'BLOCKED'}</span>
          </button>
        {/each}
      </div>
    </div>

    {#if error}
      <div class="error-banner">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
          <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        {error}
      </div>
    {/if}

    <button type="submit" class="launch-btn" disabled={submitting}>
      {#if submitting}
        <span class="launch-spinner"></span>
        Deploying crew...
      {:else}
        Launch Mission
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      {/if}
    </button>

  </form>
</div>

<style>
  .briefing {
    max-width: 760px;
    margin: 0 auto;
  }

  /* ── Header ── */
  .briefing-header {
    margin-bottom: var(--s-8);
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    font-size: 0.8125rem;
    color: var(--text-muted);
    margin-bottom: var(--s-5);
    transition: color 0.15s;
  }

  .back-link:hover {
    color: var(--text-secondary);
  }

  .header-meta {
    margin-bottom: var(--s-3);
  }

  .briefing-tag {
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--signal);
    background: var(--signal-tint);
    border: 1px solid var(--signal-border);
    padding: 0.1875rem 0.5rem;
    border-radius: var(--r-sm);
  }

  .briefing-header h1 {
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin-bottom: var(--s-2);
  }

  .briefing-sub {
    font-size: 0.9375rem;
    color: var(--text-secondary);
  }

  /* ── Form ── */
  form {
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
  }

  /* ── Panels ── */
  .panel {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    padding: var(--s-5) var(--s-6);
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }

  .panel-label {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .panel-tag {
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 0.6875rem;
    color: var(--signal);
    letter-spacing: 0.04em;
  }

  .panel-hint {
    font-size: 0.8125rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  /* ── Objective ── */
  textarea {
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    padding: var(--s-4);
    font-family: inherit;
    font-size: 0.9375rem;
    color: var(--text-primary);
    line-height: 1.65;
    resize: vertical;
    transition: border-color 0.15s;
    min-height: 120px;
  }

  textarea::placeholder {
    color: var(--text-muted);
  }

  textarea:focus {
    outline: none;
    border-color: var(--signal-border);
    box-shadow: 0 0 0 3px var(--signal-tint);
  }

  /* ── Row panels ── */
  .row-panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-4);
  }

  /* ── Crew control ── */
  .crew-control {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }

  .crew-value {
    display: flex;
    align-items: baseline;
    gap: var(--s-2);
  }

  .crew-num {
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .crew-unit {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--signal);
    height: 4px;
    cursor: pointer;
  }

  .range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.6875rem;
    color: var(--text-muted);
    font-family: ui-monospace, 'SF Mono', monospace;
  }

  /* ── Budget control ── */
  .budget-control {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }

  .budget-input-wrap {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    padding: 0.5rem var(--s-4);
    width: fit-content;
    transition: border-color 0.15s;
  }

  .budget-input-wrap:focus-within {
    border-color: var(--signal-border);
    box-shadow: 0 0 0 3px var(--signal-tint);
  }

  .currency {
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 1rem;
    color: var(--text-muted);
  }

  input[type='number'] {
    background: transparent;
    border: none;
    outline: none;
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    width: 90px;
    -moz-appearance: textfield;
  }

  input[type='number']::-webkit-outer-spin-button,
  input[type='number']::-webkit-inner-spin-button {
    -webkit-appearance: none;
  }

  .budget-hint {
    font-size: 0.8125rem;
    color: var(--text-muted);
    line-height: 1.5;
  }

  /* ── Tool toggles ── */
  .tools-grid {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }

  .tool-toggle {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    padding: var(--s-3) var(--s-4);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    text-align: left;
  }

  .tool-toggle:hover {
    border-color: rgba(255, 255, 255, 0.12);
    background: var(--surface-3);
  }

  .tool-toggle.active {
    border-color: var(--active-border);
    background: var(--active-tint);
  }

  .tool-indicator {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--surface-3);
    color: var(--text-muted);
    border: 1px solid var(--border);
    transition: all 0.15s;
  }

  .tool-toggle.active .tool-indicator {
    background: var(--active-tint);
    color: var(--active);
    border-color: var(--active-border);
  }

  .tool-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
  }

  .tool-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .tool-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .tool-status {
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 0.1875rem 0.4375rem;
    border-radius: var(--r-sm);
    background: var(--surface-0);
    color: var(--text-muted);
    border: 1px solid var(--border);
    transition: all 0.15s;
  }

  .tool-toggle.active .tool-status {
    color: var(--active);
    background: var(--active-tint);
    border-color: var(--active-border);
  }

  /* ── Error ── */
  .error-banner {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-3) var(--s-4);
    background: var(--critical-tint);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--r-sm);
    font-size: 0.875rem;
    color: var(--critical);
  }

  /* ── Launch button ── */
  .launch-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--s-2);
    width: 100%;
    padding: 0.875rem var(--s-6);
    background: var(--signal);
    color: #fff;
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    border: none;
    border-radius: var(--r-sm);
    cursor: pointer;
    transition: background 0.15s;
    margin-top: var(--s-2);
  }

  .launch-btn:hover:not(:disabled) {
    background: #5a8fff;
  }

  .launch-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .launch-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .row-panels {
      grid-template-columns: 1fr;
    }
  }
</style>
