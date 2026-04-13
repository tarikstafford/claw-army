<script lang="ts">
  import type { Execution, Objective } from '$lib/api';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const objective: Objective = $derived(data.objective);
  let executions: Execution[] = $state(data.executions ?? []);

  let running = $state(false);
  let runError = $state('');
  let runSuccess = $state('');

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function formatDatetime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
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

  function getExecStatusColor(status: string): string {
    switch (status) {
      case 'running': return 'var(--fo-plum-m)';
      case 'completed':
      case 'success': return 'var(--success)';
      case 'failed':
      case 'error': return 'var(--error)';
      case 'pending': return 'var(--fo-gold)';
      default: return 'var(--text-muted)';
    }
  }

  async function triggerRun() {
    running = true;
    runError = '';
    runSuccess = '';
    try {
      const body: Record<string, unknown> = { objectiveId: objective.id };
      if (objective.defaultConfig) body.config = objective.defaultConfig;
      const res = await fetch('/api/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || res.statusText);
      }
      const exec: Execution = await res.json();
      executions = [exec, ...executions];
      runSuccess = `Execution started (ID: ${exec.id ?? 'n/a'}).`;
    } catch (err) {
      runError = err instanceof Error ? err.message : 'Failed to trigger execution.';
    } finally {
      running = false;
    }
  }
</script>

<div class="obj-detail">
  <div class="back-row">
    <a href="/office/goals" class="back-link">&larr; Objectives</a>
  </div>

  <div class="obj-header">
    <div class="obj-header-left">
      <h1 class="obj-name">{objective.name}</h1>
      <span class="status-chip" style="color: {getStatusColor(objective.status)}">
        {objective.status}
      </span>
    </div>
    <div class="obj-header-actions">
      <a href="/office/goals" class="btn-secondary">Edit</a>
      <button class="btn-primary" onclick={triggerRun} disabled={running}>
        {running ? 'Starting…' : 'Run'}
      </button>
    </div>
  </div>

  {#if runError}
    <div class="banner banner--error" role="alert">{runError}</div>
  {/if}
  {#if runSuccess}
    <div class="banner banner--success" role="status">{runSuccess}</div>
  {/if}

  {#if objective.description}
    <p class="obj-description">{objective.description}</p>
  {/if}

  <div class="meta-grid">
    <div class="meta-item">
      <span class="meta-label">Budget cap</span>
      <span class="meta-value">{formatBudget(objective.budgetCap)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Last run</span>
      <span class="meta-value">{formatDate(objective.lastRunAt)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Created</span>
      <span class="meta-value">{formatDate(objective.createdAt)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Updated</span>
      <span class="meta-value">{formatDate(objective.updatedAt)}</span>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Execution history</h2>

    {#if executions.length === 0}
      <div class="empty-execs">
        <span class="empty-eyebrow">NO EXECUTIONS</span>
        <p class="empty-body">No runs yet. Hit Run to deploy agents.</p>
      </div>
    {:else}
      <div class="exec-table-wrap">
        <table class="exec-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Started</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {#each executions as exec (exec.id)}
              <tr class="exec-row">
                <td class="exec-id">{exec.id.slice(0, 8)}…</td>
                <td>
                  <span class="exec-status" style="color: {getExecStatusColor(exec.status)}">
                    {exec.status}
                  </span>
                </td>
                <td class="exec-date">{formatDatetime(exec.startedAt ?? exec.createdAt)}</td>
                <td class="exec-date">{formatDatetime(exec.completedAt)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .obj-detail {
    max-width: 860px;
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

  .obj-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-lg);
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
  }

  .obj-header-left {
    display: flex;
    align-items: baseline;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .obj-name {
    font-family: var(--font-display);
    font-size: clamp(24px, 3vw, 36px);
    font-weight: 600;
    line-height: 1.1;
    color: var(--text);
    margin: 0;
  }

  .status-chip {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
  }

  .obj-header-actions {
    display: flex;
    gap: var(--space-sm);
    flex-shrink: 0;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 9px 18px;
    background: var(--fo-plum);
    color: #fff;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: var(--radius-md);
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
    padding: 9px 18px;
    background: transparent;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    text-decoration: none;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }

  .btn-secondary:hover {
    border-color: var(--fo-plum-m);
    color: var(--fo-plum);
  }

  .banner {
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    font-size: 13px;
    margin-bottom: var(--space-lg);
  }

  .banner--error {
    background: var(--error-dim);
    border: 1px solid var(--error);
    color: var(--error);
  }

  .banner--success {
    background: rgba(5, 150, 105, 0.08);
    border: 1px solid var(--success);
    color: var(--success);
  }

  .obj-description {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.8;
    color: var(--text-muted);
    margin-bottom: var(--space-xl);
  }

  .meta-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xl);
    padding: var(--space-lg) 0;
    border-top: 1px solid var(--fo-border);
    border-bottom: 1px solid var(--fo-border);
    margin-bottom: var(--space-2xl);
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 120px;
  }

  .meta-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .meta-value {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text);
  }

  .section {
    margin-top: var(--space-2xl);
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 var(--space-lg);
  }

  .empty-execs {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-2xl) 0;
  }

  .empty-eyebrow {
    font-family: var(--font-label);
    font-size: 6px;
    color: var(--text-muted);
    letter-spacing: 0.10em;
  }

  .empty-body {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .exec-table-wrap {
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-lg);
    overflow-x: auto;
  }

  .exec-table {
    width: 100%;
    border-collapse: collapse;
  }

  .exec-table thead tr {
    background: var(--fo-bg2);
    border-bottom: 1px solid var(--fo-border);
  }

  .exec-table th {
    padding: var(--space-sm) var(--space-md);
    text-align: left;
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
    font-weight: 400;
    white-space: nowrap;
  }

  .exec-row {
    border-bottom: 1px solid var(--fo-border);
    transition: background 0.12s;
  }

  .exec-row:last-child {
    border-bottom: none;
  }

  .exec-row:hover {
    background: var(--fo-bg2);
  }

  .exec-table td {
    padding: var(--space-md);
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
  }

  .exec-id {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-muted);
  }

  .exec-status {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .exec-date {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
  }
</style>
