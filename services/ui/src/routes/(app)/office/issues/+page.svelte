<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';

  let { data }: { data: PageData } = $props();

  let showCreateModal = $state(false);
  let createTitle = $state('');
  let createBody = $state('');
  let createProjectId = $state('');
  let createAssigneeAgentId = $state('');
  let createSubmitting = $state(false);
  let createError = $state('');

  let selectedIssues = $state<Set<string>>(new Set());
  let bulkActionLoading = $state(false);

  let searchQuery = $state(data.filters.q ?? '');
  let statusFilter = $state(data.filters.status ?? '');
  let assigneeFilter = $state(data.filters.assignee ?? '');
  let projectFilter = $state(data.filters.project ?? '');
  let sortBy = $state(data.filters.sortBy ?? 'createdAt');
  let sortOrder = $state(data.filters.sortOrder ?? 'desc');

  let searchTimeout: ReturnType<typeof setTimeout>;

  function buildUrl(overrides: Record<string, string | number | undefined> = {}) {
    const params = new URLSearchParams();
    const q = overrides.q ?? searchQuery;
    const status = overrides.status ?? statusFilter;
    const assignee = overrides.assignee ?? assigneeFilter;
    const project = overrides.project ?? projectFilter;
    const sort = overrides.sortBy ?? sortBy;
    const order = overrides.sortOrder ?? sortOrder;
    const pg = overrides.page ?? data.page;

    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (assignee) params.set('assignee', assignee);
    if (project) params.set('project', project);
    params.set('sortBy', sort);
    params.set('sortOrder', order);
    params.set('page', String(pg));
    return `/office/issues?${params.toString()}`;
  }

  function applyFilters() {
    goto(buildUrl(), { replaceState: true });
  }

  function debouncedSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      applyFilters();
    }, 350);
  }

  function toggleSelectAll() {
    if (selectedIssues.size === data.issues.length) {
      selectedIssues = new Set();
    } else {
      selectedIssues = new Set(data.issues.map((i: { id: string }) => i.id));
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIssues);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedIssues = next;
  }

  async function bulkUpdateStatus(status: 'open' | 'closed') {
    bulkActionLoading = true;
    const ids = Array.from(selectedIssues);
    await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/issues/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }),
      ),
    );
    selectedIssues = new Set();
    bulkActionLoading = false;
    goto(buildUrl(), { invalidateAll: true });
  }

  async function handleCreateIssue() {
    if (!createTitle.trim()) return;
    createSubmitting = true;
    createError = '';
    try {
      const res = await fetch(`/api/companies/${data.companyId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createTitle.trim(),
          body: createBody.trim() || undefined,
          projectId: createProjectId || undefined,
          assigneeAgentId: createAssigneeAgentId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create issue' }));
        createError = (err as { error?: string }).error ?? 'Failed to create issue';
        return;
      }
      showCreateModal = false;
      createTitle = '';
      createBody = '';
      createProjectId = '';
      createAssigneeAgentId = '';
      goto(buildUrl(), { invalidateAll: true });
    } catch {
      createError = 'Network error. Please try again.';
    } finally {
      createSubmitting = false;
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'open': return 'open';
      case 'in_progress': return 'in progress';
      case 'blocked': return 'blocked';
      case 'done': return 'done';
      default: return status.toLowerCase();
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'open': return 'var(--fo-plum-m)';
      case 'in_progress': return 'var(--fo-gold, #B8965A)';
      case 'blocked': return 'var(--error)';
      case 'done': return 'var(--bo-teal, #2DD4BF)';
      default: return 'var(--text-muted)';
    }
  }

  const allSelected = $derived(data.issues.length > 0 && selectedIssues.size === data.issues.length);
  const someSelected = $derived(selectedIssues.size > 0);
</script>

<div class="issues-page">
  <div class="page-header">
    <h1 class="page-title">Issues</h1>
    <button class="btn-primary" type="button" onclick={() => { showCreateModal = true; }}>
      + New issue
    </button>
  </div>

  <div class="toolbar">
    <div class="toolbar-row">
      <div class="search-wrap">
        <input
          type="search"
          class="search-input"
          placeholder="Search issues..."
          bind:value={searchQuery}
          oninput={debouncedSearch}
          aria-label="Search issues"
        />
      </div>

      <div class="filters">
        <select bind:value={statusFilter} onchange={applyFilters} class="filter-select" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
        </select>

        <select bind:value={assigneeFilter} onchange={applyFilters} class="filter-select" aria-label="Filter by assignee">
          <option value="">All assignees</option>
          {#each data.agents as agent}
            <option value={agent.id}>{agent.name}</option>
          {/each}
        </select>

        <select bind:value={projectFilter} onchange={applyFilters} class="filter-select" aria-label="Filter by project">
          <option value="">All projects</option>
          {#each data.projects as project}
            <option value={project.id}>{project.name}</option>
          {/each}
        </select>

        <select
          bind:value={sortBy}
          onchange={() => { sortOrder = 'desc'; applyFilters(); }}
          class="filter-select"
          aria-label="Sort by"
        >
          <option value="createdAt">Created date</option>
          <option value="updatedAt">Updated date</option>
          <option value="status">Status</option>
        </select>

        <button
          type="button"
          class="sort-order-btn"
          onclick={() => { sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'; applyFilters(); }}
          aria-label="Sort order: {sortOrder === 'asc' ? 'ascending' : 'descending'}"
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>
    </div>

    {#if someSelected}
      <div class="bulk-actions">
        <span class="bulk-count">{selectedIssues.size} selected</span>
        <button type="button" class="btn-bulk" onclick={() => bulkUpdateStatus('open')} disabled={bulkActionLoading}>
          Reopen
        </button>
        <button type="button" class="btn-bulk" onclick={() => bulkUpdateStatus('closed')} disabled={bulkActionLoading}>
          Close
        </button>
      </div>
    {/if}
  </div>

  {#if data.issues.length === 0}
    <div class="empty-state" aria-busy="false">
      <span class="empty-eyebrow">NO ISSUES</span>
      <p class="empty-heading">Nothing found.</p>
      <p class="empty-body">
        {#if searchQuery || statusFilter || assigneeFilter || projectFilter}
          No issues match your filters. Try adjusting your search or filters.
        {:else}
          No issues assigned. Indra will route tasks here as your crew works.
        {/if}
      </p>
    </div>
  {:else}
    <div class="issues-table-wrap">
      <table class="issues-table">
        <thead>
          <tr>
            <th class="th-checkbox">
              <input
                type="checkbox"
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onchange={toggleSelectAll}
                aria-label="Select all"
              />
            </th>
            <th class="th-status">Status</th>
            <th class="th-title">Title</th>
            <th class="th-priority">Priority</th>
            <th class="th-assignee">Assignee</th>
            <th class="th-created">Created</th>
          </tr>
        </thead>
        <tbody>
          {#each data.issues as issue}
            <tr class="issue-row" class:selected={selectedIssues.has(issue.id)}>
              <td class="td-checkbox">
                <input
                  type="checkbox"
                  checked={selectedIssues.has(issue.id)}
                  onchange={() => toggleSelect(issue.id)}
                  aria-label="Select issue"
                />
              </td>
              <td class="td-status">
                <span class="status-label" style="color: {getStatusColor(issue.status)}">
                  {getStatusLabel(issue.status)}
                </span>
              </td>
              <td class="td-title">
                <a href="/office/issues/{issue.id}" class="issue-link">{issue.title}</a>
                {#if issue.executionId}
                  <span class="execution-badge" title="From execution {issue.executionId}">
                    ↗ exec
                  </span>
                {/if}
              </td>
              <td class="td-priority">
                <span class="meta-text">—</span>
              </td>
              <td class="td-assignee">
                {#if issue.assigneeAgentId}
                  {@const agent = data.agents.find((a: { id: string }) => a.id === issue.assigneeAgentId)}
                  <span class="meta-text">{agent?.name ?? 'Assigned'}</span>
                {:else}
                  <span class="meta-text">—</span>
                {/if}
              </td>
              <td class="td-created">
                <span class="meta-text">{formatDate(issue.createdAt)}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if data.totalPages > 1}
      <div class="pagination">
        <span class="pagination-info">
          Page {data.page} of {data.totalPages} ({data.totalCount} issues)
        </span>
        <div class="pagination-controls">
          {#if data.page > 1}
            <a href={buildUrl({ page: data.page - 1 })} class="page-btn">← Previous</a>
          {/if}
          {#if data.page < data.totalPages}
            <a href={buildUrl({ page: data.page + 1 })} class="page-btn">Next →</a>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

{#if showCreateModal}
  <div class="modal-overlay" onclick={() => { showCreateModal = false; }} role="dialog" aria-modal="true">
    <div class="modal-box" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div class="modal-header-text">
          <span class="modal-tag">NEW ISSUE</span>
          <h2 class="modal-title">Create Issue</h2>
        </div>
        <button class="modal-close" onclick={() => { showCreateModal = false; }} aria-label="Close">&#10005;</button>
      </div>
      <div class="modal-body">
        <form onsubmit={(e) => { e.preventDefault(); handleCreateIssue(); }}>
          <div class="form-field">
            <label class="field-label" for="issue-title">Title</label>
            <input
              id="issue-title"
              type="text"
              class="form-input"
              bind:value={createTitle}
              placeholder="Issue title"
              required
              disabled={createSubmitting}
            />
          </div>

          <div class="form-field">
            <label class="field-label" for="issue-body">Description</label>
            <textarea
              id="issue-body"
              class="form-input form-textarea"
              bind:value={createBody}
              placeholder="Add details about the issue..."
              rows="4"
              disabled={createSubmitting}
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label class="field-label" for="issue-project">Project</label>
              <select id="issue-project" class="form-select" bind:value={createProjectId} disabled={createSubmitting}>
                <option value="">No project</option>
                {#each data.projects as project}
                  <option value={project.id}>{project.name}</option>
                {/each}
              </select>
            </div>

            <div class="form-field">
              <label class="field-label" for="issue-assignee">Assignee</label>
              <select id="issue-assignee" class="form-select" bind:value={createAssigneeAgentId} disabled={createSubmitting}>
                <option value="">Unassigned</option>
                {#each data.agents as agent}
                  <option value={agent.id}>{agent.name}</option>
                {/each}
              </select>
            </div>
          </div>

          {#if createError}
            <p class="form-error" role="alert">{createError}</p>
          {/if}

          <div class="form-actions">
            <button type="button" class="btn-ghost" onclick={() => { showCreateModal = false; }} disabled={createSubmitting}>
              Cancel
            </button>
            <button type="submit" class="btn-primary" disabled={createSubmitting || !createTitle.trim()}>
              {createSubmitting ? 'Creating...' : 'Create issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<style>
  .issues-page {
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
    color: var(--fo-plum);
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
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s;
    text-decoration: none;
  }

  .btn-primary:hover {
    background: var(--fo-plum-m);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .toolbar {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
  }

  .toolbar-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .search-wrap {
    flex: 1;
    min-width: 200px;
    max-width: 320px;
  }

  .search-input {
    width: 100%;
    min-height: 40px;
    padding: 0 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--fo-border);
    background: var(--fo-card);
    color: inherit;
    font-family: var(--font-body);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }

  .search-input:focus {
    border-color: var(--fo-plum-m);
  }

  .filters {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .filter-select {
    min-height: 40px;
    padding: 0 10px;
    border-radius: var(--radius-md);
    border: 1px solid var(--fo-border);
    background: var(--fo-card);
    color: inherit;
    font-family: var(--font-body);
    font-size: 12px;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .filter-select:focus {
    border-color: var(--fo-plum-m);
  }

  .sort-order-btn {
    min-height: 40px;
    min-width: 40px;
    padding: 0 10px;
    border-radius: var(--radius-md);
    border: 1px solid var(--fo-border);
    background: var(--fo-card);
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .sort-order-btn:hover {
    border-color: var(--fo-plum-m);
    color: var(--fo-plum);
  }

  .bulk-actions {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    background: var(--fo-bg2);
    border-radius: var(--radius-md);
  }

  .bulk-count {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
  }

  .btn-bulk {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .btn-bulk:hover:not(:disabled) {
    border-color: var(--fo-plum-m);
    color: var(--fo-plum);
  }

  .btn-bulk:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .issues-table-wrap {
    overflow-x: auto;
  }

  .issues-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-body);
    font-size: 13px;
  }

  .issues-table th {
    text-align: left;
    padding: 8px 12px;
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
    border-bottom: 1px solid var(--fo-border);
    white-space: nowrap;
  }

  .th-checkbox {
    width: 36px;
  }

  .issue-row {
    cursor: pointer;
    transition: background 0.1s;
  }

  .issue-row:hover {
    background: var(--fo-bg2);
  }

  .issue-row.selected {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .issues-table td {
    padding: 12px 12px;
    border-bottom: 1px solid var(--fo-border);
    vertical-align: middle;
  }

  .td-checkbox {
    width: 36px;
  }

  .td-checkbox input,
  .th-checkbox input {
    cursor: pointer;
    accent-color: var(--fo-plum);
  }

  .status-label {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
  }

  .td-title {
    max-width: 400px;
  }

  .issue-link {
    color: inherit;
    text-decoration: none;
    font-weight: 400;
    transition: color 0.15s;
  }

  .issue-link:hover {
    color: var(--accent);
  }

  .execution-badge {
    display: inline-block;
    margin-left: var(--space-sm);
    padding: 2px 6px;
    background: var(--fo-bg3);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    vertical-align: middle;
  }

  .meta-text {
    color: var(--text-muted);
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
    color: var(--text);
    margin: 0;
  }

  .empty-body {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: var(--space-xl);
    padding-top: var(--space-lg);
    border-top: 1px solid var(--fo-border);
  }

  .pagination-info {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
  }

  .pagination-controls {
    display: flex;
    gap: var(--space-sm);
  }

  .page-btn {
    padding: 8px 14px;
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text);
    text-decoration: none;
    transition: border-color 0.15s, color 0.15s;
  }

  .page-btn:hover {
    border-color: var(--fo-plum-m);
    color: var(--fo-plum);
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
    background: color-mix(in srgb, var(--text) 35%, transparent);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-box {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    width: 560px;
    max-width: calc(100vw - 40px);
    max-height: 80vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    padding: 22px 26px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .modal-header-text {
    display: flex;
    flex-direction: column;
  }

  .modal-tag {
    font-family: var(--font-label);
    font-size: 6px;
    color: var(--accent);
    letter-spacing: 0.10em;
    display: block;
    margin-bottom: 7px;
  }

  .modal-title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .modal-close {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--accent-dim);
    border: 1px solid var(--border);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .modal-close:hover {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  .modal-body {
    padding: 22px 26px;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.85;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: var(--space-lg);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-lg);
  }

  .field-label {
    font-family: var(--font-label);
    font-size: 6px;
    color: var(--text-muted);
    letter-spacing: 0.10em;
    text-transform: uppercase;
  }

  .form-input {
    min-height: 44px;
    padding: 0 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--card);
    color: inherit;
    font: inherit;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
  }

  .form-input:focus {
    border-color: var(--accent);
  }

  .form-input:disabled {
    opacity: 0.6;
  }

  .form-textarea {
    padding: 12px 14px;
    resize: vertical;
    line-height: 1.6;
  }

  .form-select {
    min-height: 44px;
    padding: 0 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--card);
    color: inherit;
    font: inherit;
    font-size: 13px;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
  }

  .form-select:focus {
    border-color: var(--accent);
  }

  .form-select:disabled {
    opacity: 0.6;
  }

  .form-error {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--error);
    margin: 0 0 var(--space-md);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-md);
    margin-top: var(--space-lg);
  }

  .btn-ghost {
    display: inline-flex;
    align-items: center;
    padding: 10px 18px;
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .btn-ghost:hover:not(:disabled) {
    border-color: var(--fo-plum-m);
    color: var(--fo-plum);
  }

  .btn-ghost:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
