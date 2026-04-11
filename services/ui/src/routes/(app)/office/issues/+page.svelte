<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

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
</script>

<div class="issues-page">
  <div class="page-header">
    <h1 class="page-title">Issues</h1>
    <button class="btn-primary" type="button">New issue</button>
  </div>

  {#if data.issues.length === 0}
    <div class="empty-state" aria-busy="false">
      <span class="empty-eyebrow">NO ISSUES</span>
      <p class="empty-heading">Nothing yet.</p>
      <p class="empty-body">No issues assigned. Indra will route tasks here as your crew works.</p>
    </div>
  {:else}
    <div class="issues-table-wrap">
      <table class="issues-table">
        <thead>
          <tr>
            <th class="th-status">Status</th>
            <th class="th-title">Title</th>
            <th class="th-priority">Priority</th>
            <th class="th-assignee">Assignee</th>
            <th class="th-created">Created</th>
          </tr>
        </thead>
        <tbody>
          {#each data.issues as issue}
            <tr
              class="issue-row"
              onclick={() => { window.location.href = `/office/issues/${issue.id}`; }}
              role="link"
              tabindex="0"
              onkeydown={(e) => { if (e.key === 'Enter') window.location.href = `/office/issues/${issue.id}`; }}
            >
              <td class="td-status">
                <span class="status-label" style="color: {getStatusColor(issue.status)}">
                  {getStatusLabel(issue.status)}
                </span>
              </td>
              <td class="td-title">
                <a href="/office/issues/{issue.id}" class="issue-link">{issue.title}</a>
              </td>
              <td class="td-priority">
                <span class="meta-text">—</span>
              </td>
              <td class="td-assignee">
                <span class="meta-text">{issue.assigneeAgentId ? 'Assigned' : '—'}</span>
              </td>
              <td class="td-created">
                <span class="meta-text">{formatDate(issue.createdAt)}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

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

  .issue-row {
    cursor: pointer;
    transition: background 0.1s;
  }

  .issue-row:hover {
    background: var(--fo-bg2);
  }

  .issues-table td {
    padding: 12px 12px;
    border-bottom: 1px solid var(--fo-border);
    vertical-align: middle;
  }

  .status-label {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
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

  .issue-row:hover {
    background: color-mix(in srgb, var(--accent) 6%, transparent);
  }
</style>
