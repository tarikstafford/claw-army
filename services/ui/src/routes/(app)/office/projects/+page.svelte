<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="projects-page">
  <div class="page-header">
    <h1 class="page-title">Projects</h1>
  </div>

  {#if data.projects.length === 0}
    <div class="empty-state" aria-busy="false">
      <span class="empty-eyebrow">NO PROJECTS</span>
      <p class="empty-heading">Nothing here yet.</p>
      <p class="empty-body">No projects yet. Projects help organize your crew's work.</p>
    </div>
  {:else}
    <div class="projects-list">
      {#each data.projects as project}
        <a href="/office/projects/{project.id}" class="project-card">
          <h3 class="project-name">{project.name}</h3>
          {#if project.description}
            <p class="project-desc">{project.description}</p>
          {/if}
          <div class="project-meta">
            <span class="meta-text">Created {new Date(project.createdAt).toLocaleDateString()}</span>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

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

  .project-name {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--fo-plum);
    margin: 0 0 var(--space-sm);
  }

  .project-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 var(--space-sm);
    line-height: 1.5;
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

</style>
