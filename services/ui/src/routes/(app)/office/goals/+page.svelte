<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { Objective } from '$lib/api';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let objectives: Objective[] = $state(data.objectives ?? []);
  let loading = $state(false);
  let errorMsg = $state('');

  let showCreate = $state(false);
  let createName = $state('');
  let createDesc = $state('');
  let createBudget = $state('');
  let createSaving = $state(false);
  let createError = $state('');

  let editTarget: Objective | null = $state(null);
  let editName = $state('');
  let editDesc = $state('');
  let editBudget = $state('');
  let editSaving = $state(false);
  let editError = $state('');

  let deleteTarget: Objective | null = $state(null);
  let deleteConfirming = $state(false);
  let deleteError = $state('');

  let runTarget: Objective | null = $state(null);
  let running = $state(false);
  let runError = $state('');
  let runSuccess = $state('');

  $effect(() => {
    objectives = data.objectives ?? [];
  });

  function openCreate() {
    createName = '';
    createDesc = '';
    createBudget = '';
    createError = '';
    showCreate = true;
  }

  function closeCreate() {
    showCreate = false;
    createError = '';
  }

  async function submitCreate(e: Event) {
    e.preventDefault();
    if (!createName.trim()) { createError = 'Name is required.'; return; }
    createSaving = true;
    createError = '';
    try {
      const body: Record<string, unknown> = { name: createName.trim() };
      if (createDesc.trim()) body.description = createDesc.trim();
      if (createBudget !== '') {
        const n = Number(createBudget);
        if (!isNaN(n) && n > 0) body.budgetCap = n;
      }
      const res = await fetch(`/api/companies/${data.companyId}/objectives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || res.statusText);
      }
      const created: Objective = await res.json();
      objectives = [created, ...objectives];
      closeCreate();
    } catch (err) {
      createError = err instanceof Error ? err.message : 'Failed to create objective.';
    } finally {
      createSaving = false;
    }
  }

  function openEdit(obj: Objective) {
    editTarget = obj;
    editName = obj.name;
    editDesc = obj.description ?? '';
    editBudget = obj.budgetCap != null ? String(obj.budgetCap) : '';
    editError = '';
  }

  function closeEdit() {
    editTarget = null;
    editError = '';
  }

  async function submitEdit(e: Event) {
    e.preventDefault();
    if (!editTarget) return;
    if (!editName.trim()) { editError = 'Name is required.'; return; }
    editSaving = true;
    editError = '';
    try {
      const body: Record<string, unknown> = { name: editName.trim() };
      body.description = editDesc.trim() || null;
      if (editBudget !== '') {
        const n = Number(editBudget);
        if (!isNaN(n) && n > 0) body.budgetCap = n;
        else body.budgetCap = null;
      } else {
        body.budgetCap = null;
      }
      const res = await fetch(`/api/objectives/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || res.statusText);
      }
      const updated: Objective = await res.json();
      objectives = objectives.map(o => o.id === updated.id ? updated : o);
      closeEdit();
    } catch (err) {
      editError = err instanceof Error ? err.message : 'Failed to update objective.';
    } finally {
      editSaving = false;
    }
  }

  function openDelete(obj: Objective) {
    deleteTarget = obj;
    deleteError = '';
  }

  function closeDelete() {
    deleteTarget = null;
    deleteError = '';
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    deleteConfirming = true;
    deleteError = '';
    try {
      const res = await fetch(`/api/objectives/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || res.statusText);
      }
      objectives = objectives.filter(o => o.id !== deleteTarget!.id);
      closeDelete();
    } catch (err) {
      deleteError = err instanceof Error ? err.message : 'Failed to delete objective.';
    } finally {
      deleteConfirming = false;
    }
  }

  function openRun(obj: Objective) {
    runTarget = obj;
    runError = '';
    runSuccess = '';
  }

  function closeRun() {
    runTarget = null;
    runError = '';
    runSuccess = '';
  }

  async function confirmRun() {
    if (!runTarget) return;
    running = true;
    runError = '';
    runSuccess = '';
    try {
      const body: Record<string, unknown> = { objectiveId: runTarget.id };
      if (runTarget.defaultConfig) body.config = runTarget.defaultConfig;
      const res = await fetch('/api/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || res.statusText);
      }
      const exec = await res.json();
      runSuccess = `Execution started (ID: ${exec.id ?? 'n/a'}).`;
      objectives = objectives.map(o =>
        o.id === runTarget!.id ? { ...o, lastRunAt: new Date().toISOString() } : o
      );
    } catch (err) {
      runError = err instanceof Error ? err.message : 'Failed to trigger execution.';
    } finally {
      running = false;
    }
  }

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatBudget(cents: number | null | undefined): string {
    if (cents == null) return '—';
    return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'var(--fo-gold)';
      case 'completed': return 'var(--success)';
      case 'paused': return 'var(--text-muted)';
      case 'archived': return 'var(--text-muted)';
      default: return 'var(--text-muted)';
    }
  }
</script>

<div class="objectives-page">
  <div class="page-header">
    <h1 class="page-title">Objectives</h1>
    <button class="btn-primary" onclick={openCreate}>New objective</button>
  </div>

  {#if errorMsg}
    <div class="banner-error" role="alert">{errorMsg}</div>
  {/if}

  {#if loading}
    <div class="loading-state" aria-busy="true">
      <span class="loading-label">LOADING</span>
    </div>
  {:else if objectives.length === 0}
    <div class="empty-state" aria-busy="false">
      <span class="empty-eyebrow">NO OBJECTIVES</span>
      <p class="empty-heading">Nothing here yet.</p>
      <p class="empty-body">Create your first objective to start deploying agent fleets.</p>
      <button class="btn-primary" onclick={openCreate}>New objective</button>
    </div>
  {:else}
    <div class="obj-table-wrap">
      <table class="obj-table">
        <thead>
          <tr>
            <th class="col-name">Name</th>
            <th class="col-status">Status</th>
            <th class="col-lastrun">Last run</th>
            <th class="col-budget">Budget cap</th>
            <th class="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each objectives as obj (obj.id)}
            <tr class="obj-row">
              <td class="col-name">
                <a href="/office/goals/{obj.id}" class="obj-link">{obj.name}</a>
                {#if obj.description}
                  <p class="obj-desc">{obj.description}</p>
                {/if}
              </td>
              <td class="col-status">
                <span class="status-chip" style="color: {getStatusColor(obj.status)}">
                  {obj.status}
                </span>
              </td>
              <td class="col-lastrun">{formatDate(obj.lastRunAt)}</td>
              <td class="col-budget">{formatBudget(obj.budgetCap)}</td>
              <td class="col-actions">
                <div class="action-row">
                  <button class="btn-action btn-run" onclick={() => openRun(obj)}>Run</button>
                  <a href="/office/goals/{obj.id}" class="btn-action btn-history">History</a>
                  <button class="btn-action btn-edit" onclick={() => openEdit(obj)}>Edit</button>
                  <button class="btn-action btn-delete" onclick={() => openDelete(obj)}>Delete</button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if showCreate}
  <div class="modal-overlay" role="presentation" onclick={closeCreate}>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-create-title" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title" id="modal-create-title">New objective</h2>
        <button class="modal-close" onclick={closeCreate} aria-label="Close">✕</button>
      </div>
      <form class="modal-form" onsubmit={submitCreate}>
        {#if createError}
          <div class="form-error" role="alert">{createError}</div>
        {/if}
        <label class="field-label" for="create-name">Name <span class="required">*</span></label>
        <input
          id="create-name"
          class="field-input"
          type="text"
          placeholder="Objective name"
          bind:value={createName}
          required
          disabled={createSaving}
        />
        <label class="field-label" for="create-desc">Description</label>
        <textarea
          id="create-desc"
          class="field-textarea"
          placeholder="What should the agents accomplish?"
          bind:value={createDesc}
          rows="3"
          disabled={createSaving}
        ></textarea>
        <label class="field-label" for="create-budget">Budget cap (cents)</label>
        <input
          id="create-budget"
          class="field-input"
          type="number"
          min="0"
          step="1"
          placeholder="e.g. 500"
          bind:value={createBudget}
          disabled={createSaving}
        />
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick={closeCreate} disabled={createSaving}>Cancel</button>
          <button type="submit" class="btn-primary" disabled={createSaving}>
            {createSaving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if editTarget}
  <div class="modal-overlay" role="presentation" onclick={closeEdit}>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-edit-title" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title" id="modal-edit-title">Edit objective</h2>
        <button class="modal-close" onclick={closeEdit} aria-label="Close">✕</button>
      </div>
      <form class="modal-form" onsubmit={submitEdit}>
        {#if editError}
          <div class="form-error" role="alert">{editError}</div>
        {/if}
        <label class="field-label" for="edit-name">Name <span class="required">*</span></label>
        <input
          id="edit-name"
          class="field-input"
          type="text"
          bind:value={editName}
          required
          disabled={editSaving}
        />
        <label class="field-label" for="edit-desc">Description</label>
        <textarea
          id="edit-desc"
          class="field-textarea"
          bind:value={editDesc}
          rows="3"
          disabled={editSaving}
        ></textarea>
        <label class="field-label" for="edit-budget">Budget cap (cents)</label>
        <input
          id="edit-budget"
          class="field-input"
          type="number"
          min="0"
          step="1"
          bind:value={editBudget}
          disabled={editSaving}
        />
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick={closeEdit} disabled={editSaving}>Cancel</button>
          <button type="submit" class="btn-primary" disabled={editSaving}>
            {editSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if deleteTarget}
  <div class="modal-overlay" role="presentation" onclick={closeDelete}>
    <div class="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="modal-delete-title" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title" id="modal-delete-title">Delete objective?</h2>
        <button class="modal-close" onclick={closeDelete} aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        {#if deleteError}
          <div class="form-error" role="alert">{deleteError}</div>
        {/if}
        <p class="confirm-text">
          Archive <strong>{deleteTarget.name}</strong>? This cannot be undone.
        </p>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick={closeDelete} disabled={deleteConfirming}>Cancel</button>
        <button class="btn-danger" onclick={confirmDelete} disabled={deleteConfirming}>
          {deleteConfirming ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if runTarget}
  <div class="modal-overlay" role="presentation" onclick={closeRun}>
    <div class="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="modal-run-title" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title" id="modal-run-title">Run objective</h2>
        <button class="modal-close" onclick={closeRun} aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        {#if runError}
          <div class="form-error" role="alert">{runError}</div>
        {/if}
        {#if runSuccess}
          <div class="form-success" role="status">{runSuccess}</div>
        {/if}
        {#if !runSuccess}
          <p class="confirm-text">
            Deploy agents for <strong>{runTarget.name}</strong>?
            {#if runTarget.budgetCap != null}
              Budget cap: {formatBudget(runTarget.budgetCap)}.
            {/if}
          </p>
        {/if}
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick={closeRun}>
          {runSuccess ? 'Close' : 'Cancel'}
        </button>
        {#if !runSuccess}
          <button class="btn-primary" onclick={confirmRun} disabled={running}>
            {running ? 'Starting…' : 'Deploy agents'}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .objectives-page {
    max-width: 1100px;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-xl);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(26px, 3.5vw, 38px);
    font-weight: 600;
    line-height: 1.1;
    color: var(--text);
    margin: 0;
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
    text-decoration: none;
    border-radius: var(--radius-md);
    border: none;
    cursor: pointer;
    transition: background 0.15s;
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
    transition: border-color 0.15s, color 0.15s;
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: var(--fo-plum-m);
    color: var(--fo-plum);
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-danger {
    display: inline-flex;
    align-items: center;
    padding: 10px 18px;
    background: var(--error);
    color: #fff;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .banner-error {
    padding: var(--space-md);
    background: var(--error-dim);
    border: 1px solid var(--error);
    border-radius: var(--radius-md);
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--error);
    margin-bottom: var(--space-xl);
  }

  .loading-state {
    padding: var(--space-3xl) 0;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .loading-label {
    font-family: var(--font-label);
    font-size: 6px;
    color: var(--text-muted);
    letter-spacing: 0.10em;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
    padding: var(--space-3xl) 0;
  }

  .empty-eyebrow {
    font-family: var(--font-label);
    font-size: 6px;
    color: var(--text-muted);
    letter-spacing: 0.10em;
  }

  .empty-heading {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .empty-body {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
    max-width: 380px;
  }

  .obj-table-wrap {
    overflow-x: auto;
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-lg);
  }

  .obj-table {
    width: 100%;
    border-collapse: collapse;
  }

  .obj-table thead tr {
    background: var(--fo-bg2);
    border-bottom: 1px solid var(--fo-border);
  }

  .obj-table th {
    padding: var(--space-sm) var(--space-md);
    text-align: left;
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
    font-weight: 400;
    white-space: nowrap;
  }

  .obj-row {
    border-bottom: 1px solid var(--fo-border);
    transition: background 0.12s;
  }

  .obj-row:last-child {
    border-bottom: none;
  }

  .obj-row:hover {
    background: var(--fo-bg2);
  }

  .obj-table td {
    padding: var(--space-md);
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    vertical-align: middle;
  }

  .col-name { width: 35%; }
  .col-status { width: 10%; }
  .col-lastrun { width: 14%; white-space: nowrap; }
  .col-budget { width: 12%; white-space: nowrap; }
  .col-actions { width: 29%; }

  .obj-link {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    color: var(--fo-plum);
    text-decoration: none;
    transition: color 0.15s;
  }

  .obj-link:hover {
    color: var(--fo-plum-m);
    text-decoration: underline;
  }

  .obj-desc {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
    margin: 4px 0 0;
    line-height: 1.4;
  }

  .status-chip {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .action-row {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .btn-action {
    display: inline-flex;
    align-items: center;
    padding: 5px 10px;
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .btn-run {
    background: var(--fo-plum);
    color: #fff;
    border-color: var(--fo-plum);
  }

  .btn-run:hover {
    background: var(--fo-plum-m);
    border-color: var(--fo-plum-m);
  }

  .btn-history {
    background: var(--fo-gold-p);
    color: var(--fo-gold);
    border-color: var(--fo-gold-l);
  }

  .btn-history:hover {
    background: var(--fo-gold-l);
    color: #fff;
  }

  .btn-edit {
    background: transparent;
    color: var(--text-muted);
    border-color: var(--fo-border);
  }

  .btn-edit:hover {
    border-color: var(--fo-plum-m);
    color: var(--fo-plum);
  }

  .btn-delete {
    background: transparent;
    color: var(--error);
    border-color: transparent;
  }

  .btn-delete:hover {
    background: var(--error-dim);
    border-color: var(--error);
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(14, 13, 11, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: var(--space-lg);
  }

  .modal {
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 480px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  }

  .modal--sm {
    max-width: 380px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg) var(--space-xl);
    border-bottom: 1px solid var(--fo-border);
  }

  .modal-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 14px;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    transition: background 0.12s;
  }

  .modal-close:hover {
    background: var(--fo-bg2);
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-xl);
  }

  .modal-body {
    padding: var(--space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-xl) var(--space-xl);
  }

  .field-label {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    letter-spacing: 0.04em;
  }

  .required {
    color: var(--error);
  }

  .field-input,
  .field-textarea {
    width: 100%;
    padding: 9px 12px;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    background: var(--fo-bg);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    transition: border-color 0.15s;
    outline: none;
    resize: vertical;
  }

  .field-input:focus,
  .field-textarea:focus {
    border-color: var(--fo-plum-m);
  }

  .field-input:disabled,
  .field-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .form-error {
    padding: var(--space-sm) var(--space-md);
    background: var(--error-dim);
    border: 1px solid var(--error);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--error);
  }

  .form-success {
    padding: var(--space-sm) var(--space-md);
    background: rgba(5, 150, 105, 0.08);
    border: 1px solid var(--success);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--success);
  }

  .confirm-text {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text);
    line-height: 1.6;
    margin: 0;
  }
</style>
