<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import type { ActionData } from './$types';
  import { getArmyBuilderAnalysis } from '$lib/api';
  import type { ArmyBuilderAnalysis } from '$lib/types';

  const LLM_PROVIDERS: { id: string; label: string; description: string }[] = [
    { id: 'anthropic', label: 'Anthropic', description: 'Claude models via Anthropic API' },
    { id: 'openai',    label: 'OpenAI',    description: 'GPT models via OpenAI API' },
  ];

  const DEFAULT_DOMAINS = 'api.anthropic.com, api.openai.com, github.com, objects.githubusercontent.com, registry.npmjs.org';

  let { form } = $props<{ form: ActionData }>();

  let objective        = $state('');
  let maxBots          = $state(3);
  let budgetCapDollars = $state(10);
  let llmProvider      = $state('anthropic');
  let allowedDomains   = $state(DEFAULT_DOMAINS);
  let submitting       = $state(false);
  let objectiveId      = $state('');

  const urlObjectiveId = $derived(page.url.searchParams.get('objectiveId') ?? '');
  const urlMaxBots = $derived(Number(page.url.searchParams.get('maxBots') ?? '0'));
  const urlBudgetCapDollars = $derived(Number(page.url.searchParams.get('budgetCapDollars') ?? '0'));

  $effect(() => {
    if (urlObjectiveId) {
      objectiveId = urlObjectiveId;
    }
    if (urlMaxBots > 0) {
      maxBots = urlMaxBots;
    }
    if (urlBudgetCapDollars > 0) {
      budgetCapDollars = urlBudgetCapDollars;
    }
  });

  let armyAnalysis = $state<ArmyBuilderAnalysis | null>(null);
  let analysisLoading = $state(false);
  let analysisError = $state<string | null>(null);

  let error = $derived(form?.error ?? null);
  let submissionBlocked = $derived(armyAnalysis?.blocked ?? false);

  async function analyzeObjective() {
    if (!objective.trim()) return;
    analysisLoading = true;
    analysisError = null;
    try {
      armyAnalysis = await getArmyBuilderAnalysis(objective, maxBots);
    } catch (err) {
      analysisError = (err as Error).message;
      armyAnalysis = null;
    } finally {
      analysisLoading = false;
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

  <form
    method="POST"
    use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        submitting = false;
        await update({ reset: false });
      };
    }}
  >
    {#if objectiveId}
      <input type="hidden" name="objectiveId" value={objectiveId} />
    {/if}

    <!-- Objective -->
    <div class="panel">
      <div class="panel-label">
        <span class="panel-tag">01</span>
        Mission Objective
      </div>
      <textarea
        id="objective"
        name="objective"
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
            name="maxBots"
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
              name="budgetCapDollars"
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

    <!-- LLM Provider + Egress Perimeter -->
    <div class="row-panels">

      <div class="panel">
        <div class="panel-label">
          <span class="panel-tag">04</span>
          LLM Provider
        </div>
        <p class="panel-hint">Which model powers the crew.</p>
        <div class="tools-grid">
          {#each LLM_PROVIDERS as provider}
            <button
              type="button"
              class="tool-toggle"
              class:active={llmProvider === provider.id}
              onclick={() => llmProvider = provider.id}
            >
              <div class="tool-indicator">
                {#if llmProvider === provider.id}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                {:else}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <circle cx="5" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                {/if}
              </div>
              <div class="tool-info">
                <span class="tool-label">{provider.label}</span>
                <span class="tool-desc">{provider.description}</span>
              </div>
              {#if llmProvider === provider.id}
                <span class="tool-status">SELECTED</span>
              {/if}
            </button>
          {/each}
        </div>
        <input type="hidden" name="llmProvider" value={llmProvider} />
      </div>

      <div class="panel">
        <div class="panel-label">
          <span class="panel-tag">05</span>
          Egress Perimeter
        </div>
        <p class="panel-hint">Domains bots can reach via the proxy. All other outbound traffic is blocked.</p>
        <textarea
          id="allowedDomains"
          name="allowedDomains"
          bind:value={allowedDomains}
          rows="4"
          spellcheck="false"
          class="domains-input"
        ></textarea>
      </div>

    </div>

    <!-- Army Builder Analysis (UIEX-04) -->
    <div class="panel" id="army-analysis">
      <div class="panel-label">
        <span class="panel-tag">06</span>
        Army Composition Analysis
      </div>
      <p class="panel-hint">Analyze your objective to see the available agent pool and composition tiers.</p>

      <button
        type="button"
        class="analyze-btn"
        onclick={analyzeObjective}
        disabled={analysisLoading || !objective.trim()}
      >
        {#if analysisLoading}
          <span class="launch-spinner"></span>
          Analyzing...
        {:else}
          Analyze Objective
        {/if}
      </button>

      {#if analysisError}
        <div class="analysis-error">{analysisError}</div>
      {/if}

      {#if armyAnalysis}
        <!-- Detected Categories -->
        <div class="analysis-section">
          <h3 class="analysis-heading">Task Categories Detected</h3>
          <div class="category-tags">
            {#each armyAnalysis.categories as cat}
              <span class="category-tag">{cat}</span>
            {/each}
          </div>
        </div>

        <!-- Library Depth -->
        <div class="analysis-section">
          <h3 class="analysis-heading">Agent Library Depth</h3>
          <p class="analysis-hint">Available agents in the DNA library for each detected category.</p>
          <div class="depth-table-wrapper">
            <table class="depth-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Novice</th>
                  <th>Understudy</th>
                  <th>Artisan</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {#each armyAnalysis.libraryDepth as depth}
                  <tr>
                    <td class="cat-name">{depth.taskCategory}</td>
                    <td>{depth.noviceCount}</td>
                    <td>{depth.understudyCount}</td>
                    <td>{depth.artisanCount}</td>
                    <td class="total-cell">{depth.totalAgents}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if armyAnalysis.libraryDepth.every(d => d.totalAgents === 0)}
            <p class="library-empty-note">No existing agents found for these categories. New Novice agents will be spawned.</p>
          {/if}
        </div>

        <!-- Budget Tiers -->
        <div class="analysis-section">
          <h3 class="analysis-heading">Composition Tiers</h3>
          <div class="tier-cards">
            <div class="tier-card">
              <span class="tier-card-label">FULL</span>
              <span class="tier-card-value">{armyAnalysis.budgetTiers.full.agentCount} agents</span>
              <span class="tier-card-detail">{armyAnalysis.budgetTiers.full.label}</span>
            </div>
            <div class="tier-card">
              <span class="tier-card-label">75%</span>
              <span class="tier-card-value">{armyAnalysis.budgetTiers.reduced.agentCount} agents</span>
              <span class="tier-card-detail">{armyAnalysis.budgetTiers.reduced.label}</span>
            </div>
            <div class="tier-card tier-card-minimum">
              <span class="tier-card-label">MINIMUM</span>
              <span class="tier-card-value">{armyAnalysis.budgetTiers.minimumViable.agentCount} agents</span>
              <span class="tier-card-detail">{armyAnalysis.budgetTiers.minimumViable.label}</span>
            </div>
          </div>
        </div>

        <!-- Block Warning -->
        {#if armyAnalysis.blocked}
          <div class="block-warning">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
              <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            {armyAnalysis.blockReason}
          </div>
        {/if}
      {/if}
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

    <button type="submit" class="launch-btn" disabled={submitting || submissionBlocked}>
      {#if submissionBlocked}
        Blocked — Adjust Crew Size
      {:else if submitting}
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

  /* ── Domains input ── */
  .domains-input {
    font-family: ui-monospace, 'SF Mono', 'Cascadia Mono', monospace;
    font-size: 0.8125rem;
    line-height: 1.7;
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

    .tier-cards {
      grid-template-columns: 1fr;
    }
  }

  /* ── Army Builder Analysis ── */
  .analyze-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--s-2);
    padding: 0.625rem var(--s-4);
    background: var(--surface-3, #1f2937);
    color: var(--text-primary, #f9fafb);
    font-size: 0.875rem;
    font-weight: 600;
    border: 1px solid var(--border, #374151);
    border-radius: var(--r-sm);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    width: fit-content;
  }

  .analyze-btn:hover:not(:disabled) {
    background: var(--surface-2, #374151);
    border-color: var(--text-muted, #6b7280);
  }

  .analyze-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .analysis-error {
    padding: 0.625rem 0.875rem;
    background: var(--critical-tint, #1f0909);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--r-sm);
    font-size: 0.8125rem;
    color: var(--critical, #f87171);
  }

  .analysis-section {
    padding-top: var(--s-3);
    border-top: 1px solid var(--border, #1f2937);
  }

  .analysis-heading {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-secondary, #9ca3af);
    margin: 0 0 var(--s-2);
  }

  .analysis-hint {
    font-size: 0.8125rem;
    color: var(--text-muted, #6b7280);
    margin: 0 0 var(--s-3);
  }

  .category-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
  }

  .category-tag {
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.625rem;
    background: var(--signal-tint, rgba(61, 126, 255, 0.08));
    color: var(--signal, #3d7eff);
    border: 1px solid var(--signal-border, rgba(61, 126, 255, 0.2));
    border-radius: 9999px;
  }

  .depth-table-wrapper {
    overflow-x: auto;
  }

  .depth-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }

  .depth-table thead th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    font-weight: 600;
    color: var(--text-secondary, #9ca3af);
    border-bottom: 1px solid var(--border, #1f2937);
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .depth-table tbody td {
    padding: 0.5rem 0.75rem;
    color: var(--text-primary, #f9fafb);
    border-bottom: 1px solid var(--border, #1f2937);
    font-variant-numeric: tabular-nums;
  }

  .cat-name {
    font-family: ui-monospace, 'SF Mono', monospace;
    font-weight: 600;
  }

  .total-cell {
    font-weight: 700;
  }

  .library-empty-note {
    font-size: 0.8125rem;
    color: var(--text-muted, #6b7280);
    font-style: italic;
    margin: var(--s-2) 0 0;
  }

  .tier-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s-3);
  }

  .tier-card {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: var(--s-3) var(--s-4);
    background: var(--surface-2, #111827);
    border: 1px solid var(--border, #1f2937);
    border-radius: var(--r-sm);
  }

  .tier-card-minimum {
    border-color: var(--signal-border, rgba(61, 126, 255, 0.2));
  }

  .tier-card-label {
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-muted, #6b7280);
  }

  .tier-card-value {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-primary, #f9fafb);
  }

  .tier-card-detail {
    font-size: 0.75rem;
    color: var(--text-secondary, #9ca3af);
  }

  .block-warning {
    display: flex;
    align-items: flex-start;
    gap: var(--s-2);
    padding: var(--s-3) var(--s-4);
    background: #1f0909;
    border: 1px solid #7f1d1d;
    border-radius: var(--r-sm);
    font-size: 0.875rem;
    color: #fca5a5;
    line-height: 1.5;
  }

  .block-warning svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
</style>
