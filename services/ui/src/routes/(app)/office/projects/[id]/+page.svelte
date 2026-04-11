<script lang="ts">
  import type { PageData } from './$types';

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

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
    window.location.href = `/akasa/tool-connections/oauth/github/start?userId=${encodeURIComponent(data.session.user.id)}&redirectUri=${encodeURIComponent(redirectUri)}`;
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
    <h1 class="project-name">{data.project.name}</h1>
  </div>

  {#if data.project.description}
    <div class="project-description t-body">
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
        <a href="/tools/belt" class="manage-link">Manage connection</a>
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
</div>

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

  .project-name {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--fo-plum);
    margin: 0;
  }

  .project-description {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.8;
    margin-bottom: var(--space-xl);
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
  }

  .section-divider {
    height: 1px;
    background: var(--fo-border);
    margin: var(--space-2xl) 0;
  }

  .github-section {
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

  .project-name,
  .section-title {
    color: var(--text);
  }

  .project-meta {
    border-top-color: var(--border);
  }

  .manage-link,
  .info-value {
    color: var(--accent);
  }

  .repo-search,
  .branch-select,
  .repo-item,
  .selected-info,
  .connect-prompt {
    background: var(--card);
    border-color: var(--border);
    color: var(--text);
  }

  .repo-item:hover {
    background: color-mix(in srgb, var(--accent) 8%, var(--card));
  }

  .repo-item.selected {
    background: var(--accent);
    color: white;
  }

  .connect-btn {
    background: var(--accent);
  }

  .connect-btn:hover {
    background: var(--accent-m);
  }
</style>
