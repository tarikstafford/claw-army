<script lang="ts">
  import type { PageData } from './$types';
  import SlidePanel from '$lib/components/SlidePanel.svelte';
  import Input from '$lib/components/ui/Input.svelte';

  let { data }: { data: PageData } = $props();

  let showCreateForm = $state(false);
  let newProjectName = $state('');
  let newProjectDesc = $state('');
  let newProjectGithubRepo = $state('');
  let createError = $state('');
  let creating = $state(false);

  async function handleCreateProject() {
    if (!newProjectName.trim()) {
      createError = 'Project name is required';
      return;
    }
    creating = true;
    createError = '';
    try {
      const res = await fetch(`/api/companies/${data.companyId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim() || undefined,
          githubRepo: newProjectGithubRepo.trim() || undefined,
        }),
      });
      if (res.ok) {
        window.location.href = `/office/projects/${(await res.json()).id}`;
      } else {
        const body = await res.text();
        createError = `Failed to create project: ${body}`;
      }
    } catch (err) {
      createError = 'Failed to create project';
    } finally {
      creating = false;
    }
  }

  function formatDate(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<div class="projects-page">
  <div class="page-header">
    <h1 class="page-title">Projects</h1>
    <button class="btn-primary" type="button" onclick={() => { showCreateForm = true; }}>
      New project
    </button>
  </div>

  {#if data.projects.length === 0}
    <div class="empty-state" aria-busy="false">
      <span class="empty-eyebrow">NO PROJECTS</span>
      <p class="empty-heading">Nothing here yet.</p>
      <p class="empty-body">No projects yet. Projects help organize your crew's work.</p>
      <button class="btn-primary" type="button" onclick={() => { showCreateForm = true; }}>
        Create your first project
      </button>
    </div>
  {:else}
    <div class="projects-list">
      {#each data.projects as project}
        <a href="/office/projects/{project.id}" class="project-card">
          <div class="project-card-header">
            <h3 class="project-name">{project.name}</h3>
            {#if project.status}
              <span class="project-status">{project.status}</span>
            {/if}
          </div>
          {#if project.description}
            <p class="project-desc">{project.description}</p>
          {/if}
          {#if project.githubRepo}
            <div class="project-repo">
              <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span class="repo-text">{project.githubRepo}</span>
            </div>
          {/if}
          <div class="project-meta">
            <span class="meta-text">Updated {formatDate(project.updatedAt)}</span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<SlidePanel open={showCreateForm} title="New Project" onclose={() => { showCreateForm = false; createError = ''; }}>
  <form class="create-form" onsubmit={(e) => { e.preventDefault(); handleCreateProject(); }}>
    <Input
      id="project-name"
      label="Project name"
      bind:value={newProjectName}
      placeholder="e.g. Customer Support Automation"
    />
    <Input
      id="project-desc"
      label="Description (optional)"
      bind:value={newProjectDesc}
      placeholder="What is this project about?"
    />
    <Input
      id="project-github"
      label="GitHub repository (optional)"
      bind:value={newProjectGithubRepo}
      placeholder="owner/repo"
    />
    {#if createError}
      <p class="error-text">{createError}</p>
    {/if}
    <div class="form-actions">
      <button type="button" class="btn-ghost" onclick={() => { showCreateForm = false; createError = ''; }}>
        Cancel
      </button>
      <button type="submit" class="btn-primary" disabled={creating}>
        {creating ? 'Creating...' : 'Create project'}
      </button>
    </div>
  </form>
</SlidePanel>

<style>
  .projects-page {
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
    opacity: 0.65;
    cursor: not-allowed;
  }

  .btn-ghost {
    display: inline-flex;
    align-items: center;
    padding: 10px 18px;
    background: transparent;
    color: var(--text);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    text-decoration: none;
  }

  .btn-ghost:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .projects-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .project-card {
    display: block;
    padding: var(--space-lg);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s, transform 0.15s;
  }

  .project-card:hover {
    border-color: var(--fo-plum-m);
    transform: translateY(-1px);
  }

  .project-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    margin-bottom: var(--space-sm);
  }

  .project-name {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--fo-plum);
    margin: 0;
  }

  .project-status {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .project-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 var(--space-sm);
    line-height: 1.5;
  }

  .project-repo {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-sm);
    color: var(--text-muted);
  }

  .repo-text {
    font-family: var(--font-body);
    font-size: 12px;
  }

  .project-meta {
    margin-top: var(--space-sm);
  }

  .meta-text {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
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

  .create-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
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
</style>
