<script lang="ts">
  import type { PageData } from './$types';
  import type { ObjectiveWithAggregation, CreateObjectiveInput } from '$lib/api';
  import { handleApiError } from '$lib/handle-api-error';
  import { success } from '$lib/toast-store';

  let { data }: { data: PageData } = $props();

  let objectives = $state<ObjectiveWithAggregation[]>(data.objectives);
  let showCreateModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteConfirm = $state(false);
  let editingObjective = $state<ObjectiveWithAggregation | null>(null);
  let deletingObjectiveId = $state<string | null>(null);
  let runningObjectiveId = $state<string | null>(null);

  let createName = $state('');
  let createDescription = $state('');
  let createMaxBots = $state(5);
  let createBudgetCap = $state('');
  let createRuntimeLimit = $state('');
  let createSubmitting = $state(false);
  let createError = $state('');

  let editName = $state('');
  let editDescription = $state('');
  let editMaxBots = $state(5);
  let editBudgetCap = $state('');
  let editRuntimeLimit = $state('');
  let editSubmitting = $state(false);
  let editError = $state('');

  let deleteSubmitting = $state(false);
  let deleteError = $state('');

  function formatCents(cents: number | null): string {
    if (cents == null) return 'No cap';
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatDate(iso: string): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getStatusLabel(status: string | null): string {
    if (!status) return 'No runs';
    switch (status) {
      case 'pre_flight': return 'PRE-FLIGHT';
      case 'queued': return 'QUEUED';
      case 'running': return 'RUNNING';
      case 'paused': return 'PAUSED';
      case 'stopped': return 'STOPPED';
      case 'completed': return 'COMPLETED';
      case 'failed': return 'FAILED';
      default: return status.toUpperCase();
    }
  }

  function getStatusColor(status: string | null): string {
    if (!status) return 'var(--text-muted)';
    switch (status) {
      case 'pre_flight': return 'var(--fo-gold, #B8965A)';
      case 'queued': return 'var(--fo-gold, #B8965A)';
      case 'running': return 'var(--bo-teal, #2DD4BF)';
      case 'paused': return 'var(--text-muted)';
      case 'stopped': return 'var(--text-muted)';
      case 'completed': return 'var(--bo-teal, #2DD4BF)';
      case 'failed': return 'var(--error, #DC2626)';
      default: return 'var(--text-muted)';
    }
  }

  function openCreateModal() {
    createName = '';
    createDescription = '';
    createMaxBots = 5;
    createBudgetCap = '';
    createRuntimeLimit = '';
    createError = '';
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  function openEditModal(obj: ObjectiveWithAggregation) {
    editingObjective = obj;
    editName = obj.name;
    editDescription = obj.description ?? '';
    editMaxBots = obj.defaultMaxBots;
    editBudgetCap = obj.defaultBudgetCapCents != null ? String(obj.defaultBudgetCapCents / 100) : '';
    editRuntimeLimit = obj.defaultRuntimeLimitSeconds != null ? String(obj.defaultRuntimeLimitSeconds) : '';
    editError = '';
    showEditModal = true;
  }

  function closeEditModal() {
    showEditModal = false;
    editingObjective = null;
  }

  function openDeleteConfirm(id: string) {
    deletingObjectiveId = id;
    deleteError = '';
    showDeleteConfirm = true;
  }

  function closeDeleteConfirm() {
    showDeleteConfirm = false;
    deletingObjectiveId = null;
  }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    if (!createName.trim()) {
      createError = 'Name is required.';
      return;
    }
    createSubmitting = true;
    createError = '';
    try {
      const body: CreateObjectiveInput = {
        name: createName.trim(),
        description: createDescription.trim() || undefined,
        defaultMaxBots: createMaxBots,
        defaultBudgetCapCents: createBudgetCap ? Math.round(parseFloat(createBudgetCap) * 100) : undefined,
        defaultRuntimeLimitSeconds: createRuntimeLimit ? parseInt(createRuntimeLimit) : undefined,
      };
      const res = await fetch('/api/objectives', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        await handleApiError(null, res, { message: 'Failed to create objective' });
        return;
      }
      const created = await res.json();
      objectives = [created, ...objectives];
      success('Objective created');
      closeCreateModal();
    } catch (err) {
      await handleApiError(err, undefined, { suppressToast: true });
      createError = 'Failed to create objective. Please try again.';
    } finally {
      createSubmitting = false;
    }
  }

  async function handleEdit(e: SubmitEvent) {
    e.preventDefault();
    if (!editingObjective) return;
    if (!editName.trim()) {
      editError = 'Name is required.';
      return;
    }
    editSubmitting = true;
    editError = '';
    try {
      const body: Record<string, unknown> = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        defaultMaxBots: editMaxBots,
        defaultBudgetCapCents: editBudgetCap ? Math.round(parseFloat(editBudgetCap) * 100) : null,
        defaultRuntimeLimitSeconds: editRuntimeLimit ? parseInt(editRuntimeLimit) : null,
      };
      const res = await fetch(`/api/objectives/${editingObjective.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        await handleApiError(null, res, { message: 'Failed to update objective' });
        return;
      }
      const updated = await res.json();
      objectives = objectives.map(o => o.id === updated.id ? { ...o, ...updated } : o);
      success('Objective updated');
      closeEditModal();
    } catch (err) {
      await handleApiError(err, undefined, { suppressToast: true });
      editError = 'Failed to update objective. Please try again.';
    } finally {
      editSubmitting = false;
    }
  }

  async function handleDelete() {
    if (!deletingObjectiveId) return;
    deleteSubmitting = true;
    deleteError = '';
    try {
      const res = await fetch(`/api/objectives/${deletingObjectiveId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        await handleApiError(null, res, { message: 'Failed to delete objective' });
        return;
      }
      objectives = objectives.filter(o => o.id !== deletingObjectiveId);
      success('Objective deleted');
      closeDeleteConfirm();
    } catch (err) {
      await handleApiError(err, undefined, { suppressToast: true });
      deleteError = 'Failed to delete objective. Please try again.';
    } finally {
      deleteSubmitting = false;
    }
  }

  async function handleRun(obj: ObjectiveWithAggregation, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    runningObjectiveId = obj.id;
    try {
      const res = await fetch('/api/executions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          objective: obj.name,
          objectiveId: obj.id,
          maxBots: obj.defaultMaxBots,
          budgetCapCents: obj.defaultBudgetCapCents,
          runtimeLimitSeconds: obj.defaultRuntimeLimitSeconds,
          allowedTools: obj.defaultAllowedTools,
        }),
      });
      if (!res.ok) {
        await handleApiError(null, res, { message: 'Failed to trigger execution' });
        return;
      }
      const result = await res.json();
      success('Execution started');
      window.location.href = `/office/goals/${obj.id}`;
    } catch (err) {
      await handleApiError(err, undefined, { showRetry: true, onRetry: () => handleRun(obj, e) });
    } finally {
      runningObjectiveId = null;
    }
  }
