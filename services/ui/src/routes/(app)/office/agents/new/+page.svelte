<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let name = $state('');
  let description = $state('');
  let adapter = $state('claude');
  let submitting = $state(false);
  let errorMsg = $state('');

  const ADAPTERS = [
    { value: 'claude', label: 'Claude (Anthropic)' },
    { value: 'codex', label: 'Codex (OpenAI)' },
    { value: 'gemini', label: 'Gemini (Google)' },
    { value: 'openclaw', label: 'OpenClaw' },
  ];

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) {
      errorMsg = 'Agent name is required.';
      return;
    }
    submitting = true;
    errorMsg = '';
    try {
      const companyId = $page.data.companyId;
      if (!companyId) throw new Error('No company found');
      const res = await fetch(`/api/companies/${companyId}/agents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, adapter }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(body || `Request failed (${res.status})`);
      }
      goto('/office/agents');
    } catch (err) {
      errorMsg = (err as Error).message ?? 'Something went wrong. Try refreshing - if this keeps happening, check your connection.';
      submitting = false;
    }
  }
</script>

<div class="create-agent">
  <div class="back-row">
    <a href="/office/agents" class="back-link">&larr; Agents</a>
  </div>

  <h1 class="page-title">Add agent</h1>

  <form class="create-form" onsubmit={handleSubmit}>
    <div class="field">
      <label for="name" class="field-label">Name</label>
      <input
        id="name"
        type="text"
        bind:value={name}
        placeholder="e.g. Research Assistant"
        class="field-input"
        required
        aria-required="true"
      />
    </div>

    <div class="field">
      <label for="description" class="field-label">Description</label>
      <textarea
        id="description"
        bind:value={description}
        placeholder="What does this agent do?"
        class="field-input field-textarea"
        rows="3"
      ></textarea>
    </div>

    <div class="field">
      <label for="adapter" class="field-label">Model / Adapter</label>
      <select id="adapter" bind:value={adapter} class="field-input field-select">
        {#each ADAPTERS as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>

    {#if errorMsg}
      <p class="field-error" role="alert" aria-live="polite">{errorMsg}</p>
    {/if}

    <div class="form-actions">
      <a href="/office/agents" class="btn-secondary">Cancel</a>
      <button type="submit" class="btn-primary" disabled={submitting}>
        {submitting ? 'Adding...' : 'Add agent'}
      </button>
    </div>
  </form>
</div>

<style>
  .create-agent {
    max-width: 560px;
  }

  .back-row {
    margin-bottom: var(--space-xl);
  }

  .back-link {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.15s;
  }

  .back-link:hover {
    color: var(--fo-plum);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(26px, 3.5vw, 38px);
    font-weight: 600;
    line-height: 1.1;
    color: var(--fo-plum);
    margin: 0 0 var(--space-xl);
  }

  .create-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .field-label {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
  }

  .field-input {
    font-family: var(--font-body);
    font-size: 16px;
    padding: 10px 14px;
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    color: inherit;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
  }

  .field-input:focus {
    border-color: var(--fo-plum-m);
    outline: 2px solid var(--fo-plum-p);
    outline-offset: 1px;
  }

  .field-textarea {
    resize: vertical;
    line-height: 1.65;
  }

  .field-select {
    cursor: pointer;
  }

  .field-error {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--error);
    margin: 0;
  }

  .form-actions {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-top: var(--space-sm);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 10px 18px;
    background: var(--fo-plum);
    color: #fff;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s;
    text-decoration: none;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--fo-plum-m);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    padding: 10px 18px;
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s;
    text-decoration: none;
  }

  .btn-secondary:hover {
    background: var(--fo-bg2);
  }

  .page-title {
    color: var(--text);
  }

  .field-input {
    background: var(--card);
    border-color: var(--border);
  }

  .field-input:focus {
    border-color: var(--accent);
    outline-color: var(--accent-dim);
  }

  .btn-primary {
    background: var(--accent);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-m);
  }

  .btn-secondary {
    border-color: var(--border);
  }

  .btn-secondary:hover {
    background: var(--bg2);
  }
</style>
