<script lang="ts">
  import type { PageData } from './$types';
  import { invalidateAll, goto } from '$app/navigation';
  import SlidePanel from '$lib/components/SlidePanel.svelte';
  import Input from '$lib/components/ui/Input.svelte';

  let { data }: { data: PageData } = $props();

  let selectedRepo = $state<string | null>(null);
  let selectedBranch = $state<string | null>(null);
  let repos = $state<Array<{
    id: number;
    name: string;
    fullName: string;
    owner: string;
    isPrivate: boolean;
    cloneUrl: string;
    defaultBranch: string;
  }>>([]);
  let branches = $state<Array<{ name: string; sha: string; isProtected: boolean }>>([]);
  let loadingRepos = $state(false);
  let loadingBranches = $state(false);
  let repoSearch = $state('');

  let showEditForm = $state(false);
  let showDeleteConfirm = $state(false);
  let editName = $state(data.project.name);
  let editDescription = $state(data.project.description ?? '');
  let editGithubRepo = $state(data.project.githubRepo ?? '');
  let editError = $state('');
  let editing = $state(false);
  let deleting = $state(false);

  let editNameError = $state('');
  let editDescriptionError = $state('');

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function getConnectionStatusLabel(status: string | null): string {
    switch (status) {
      case 'connected': return 'Connected';
      case 'expired': return 'Expired';
      case 'disconnected': return 'Disconnected';
      default: return 'Not connected';
    }
  }

  function getConnectionStatusClass(status: string | null): string {
    switch (status) {
      case 'connected': return 'status-connected';
      case 'expired': return 'status-expired';
      case 'disconnected': return 'status-disconnected';
      default: return 'status-none';
    }
  }

  function getExecutionStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'var(--accent-teal)';
      case 'failed': return 'var(--error)';
      case 'running': return 'var(--fo-gold)';
      case 'queued': return 'var(--fo-plum-m)';
      default: return 'var(--text-muted)';
    }
  }

  function getIssueStatusColor(status: string): string {
    switch (status) {
      case 'open': return 'var(--fo-plum-m)';
      case 'in_progress': return 'var(--fo-gold)';
      case 'blocked': return 'var(--error)';
      case 'done': return 'var(--accent-teal)';
      default: return 'var(--text-muted)';
    }
  }

  async function loadRepos() {
    if (!data.session?.user?.id) return;
    loadingRepos = true;
    try {
      const res = await fetch(`/api/akasa/github/repos?userId=${encodeURIComponent(data.session.user.id)}`);
      if (res.ok) {
        repos = await res.json();
      }
    } catch {
      repos = [];
    } finally {
      loadingRepos = false;
    }
  }

  async function loadBranches(repoFullName: string) {
    if (!data.session?.user?.id) return;
    const [owner, repo] = repoFullName.split('/');
    loadingBranches = true;
    try {
      const res = await fetch(`/api/akasa/github/repos/${owner}/${repo}/branches?userId=${encodeURIComponent(data.session.user.id)}`);
      if (res.ok) {
        branches = await res.json();
      }
    } catch {
      branches = [];
    } finally {
      loadingBranches = false;
    }
  }

  async function handleConnectGithub() {
    if (!data.session?.user?.id) return;
    const redirectUri = `${window.location.origin}/office/projects/${data.project.id}`;
    goto(`/akasa/tool-connections/oauth/github/start?userId=${encodeURIComponent(data.session.user.id)}&redirectUri=${encodeURIComponent(redirectUri)}`);
  }

  async function handleEditProject() {
    editNameError = '';
    editDescriptionError = '';
    editError = '';

    if (!editName.trim()) {
      editNameError = 'Project name is required';
      return;
    }

    editing = true;
    try {
      const res = await fetch(`/api/projects/${data.project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || undefined,
          githubRepo: editGithubRepo.trim() || undefined,
        }),
      });
      if (res.ok) {
        await invalidateAll();
      } else {
        const body = await res.text();
        editError = `Failed to update project: ${body}`;
      }
    } catch {
      editError = 'Failed to update project';
    } finally {
      editing = false;
    }
  }

  async function handleDeleteProject() {
    deleting = true;
    try {
      const res = await fetch(`/api/projects/${data.project.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        goto('/office/projects');
      } else {
        const body = await res.text();
        editError = `Failed to delete project: ${body}`;
        showDeleteConfirm = false;
      }
    } catch {
      editError = 'Failed to delete project';
      showDeleteConfirm = false;
    } finally {
      deleting = false;
    }
  }

  $effect(() => {
    if (data.githubConnection?.status === 'connected' && data.session?.user?.id) {
      loadRepos();
    }
  });

  let filteredRepos = $derived(
    repoSearch
      ? repos.filter(r => r.fullName.toLowerCase().includes(repoSearch.toLowerCase()))
      : repos
  );
</script>

<div class="project-detail">
  <div class="back-row">
    <a href="/office/projects" class="back-link">&larr; Projects</a>
  </div>

  <div class="project-header">
    <div class="project-title-row">
      <h1 class="project-name">{data.project.name}</h1>
      <div class="header-actions">
        <button class="btn-ghost" type="button" onclick={() => { showEditForm = true; editName = data.project.name; editDescription = data.project.description ?? ''; editGithubRepo = data.project.githubRepo ?? ''; }}>
          Edit
        </button>
        <button class="btn-danger-ghost" type="button" onclick={() => { showDeleteConfirm = true; }}>
          Delete
        </button>
      </div>
    </div>
  </div>

  {#if data.project.description}
    <div class="project-description">
      {data.project.description}
    </div>
  {/if}

  <div class="project-meta">
    <div class="meta-row">
      <span class="meta-label">Created</span>
      <span class="meta-value">{formatDate(data.project.createdAt)}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Last updated</span>
      <span class="meta-value">{formatDate(data.project.updatedAt)}</span>
    </div>
    {#if data.project.githubRepo}
      <div class="meta-row">
        <span class="meta-label">Repository</span>
        <span class="meta-value repo-value">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          {data.project.githubRepo}
        </span>
      </div>
    {/if}
  </div>

  <div class="section-divider"></div>

  <div class="github-section">
    <h2 class="section-title">GitHub Connection</h2>

    {#if data.githubConnection}
      <div class="connection-status-row">
        <span class="connection-indicator {getConnectionStatusClass(data.githubConnection.status)}">
          <span class="status-dot"></span>
          {getConnectionStatusLabel(data.githubConnection.status)}
        </span>
        <a href="/settings/tools" class="manage-link">Manage connection</a>
      </div>

      {#if data.githubConnection.status === 'connected'}
        <div class="repo-section">
          <label class="field-label" for="repo-search">Repository</label>
          {#if loadingRepos}
            <div class="loading-text">Loading repositories...</div>
          {:else if repos.length > 0}
            <input
              id="repo-search"
              type="text"
              class="repo-search"
              placeholder="Search repositories..."
              bind:value={repoSearch}
            />
            <div class="repo-list">
              {#each filteredRepos as repo}
                <button
                  type="button"
                  class="repo-item"
                  class:selected={selectedRepo === repo.fullName}
                  onclick={() => { selectedRepo = repo.fullName; loadBranches(repo.fullName); selectedBranch = null; }}
                >
                  <span class="repo-name">{repo.fullName}</span>
                  <span class="repo-visibility">{repo.isPrivate ? 'Private' : 'Public'}</span>
                </button>
              {/each}
            </div>
          {:else}
            <div class="empty-text">No repositories found</div>
          {/if}
        </div>

        {#if selectedRepo && branches.length > 0}
          <div class="branch-section">
            <label class="field-label" for="branch-select">Branch</label>
            {#if loadingBranches}
              <div class="loading-text">Loading branches...</div>
            {:else}
              <select id="branch-select" class="branch-select" bind:value={selectedBranch}>
                <option value={null}>Select a branch</option>
                {#each branches as branch}
                  <option value={branch.name}>{branch.name}{branch.isProtected ? ' (protected)' : ''}</option>
                {/each}
              </select>
            {/if}
          </div>
        {/if}

        {#if selectedRepo && selectedBranch}
          <div class="selected-info">
            <span class="info-label">Selected:</span>
            <span class="info-value">{selectedRepo} @ {selectedBranch}</span>
          </div>
        {/if}
      {/if}
    {:else}
      <div class="connect-prompt">
        <p class="connect-description">
          Connect your GitHub account to enable your agents to clone, read, and push to repositories.
        </p>
        <button type="button" class="connect-btn" onclick={handleConnectGithub}>
          <svg class="github-icon" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          Connect GitHub
        </button>
      </div>
    {/if}
  </div>

  <div class="section-divider"></div>

  <div class="objectives-section">
    <h2 class="section-title">Objectives</h2>
    {#if data.objectives.length === 0}
      <div class="empty-section">
        <p class="empty-text">No objectives linked to this project yet.</p>
      </div>
    {:else}
      <div class="objectives-list">
        {#each data.objectives as objective}
          <a href="/office/goals/{objective.id}" class="objective-card">
            <div class="objective-header">
              <h3 class="objective-name">{objective.name}</h3>
              {#if objective.lastRunStatus}
                <span class="objective-status" style="color: {getExecutionStatusColor(objective.lastRunStatus)}">
                  {objective.lastRunStatus}
                </span>
              {/if}
            </div>
            {#if objective.description}
              <p class="objective-desc">{objective.description}</p>
            {/if}
            <div class="objective-meta">
              <span class="meta-text">{objective.runCount} runs</span>
              {#if objective.isArchived}
                <span class="archived-badge">Archived</span>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>

  <div class="section-divider"></div>

  <div class="executions-section">
    <h2 class="section-title">Recent Executions</h2>
    {#if data.executions.length === 0}
      <div class="empty-section">
        <p class="empty-text">No executions for this project yet.</p>
      </div>
    {:else}
      <div class="executions-list">
        {#each data.executions.slice(0, 10) as execution}
          <div class="execution-item">
            <div class="execution-info">
              <span class="execution-objective">{execution.objective}</span>
              <span class="execution-date">{formatDateTime(execution.createdAt)}</span>
            </div>
            <span class="execution-status" style="color: {getExecutionStatusColor(execution.status)}">
              {execution.status}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="section-divider"></div>

  <div class="issues-section">
    <h2 class="section-title">Issues</h2>
    {#if data.issues.length === 0}
      <div class="empty-section">
        <p class="empty-text">No issues linked to this project yet.</p>
      </div>
    {:else}
      <div class="issues-list">
        {#each data.issues as issue}
          <a href="/office/issues/{issue.id}" class="issue-item">
            <span class="issue-status" style="color: {getIssueStatusColor(issue.status)}">{issue.status.replace('_', ' ')}</span>
            <span class="issue-title">{issue.title}</span>
            <span class="issue-date">{formatDate(issue.createdAt)}</span>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>

<SlidePanel open={showEditForm} title="Edit Project" onclose={() => { showEditForm = false; editError = ''; }}>
  <form class="edit-form" onsubmit={(e) => { e.preventDefault(); handleEditProject(); }}>
    <Input
      id="edit-name"
      label="Project name"
      bind:value={editName}
      error={editNameError}
    />
    <Input
      id="edit-desc"
      label="Description (optional)"
      bind:value={editDescription}
    />
    <Input
      id="edit-github"
      label="GitHub repository (optional)"
      bind:value={editGithubRepo}
      placeholder="owner/repo"
    />
    {#if editError}
      <p class="error-text">{editError}</p>
    {/if}
    <div class="form-actions">
      <button type="button" class="btn-ghost" onclick={() => { showEditForm = false; editError = ''; }}>
        Cancel
      </button>
      <button type="submit" class="btn-primary" disabled={editing}>
        {editing ? 'Saving...' : 'Save changes'}
      </button>
    </div>
  </form>
</SlidePanel>

<SlidePanel open={showDeleteConfirm} title="Delete Project" onclose={() => { showDeleteConfirm = false; }}>
  <div class="delete-confirm">
    <p class="delete-warning">
      Are you sure you want to delete <strong>{data.project.name}</strong>? This action cannot be undone.
    </p>
    {#if editError}
      <p class="error-text">{editError}</p>
    {/if}
    <div class="form-actions">
      <button type="button" class="btn-ghost" onclick={() => { showDeleteConfirm = false; }}>
        Cancel
      </button>
      <button type="button" class="btn-danger" disabled={deleting} onclick={handleDeleteProject}>
        {deleting ? 'Deleting...' : 'Delete project'}
      </button>
    </div>
  </div>
</SlidePanel>

<style>
  .project-detail {
    max-width: 800px;
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

  .project-header {
    margin-bottom: var(--space-xl);
  }

  .project-title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-lg);
  }

  .project-name {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--fo-plum);
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: var(--space-sm);
    flex-shrink: 0;
  }

  .btn-ghost {
    display: inline-flex;
    align-items: center;
    padding: 8px 14px;
    background: transparent;
    color: var(--text);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    text-decoration: none;
  }

  .btn-ghost:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .btn-danger-ghost {
    display: inline-flex;
    align-items: center;
    padding: 8px 14px;
    background: transparent;
    color: var(--error);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    border: 1px solid var(--error);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    text-decoration: none;
  }

  .btn-danger-ghost:hover {
    background: var(--error);
    color: white;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 8px 14px;
    background: var(--accent);
    color: white;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s;
    text-decoration: none;
  }

  .btn-primary:hover {
    background: var(--accent-m);
  }

  .btn-primary:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .btn-danger {
    display: inline-flex;
    align-items: center;
    padding: 8px 14px;
    background: var(--error);
    color: white;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s;
    text-decoration: none;
  }

  .btn-danger:hover {
    background: #dc2626;
  }

  .btn-danger:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .project-description {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.8;
    margin-bottom: var(--space-xl);
    color: var(--text);
  }

  .project-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    border-top: 1px solid var(--fo-border);
    padding-top: var(--space-xl);
  }

  .meta-row {
    display: flex;
    gap: var(--space-xl);
  }

  .meta-label {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    width: 120px;
    flex-shrink: 0;
  }

  .meta-value {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
  }

  .repo-value {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .section-divider {
    height: 1px;
    background: var(--fo-border);
    margin: var(--space-2xl) 0;
  }

  .github-section,
  .objectives-section,
  .executions-section,
  .issues-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--fo-plum);
    margin: 0;
  }

  .connection-status-row {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
  }

  .connection-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-family: var(--font-body);
    font-size: 13px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-connected .status-dot {
    background: #22c55e;
  }

  .status-expired .status-dot {
    background: #f59e0b;
  }

  .status-disconnected .status-dot {
    background: #6b7280;
  }

  .status-none .status-dot {
    background: #d1d5db;
  }

  .manage-link {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--fo-plum-m);
    text-decoration: none;
  }

  .manage-link:hover {
    text-decoration: underline;
  }

  .repo-section,
  .branch-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .field-label {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .repo-search {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 13px;
    background: var(--fo-card);
    color: var(--fo-text);
    width: 100%;
    box-sizing: border-box;
  }

  .repo-search:focus {
    outline: none;
    border-color: var(--fo-plum-m);
  }

  .repo-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 240px;
    overflow-y: auto;
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-sm);
  }

  .repo-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    background: var(--fo-card);
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }

  .repo-item:hover {
    background: var(--fo-border);
  }

  .repo-item.selected {
    background: var(--fo-plum);
    color: white;
  }

  .repo-name {
    font-family: var(--font-body);
    font-size: 13px;
  }

  .repo-visibility {
    font-family: var(--font-body);
    font-size: 11px;
    opacity: 0.7;
  }

  .branch-select {
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 13px;
    background: var(--fo-card);
    color: var(--fo-text);
    width: 100%;
    box-sizing: border-box;
  }

  .branch-select:focus {
    outline: none;
    border-color: var(--fo-plum-m);
  }

  .selected-info {
    display: flex;
    gap: var(--space-sm);
    padding: var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-sm);
  }

  .info-label {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
  }

  .info-value {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--fo-plum);
  }

  .loading-text,
  .empty-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    padding: var(--space-md) 0;
  }

  .empty-section {
    padding: var(--space-lg) 0;
  }

  .connect-prompt {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-xl);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
  }

  .connect-description {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.6;
  }

  .connect-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    background: var(--fo-plum);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    align-self: flex-start;
  }

  .connect-btn:hover {
    background: var(--fo-plum-m);
  }

  .github-icon {
    flex-shrink: 0;
  }

  .objectives-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .objective-card {
    display: block;
    padding: var(--space-lg);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s;
  }

  .objective-card:hover {
    border-color: var(--fo-plum-m);
  }

  .objective-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    margin-bottom: var(--space-sm);
  }

  .objective-name {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--fo-plum);
    margin: 0;
  }

  .objective-status {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .objective-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 var(--space-sm);
    line-height: 1.5;
  }

  .objective-meta {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .archived-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
    background: var(--fo-border);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .executions-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .execution-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-sm);
  }

  .execution-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .execution-objective {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
  }

  .execution-date {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }

  .execution-status {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .issues-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .issue-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-sm);
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s;
  }

  .issue-item:hover {
    border-color: var(--fo-plum-m);
  }

  .issue-status {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    flex-shrink: 0;
    min-width: 80px;
  }

  .issue-title {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    flex: 1;
  }

  .issue-date {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .edit-form,
  .delete-confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .delete-warning {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text);
    line-height: 1.6;
    margin: 0;
  }

  .error-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--error);
    margin: 0;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-md);
    margin-top: var(--space-md);
  }

  .meta-text {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
  }
</style>
