<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let running = $state(false);
  let runError = $state('');

  function formatCents(cents: number | null): string {
    if (cents == null) return 'No cap';
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatDate(iso: string): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTime(iso: string): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function formatHours(hours: number): string {
    if (hours < 1) return `${(hours * 60).toFixed(1)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
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
      case 'running': return 'var(--accent-teal)';
      case 'paused': return 'var(--text-muted)';
      case 'stopped': return 'var(--text-muted)';
      case 'completed': return 'var(--accent-teal)';
      case 'failed': return 'var(--error, #DC2626)';
      default: return 'var(--text-muted)';
    }
  }

  async function handleRun() {
    running = true;
    runError = '';
    try {
      const res = await fetch('/api/executions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          objective: data.objective.name,
          objectiveId: data.objective.id,
          maxBots: data.objective.defaultMaxBots,
          budgetCapCents: data.objective.defaultBudgetCapCents,
          runtimeLimitSeconds: data.objective.defaultRuntimeLimitSeconds,
          allowedTools: data.objective.defaultAllowedTools,
        }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(err || `Request failed (${res.status})`);
      }
      await invalidateAll();
    } catch (err) {
      runError = (err as Error).message ?? 'Failed to trigger execution';
      running = false;
    }
  }
</script>

<div class="objective-detail">
  <div class="back-row">
    <a href="/office/goals" class="back-link">&larr; Objectives</a>
  </div>

  <div class="objective-header">
    <div class="header-main">
      <h1 class="objective-name">{data.objective.name}</h1>
      <span class="status-badge" style="color: {getStatusColor(data.objective.lastRunStatus)}">
        {getStatusLabel(data.objective.lastRunStatus)}
      </span>
    </div>
    <button class="btn-run" onclick={handleRun} disabled={running}>
      {running ? 'Starting...' : 'Run objective'}
    </button>
  </div>

  {#if data.objective.description}
    <div class="objective-description">
      {data.objective.description}
    </div>
  {/if}

  <div class="objective-meta">
    <div class="meta-row">
      <span class="meta-label">Budget cap</span>
      <span class="meta-value">{formatCents(data.objective.defaultBudgetCapCents)}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Max bots</span>
      <span class="meta-value">{data.objective.defaultMaxBots}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Runtime limit</span>
      <span class="meta-value">
        {data.objective.defaultRuntimeLimitSeconds
          ? `${Math.round(data.objective.defaultRuntimeLimitSeconds / 60)} min`
          : 'No limit'}
      </span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Created</span>
      <span class="meta-value">{formatDate(data.objective.createdAt)}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Last updated</span>
      <span class="meta-value">{formatDate(data.objective.updatedAt)}</span>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Stats</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-value">{data.stats.runCount}</span>
        <span class="stat-label">Total runs</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{formatCents(data.stats.totalSpendCents)}</span>
        <span class="stat-label">Total spend</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{data.stats.totalTasksCompleted}</span>
        <span class="stat-label">Tasks completed</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{formatHours(data.stats.totalBotHours)}</span>
        <span class="stat-label">Bot hours</span>
      </div>
    </div>
    {#if data.stats.classTrendSummary}
      <p class="class-summary">{data.stats.classTrendSummary}</p>
    {/if}
  </div>

  <div class="section">
    <h2 class="section-title">Execution history</h2>
    {#if data.executions.length === 0}
      <div class="empty-executions">
        <p>No executions yet. Run the objective to see history here.</p>
      </div>
    {:else}
      <div class="executions-list">
        {#each data.executions as exec}
          <div class="execution-row">
            <span class="exec-status" style="color: {getStatusColor(exec.status)}">
              {getStatusLabel(exec.status)}
            </span>
            <span class="exec-date">{formatDateTime(exec.createdAt)}</span>
            <span class="exec-meta">{exec.botCount} bots</span>
            <span class="exec-meta">{formatCents(exec.totalCostCents)}</span>
            {#if exec.avgCompositeScore != null}
              <span class="exec-meta">Score: {exec.avgCompositeScore.toFixed(2)}</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if runError}
    <p class="run-error" role="alert">{runError}</p>
  {/if}
</div>

<style>
  .objective-detail {
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

  .objective-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-lg);
    margin-bottom: var(--space-xl);
    flex-wrap: wrap;
  }

  .header-main {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .objective-name {
    font-family: var(--font-display);
    font-size: clamp(22px, 3vw, 32px);
    font-weight: 600;
    line-height: 1.2;
    color: var(--fo-plum);
    margin: 0;
  }

  .status-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
  }

  .btn-run {
    display: inline-flex;
    align-items: center;
    padding: 12px 24px;
    background: var(--accent-teal);
    color: white;
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
  }

  .btn-run:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-teal) 85%, black);
    transform: translateY(-1px);
  }

  .btn-run:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .objective-description {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.8;
    margin-bottom: var(--space-xl);
    color: var(--text);
  }

  .objective-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    border-top: 1px solid var(--fo-border);
    padding-top: var(--space-xl);
    margin-bottom: var(--space-xl);
  }

  .meta-row {
    display: flex;
    gap: var(--space-xl);
  }

  .meta-label {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    width: 140px;
    flex-shrink: 0;
  }

  .meta-value {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
  }

  .section {
    margin-bottom: var(--space-xl);
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--fo-plum);
    margin: 0 0 var(--space-lg);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }

  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
  }

  .stat-value {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 600;
    color: var(--fo-plum);
  }

  .stat-label {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .class-summary {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .empty-executions {
    padding: var(--space-xl);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
  }

  .empty-executions p {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .executions-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .execution-row {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    flex-wrap: wrap;
  }

  .exec-status {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    min-width: 80px;
  }

  .exec-date {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    min-width: 140px;
  }

  .exec-meta {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
  }

  .run-error {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--error);
    margin: 0;
    padding: var(--space-md);
    background: color-mix(in srgb, var(--error) 10%, transparent);
    border: 1px solid var(--error);
    border-radius: var(--radius-md);
  }
</style>