</script>

<div class="objectives-page">
  <div class="page-header">
    <h1 class="page-title">Objectives</h1>
    <button class="btn-primary" onclick={openCreateModal}>New objective</button>
  </div>

  {#if objectives.length === 0}
    <div class="empty-state" aria-busy="false">
      <span class="empty-eyebrow">NO OBJECTIVES</span>
      <p class="empty-heading">Nothing here yet.</p>
      <p class="empty-body">Create an objective to define what your agents will work on.</p>
      <button class="btn-primary" onclick={openCreateModal}>New objective</button>
    </div>
  {:else}
    <div class="objectives-list">
      {#each objectives as obj}
        <div class="objective-card">
          <div class="objective-card-main">
            <div class="objective-header">
              <a href="/office/goals/{obj.id}" class="objective-name">{obj.name}</a>
              <span class="objective-status" style="color: {getStatusColor(obj.lastRunStatus)}">
                {getStatusLabel(obj.lastRunStatus)}
              </span>
            </div>
            {#if obj.description}
              <p class="objective-desc">{obj.description}</p>
            {/if}
            <div class="objective-meta">
              <span class="meta-item">
                <span class="meta-label">Last run</span>
                <span class="meta-value">{formatDate(obj.updatedAt)}</span>
              </span>
              <span class="meta-item">
                <span class="meta-label">Budget cap</span>
                <span class="meta-value">{formatCents(obj.defaultBudgetCapCents)}</span>
              </span>
              <span class="meta-item">
                <span class="meta-label">Runs</span>
                <span class="meta-value">{obj.runCount}</span>
              </span>
            </div>
          </div>
          <div class="objective-actions">
            <button
              class="btn-run"
              onclick={(e) => handleRun(obj, e)}
              disabled={runningObjectiveId === obj.id}
            >
              {runningObjectiveId === obj.id ? 'Starting...' : 'Run'}
            </button>
            <a href="/office/goals/{obj.id}" class="btn-ghost">History</a>
            <button class="btn-icon" onclick={() => openEditModal(obj)} aria-label="Edit">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z"/>
              </svg>
            </button>
            <button class="btn-icon btn-danger" onclick={() => openDeleteConfirm(obj.id)} aria-label="Delete">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/>
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showCreateModal}
<div class="modal-overlay" onclick={closeCreateModal} role="dialog" aria-modal="true">
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2 class="modal-title">New objective</h2>
      <button class="modal-close" onclick={closeCreateModal} aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 4l12 12M16 4L4 16"/>
        </svg>
      </button>
    </div>
    <form class="modal-form" onsubmit={handleCreate}>
      <div class="field">
        <label for="create-name" class="field-label">Name</label>
        <input
          id="create-name"
          type="text"
          bind:value={createName}
          placeholder="e.g. Customer Support Resolution"
          class="field-input"
          required
          aria-required="true"
        />
      </div>
      <div class="field">
        <label for="create-desc" class="field-label">Description</label>
        <textarea
          id="create-desc"
          bind:value={createDescription}
          placeholder="What should this objective accomplish?"
          class="field-input field-textarea"
          rows="3"
        ></textarea>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="create-bots" class="field-label">Max bots</label>
          <input
            id="create-bots"
            type="number"
            bind:value={createMaxBots}
            min="3"
            max="20"
            class="field-input"
          />
        </div>
        <div class="field">
          <label for="create-budget" class="field-label">Budget cap ($)</label>
          <input
            id="create-budget"
            type="number"
            bind:value={createBudgetCap}
            min="0"
            step="0.01"
            placeholder="No cap"
            class="field-input"
          />
        </div>
        <div class="field">
          <label for="create-runtime" class="field-label">Runtime limit (s)</label>
          <input
            id="create-runtime"
            type="number"
            bind:value={createRuntimeLimit}
            min="60"
            placeholder="No limit"
            class="field-input"
          />
        </div>
      </div>
      {#if createError}
        <p class="field-error" role="alert">{createError}</p>
      {/if}
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick={closeCreateModal}>Cancel</button>
        <button type="submit" class="btn-primary" disabled={createSubmitting}>
          {createSubmitting ? 'Creating...' : 'Create objective'}
        </button>
      </div>
    </form>
  </div>
</div>
{/if}

{#if showEditModal && editingObjective}
<div class="modal-overlay" onclick={closeEditModal} role="dialog" aria-modal="true">
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2 class="modal-title">Edit objective</h2>
      <button class="modal-close" onclick={closeEditModal} aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 4l12 12M16 4L4 16"/>
        </svg>
      </button>
    </div>
    <form class="modal-form" onsubmit={handleEdit}>
      <div class="field">
        <label for="edit-name" class="field-label">Name</label>
        <input
          id="edit-name"
          type="text"
          bind:value={editName}
          placeholder="Objective name"
          class="field-input"
          required
          aria-required="true"
        />
      </div>
      <div class="field">
        <label for="edit-desc" class="field-label">Description</label>
        <textarea
          id="edit-desc"
          bind:value={editDescription}
          placeholder="What should this objective accomplish?"
          class="field-input field-textarea"
          rows="3"
        ></textarea>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="edit-bots" class="field-label">Max bots</label>
          <input
            id="edit-bots"
            type="number"
            bind:value={editMaxBots}
            min="3"
            max="20"
            class="field-input"
          />
        </div>
        <div class="field">
          <label for="edit-budget" class="field-label">Budget cap ($)</label>
          <input
            id="edit-budget"
            type="number"
            bind:value={editBudgetCap}
            min="0"
            step="0.01"
            placeholder="No cap"
            class="field-input"
          />
        </div>
        <div class="field">
          <label for="edit-runtime" class="field-label">Runtime limit (s)</label>
          <input
            id="edit-runtime"
            type="number"
            bind:value={editRuntimeLimit}
            min="60"
            placeholder="No limit"
            class="field-input"
          />
        </div>
      </div>
      {#if editError}
        <p class="field-error" role="alert">{editError}</p>
      {/if}
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick={closeEditModal}>Cancel</button>
        <button type="submit" class="btn-primary" disabled={editSubmitting}>
          {editSubmitting ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </form>
  </div>
</div>
{/if}

{#if showDeleteConfirm}
<div class="modal-overlay" onclick={closeDeleteConfirm} role="dialog" aria-modal="true">
  <div class="modal modal-confirm" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2 class="modal-title">Delete objective?</h2>
      <button class="modal-close" onclick={closeDeleteConfirm} aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 4l12 12M16 4L4 16"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <p>This will permanently delete the objective and cannot be undone.</p>
      {#if deleteError}
        <p class="field-error" role="alert">{deleteError}</p>
      {/if}
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" onclick={closeDeleteConfirm}>Cancel</button>
      <button type="button" class="btn-danger" onclick={handleDelete} disabled={deleteSubmitting}>
        {deleteSubmitting ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  .objectives-page {
    max-width: 900px;
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
    color: var(--fo-plum);
    margin: 0;
  }

  .objectives-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .objective-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-lg);
    padding: var(--space-lg);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    transition: border-color 0.15s;
  }

  .objective-card:hover {
    border-color: var(--fo-plum-m);
  }

  .objective-card-main {
    flex: 1;
    min-width: 0;
  }

  .objective-header {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-sm);
    flex-wrap: wrap;
  }

  .objective-name {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--fo-plum);
    text-decoration: none;
    margin: 0;
  }

  .objective-name:hover {
    color: var(--fo-plum-m);
  }

  .objective-status {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
  }

  .objective-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 var(--space-md);
    line-height: 1.5;
  }

  .objective-meta {
    display: flex;
    gap: var(--space-xl);
    flex-wrap: wrap;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .meta-label {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .meta-value {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
  }

  .objective-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-shrink: 0;
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
    transition: background 0.15s;
    border: none;
    cursor: pointer;
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

  .btn-ghost {
    display: inline-flex;
    align-items: center;
    padding: 8px 14px;
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    border-radius: var(--radius-md);
    transition: color 0.15s, background 0.15s;
  }

  .btn-ghost:hover {
    color: var(--fo-plum);
    background: var(--fo-bg2);
  }

  .btn-run {
    display: inline-flex;
    align-items: center;
    padding: 8px 16px;
    background: var(--bo-teal);
    color: #fff;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
  }

  .btn-run:hover:not(:disabled) {
    background: color-mix(in srgb, var(--bo-teal) 85%, black);
    transform: translateY(-1px);
  }

  .btn-run:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .btn-icon:hover {
    color: var(--fo-plum);
    border-color: var(--fo-plum-m);
  }

  .btn-icon.btn-danger:hover {
    color: var(--error);
    border-color: var(--error);
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
    transition: background 0.15s;
  }

  .btn-danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--error) 85%, black);
  }

  .btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
    font-size: 18px;
    font-weight: 600;
    color: var(--fo-plum);
    margin: 0;
  }

  .empty-body {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--space-lg);
  }

  .modal {
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-confirm {
    max-width: 400px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg);
    border-bottom: 1px solid var(--fo-border);
  }

  .modal-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    color: var(--fo-plum);
    margin: 0;
  }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    color: var(--text-muted);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: color 0.15s;
  }

  .modal-close:hover {
    color: var(--fo-plum);
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    padding: var(--space-lg);
  }

  .modal-body {
    padding: var(--space-lg);
  }

  .modal-body p {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text-muted);
    margin: 0;
  }

  .modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-md);
    padding: var(--space-lg);
    border-top: 1px solid var(--fo-border);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .field-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-md);
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
    outline: 2px solid color-mix(in srgb, var(--fo-plum) 20%, transparent);
    outline-offset: 1px;
  }

  .field-textarea {
    resize: vertical;
    line-height: 1.65;
  }

  .field-error {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--error);
    margin: 0;
  }

  @media (max-width: 600px) {
    .objective-card {
      flex-direction: column;
    }

    .objective-actions {
      width: 100%;
      justify-content: flex-end;
    }

    .field-row {
      grid-template-columns: 1fr;
    }
  }
</style>
