<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';

  const AVAILABLE_TOOLS: { id: string; label: string; description: string }[] = [
    { id: 'bash',       label: 'Bash',       description: 'Execute shell commands' },
    { id: 'file_read',  label: 'File Read',  description: 'Read files from the filesystem' },
    { id: 'file_write', label: 'File Write', description: 'Write files to the filesystem' },
    { id: 'web_search', label: 'Web Search', description: 'Search the web' },
    { id: 'web_fetch',  label: 'Web Fetch',  description: 'Fetch content from URLs' },
  ];

  let { form } = $props<{ form: { error?: string; field?: string } | null }>();

  let name                = $state('');
  let description         = $state('');
  let maxBots             = $state(5);
  let budgetCapDollars    = $state('10.00');
  let runtimeLimitMinutes = $state('60');
  let selectedTools       = $state<Set<string>>(new Set());
  let submitting          = $state(false);

  function toggleTool(id: string) {
    if (selectedTools.has(id)) {
      const next = new Set(selectedTools);
      next.delete(id);
      selectedTools = next;
    } else {
      selectedTools = new Set([...selectedTools, id]);
    }
  }
</script>

<svelte:head>
  <title>New Objective | Akasa</title>
</svelte:head>

<div class="briefing">
  <div class="briefing-header">
    <a href="/objectives" class="back-link">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Back to objectives
    </a>
    <div class="header-meta">
      <span class="sec-label">NEW OBJECTIVE</span>
    </div>
    <h1>Define your objective.</h1>
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
    <!-- Panel 01: Name -->
    <div class="panel">
      <div class="panel-label">
        <span class="panel-tag">01</span>
        Name
      </div>
      <input
        type="text"
        id="name"
        name="name"
        bind:value={name}
        placeholder="e.g., Research competitor pricing"
        required
        class:field-invalid={form?.field === 'name'}
      />
      {#if form?.field === 'name' && form?.error}
        <span class="field-error">{form.error}</span>
      {/if}
    </div>

    <!-- Panel 02: Description -->
    <div class="panel">
      <div class="panel-label">
        <span class="panel-tag">02</span>
        Description
        <span class="optional-label">optional</span>
      </div>
      <textarea
        id="description"
        name="description"
        bind:value={description}
        placeholder="What should the bots accomplish?"
        rows="4"
      ></textarea>
    </div>

    <!-- Panel 03: Crew Size -->
    <div class="panel">
      <div class="panel-label">
        <span class="panel-tag">03</span>
        Crew Size
      </div>
      <div class="crew-control">
        <div class="crew-value">
          <span class="crew-num">{maxBots}</span>
          <span class="crew-unit">bots</span>
        </div>
        <input
          id="defaultMaxBots"
          name="defaultMaxBots"
          type="range"
          bind:value={maxBots}
          min="3"
          max="20"
          step="1"
        />
        <div class="range-labels">
          <span>3 min</span>
          <span>20 max</span>
        </div>
      </div>
    </div>

    <!-- Panel 04: Budget Cap -->
    <div class="panel">
      <div class="panel-label">
        <span class="panel-tag">04</span>
        Budget Cap
        <span class="optional-label">optional</span>
      </div>
      <div class="budget-control">
        <div class="budget-input-wrap">
          <span class="currency">$</span>
          <input
            id="budgetCapDollars"
            name="budgetCapDollars"
            type="number"
            bind:value={budgetCapDollars}
            min="0"
            step="0.01"
            placeholder="—"
          />
        </div>
        <p class="budget-hint">Leave blank for no limit. Hard ceiling — executions stop when reached.</p>
      </div>
    </div>

    <!-- Panel 05: Runtime Limit -->
    <div class="panel">
      <div class="panel-label">
        <span class="panel-tag">05</span>
        Runtime Limit
        <span class="optional-label">optional</span>
      </div>
      <div class="budget-control">
        <div class="budget-input-wrap">
          <input
            id="runtimeLimitMinutes"
            name="runtimeLimitMinutes"
            type="number"
            bind:value={runtimeLimitMinutes}
            min="1"
            step="1"
            placeholder="—"
          />
          <span class="currency">min</span>
        </div>
        <p class="budget-hint">Leave blank for no limit. Maximum time before execution is automatically stopped.</p>
      </div>
    </div>

    <!-- Panel 06: Tool Allowlist -->
    <div class="panel">
      <div class="panel-label">
        <span class="panel-tag">06</span>
        Tool Allowlist
      </div>
      <p class="panel-hint">Select which tools bots can use by default. Leave all unselected to allow all tools.</p>
      <div class="tools-grid">
        {#each AVAILABLE_TOOLS as tool}
          <button
            type="button"
            class="tool-toggle"
            class:active={selectedTools.has(tool.id)}
            onclick={() => toggleTool(tool.id)}
          >
            <div class="tool-indicator">
              {#if selectedTools.has(tool.id)}
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
              <span class="tool-label">{tool.label}</span>
              <span class="tool-desc">{tool.description}</span>
            </div>
            {#if selectedTools.has(tool.id)}
              <span class="tool-status">ENABLED</span>
            {/if}
          </button>
        {/each}
      </div>
      {#each [...selectedTools] as tool}
        <input type="hidden" name="allowedTools" value={tool} />
      {/each}
    </div>

    {#if form?.error && !form?.field}
      <div class="error-banner">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
          <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        {form.error}
      </div>
    {/if}

    <button type="submit" class="launch-btn" disabled={submitting}>
      {#if submitting}
        <span class="launch-spinner"></span>
        Creating...
      {:else}
        Create Objective
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

  .sec-label {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 400;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--violet-bright);
    background: var(--violet-dim);
    border: 1px solid rgba(139,92,246,0.2);
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
    margin-top: 16px;
    margin-bottom: 0;
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

  .optional-label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.12em;
    color: var(--text-faint);
    opacity: 0.6;
  }

  .panel-hint {
    font-size: 13px;
    font-weight: 300;
    color: var(--text-faint);
    line-height: 1.65;
  }

  /* ── Text input ── */
  input[type='text'] {
    width: 100%;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 16px;
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 300;
    color: var(--text);
    line-height: 1.5;
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
  }

  input[type='text']::placeholder {
    color: var(--text-faint);
  }

  input[type='text']:focus {
    outline: none;
    border-color: var(--border-hi);
    box-shadow: 0 0 0 3px var(--violet-dim);
  }

  input[type='text'].field-invalid {
    border-color: rgba(248, 113, 113, 0.6);
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
    min-height: 100px;
  }

  textarea::placeholder {
    color: var(--text-faint);
  }

  textarea:focus {
    outline: none;
    border-color: var(--border-hi);
    box-shadow: 0 0 0 3px var(--violet-dim);
  }

  /* ── Field error ── */
  .field-error {
    color: var(--error);
    font-size: 0.8rem;
    margin-top: 0.25rem;
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

  /* ── Budget / Runtime control ── */
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

  /* ── Error banner ── */
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

  /* ── Submit button ── */
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
  }
</style>
