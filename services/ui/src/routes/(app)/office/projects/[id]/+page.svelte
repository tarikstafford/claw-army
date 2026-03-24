<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
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

  :global(body.back-office) .back-link:hover {
    color: var(--bo-vb);
  }

  :global(body.back-office) .project-name {
    color: var(--bo-text);
  }

  :global(body.back-office) .project-meta {
    border-top-color: var(--bo-border);
  }
</style>
