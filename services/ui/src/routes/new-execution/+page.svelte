<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
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
  <title>New Mission | Akasa</title>
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
      return async ({ result, update }) => {
        submitting = false;
        if (result.type === 'redirect') {
          await goto(result.location);
        } else {
          await update({ reset: false });
        }
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
  /* ── Page wrapper ── */
  .briefing {
    max-width: 760px;
    margin: 0 auto;
    padding: 96px 36px 80px;
  }

  /* ── Header ── */
  .briefing-header {
    margin-bottom: 48px;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-family: var(--font-body);
    font-weight: 400;
    color: var(--text-faint);
    margin-bottom: 24px;
    transition: color 0.2s;
    text-decoration: none;
  }

  .back-link:hover {
    color: var(--text-muted);
  }

  .header-meta {
    margin-bottom: 16px;
  }

  .briefing-tag {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 400;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--teal);
    background: var(--teal-dim);
    border: 1px solid rgba(45,212,191,0.2);
    padding: 4px 12px;
    border-radius: 100px;
  }

  .briefing-header h1 {
    font-family: var(--font-display);
    font-size: clamp(28px, 3.5vw, 40px);
    font-weight: 600;
    letter-spacing: -0.025em;
    line-height: 1.1;
    color: var(--text);
    margin-bottom: 10px;
  }

  .briefing-sub {
    font-size: 15px;
    font-weight: 300;
    color: var(--text-muted);
    line-height: 1.65;
  }

  /* ── Form ── */
  form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Panels ── */
  .panel {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
    overflow: hidden;
    transition: border-color 0.3s;
  }

  .panel:focus-within {
    border-color: var(--border-mid);
  }

  .panel-label {
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 300;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .panel-tag {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 400;
    color: var(--violet-bright);
    letter-spacing: 0.08em;
  }

  .panel-hint {
    font-size: 13px;
    font-weight: 300;
    color: var(--text-faint);
    line-height: 1.65;
  }

  /* ── Textarea ── */
  textarea {
    width: 100%;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 16px;
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 300;
    color: var(--text);
    line-height: 1.7;
    resize: vertical;
    transition: border-color 0.2s, box-shadow 0.2s;
    min-height: 120px;
  }

  textarea::placeholder {
    color: var(--text-faint);
  }

  textarea:focus {
    outline: none;
    border-color: var(--border-hi);
    box-shadow: 0 0 0 3px var(--violet-dim);
  }

  /* ── Row panels ── */
  .row-panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  /* ── Crew control ── */
  .crew-control {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .crew-value {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .crew-num {
    font-family: var(--font-mono);
    font-size: 2.25rem;
    font-weight: 400;
    color: var(--text);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .crew-unit {
    font-size: 13px;
    font-weight: 300;
    color: var(--text-muted);
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--violet);
    height: 4px;
    cursor: pointer;
  }

  .range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-faint);
    letter-spacing: 0.05em;
  }

  /* ── Budget control ── */
  .budget-control {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .budget-input-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 16px;
    width: fit-content;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .budget-input-wrap:focus-within {
    border-color: var(--border-hi);
    box-shadow: 0 0 0 3px var(--violet-dim);
  }

  .currency {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 300;
    color: var(--text-faint);
  }

  input[type='number'] {
    background: transparent;
    border: none;
    outline: none;
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 400;
    color: var(--text);
    letter-spacing: -0.02em;
    width: 90px;
    -moz-appearance: textfield;
  }

  input[type='number']::-webkit-outer-spin-button,
  input[type='number']::-webkit-inner-spin-button {
    -webkit-appearance: none;
  }

  .budget-hint {
    font-size: 13px;
    font-weight: 300;
    color: var(--text-faint);
    line-height: 1.65;
  }

  /* ── Domains input ── */
  .domains-input {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.7;
  }

  /* ── Tool toggles ── */
  .tools-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tool-toggle {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    text-align: left;
  }

  .tool-toggle:hover {
    border-color: var(--border-mid);
    background: var(--bg-2);
  }

  .tool-toggle.active {
    border-color: var(--border-hi);
    background: var(--violet-dim);
  }

  .tool-indicator {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--bg-2);
    color: var(--text-faint);
    border: 1px solid var(--border);
    transition: all 0.2s;
  }

  .tool-toggle.active .tool-indicator {
    background: var(--violet-dim);
    color: var(--violet-bright);
    border-color: var(--border-hi);
  }

  .tool-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .tool-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
    font-family: var(--font-body);
  }

  .tool-desc {
    font-size: 12px;
    font-weight: 300;
    color: var(--text-faint);
    font-family: var(--font-body);
  }

  .tool-status {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 3px 9px;
    border-radius: 100px;
    background: var(--bg);
    color: var(--text-faint);
    border: 1px solid var(--border);
    transition: all 0.2s;
  }

  .tool-toggle.active .tool-status {
    color: var(--violet-bright);
    background: var(--violet-dim);
    border-color: var(--border-hi);
  }

  /* ── Error ── */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: var(--error-dim);
    border: 1px solid rgba(248,113,113,0.25);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 300;
    color: var(--error);
  }

  /* ── Launch button ── */
  .launch-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 15px 36px;
    background: var(--violet);
    color: #fff;
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.03em;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 28px rgba(124,58,237,0.35);
    transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
    margin-top: 8px;
  }

  .launch-btn:hover:not(:disabled) {
    opacity: 0.88;
    transform: translateY(-2px);
    box-shadow: 0 8px 36px rgba(124,58,237,0.5);
  }

  .launch-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }

  .launch-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.25);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.65s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .briefing {
      padding: 88px 20px 60px;
    }
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
    gap: 8px;
    padding: 10px 16px;
    background: var(--bg-3);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
    width: fit-content;
  }

  .analyze-btn:hover:not(:disabled) {
    background: var(--bg-2);
    border-color: var(--border-mid);
  }

  .analyze-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .analysis-error {
    padding: 10px 14px;
    background: var(--error-dim);
    border: 1px solid rgba(248,113,113,0.25);
    border-radius: 8px;
    font-size: 13px;
    color: var(--error);
  }

  .analysis-section {
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  .analysis-heading {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin: 0 0 12px;
  }

  .analysis-hint {
    font-size: 13px;
    font-weight: 300;
    color: var(--text-faint);
    margin: 0 0 12px;
    line-height: 1.65;
  }

  .category-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .category-tag {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 400;
    padding: 4px 10px;
    background: var(--violet-dim);
    color: var(--violet-bright);
    border: 1px solid var(--border-mid);
    border-radius: 100px;
    letter-spacing: 0.04em;
  }

  .depth-table-wrapper {
    overflow-x: auto;
  }

  .depth-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .depth-table thead th {
    text-align: left;
    padding: 8px 12px;
    font-family: var(--font-mono);
    font-weight: 300;
    color: var(--text-faint);
    border-bottom: 1px solid var(--border);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }

  .depth-table tbody td {
    padding: 8px 12px;
    color: var(--text);
    border-bottom: 1px solid var(--border);
    font-variant-numeric: tabular-nums;
  }

  .cat-name {
    font-family: var(--font-mono);
    font-weight: 400;
    color: var(--text-muted);
  }

  .total-cell {
    font-weight: 600;
    color: var(--violet-bright);
  }

  .library-empty-note {
    font-size: 13px;
    color: var(--text-faint);
    font-style: italic;
    margin: 8px 0 0;
  }

  .tier-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .tier-card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px 16px;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  .tier-card-minimum {
    border-color: var(--border-mid);
  }

  .tier-card-label {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 400;
    letter-spacing: 0.14em;
    color: var(--text-faint);
    text-transform: uppercase;
  }

  .tier-card-value {
    font-family: var(--font-mono);
    font-size: 1.125rem;
    font-weight: 400;
    color: var(--text);
    letter-spacing: -0.01em;
  }

  .tier-card-detail {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .block-warning {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 14px 16px;
    background: var(--error-dim);
    border: 1px solid rgba(248,113,113,0.25);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 300;
    color: var(--error);
    line-height: 1.5;
  }

  .block-warning svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
</style>
