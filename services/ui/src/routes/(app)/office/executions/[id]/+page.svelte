<script lang="ts">
  import type { PageData } from './$types';
  import { onMount, onDestroy } from 'svelte';
  import type { ExecutionEvent } from '$lib/api.js';

  let { data }: { data: PageData } = $props();

  let execution = $state(data.execution);
  let bots = $state(data.bots);
  let tasks = $state(data.tasks);
  let ringLeader = $state(data.ringLeader);
  let events = $state<ExecutionEvent[]>([]);
  let syntheses = $state<string | null>(null);
  let isLoadingSynthesis = $state(false);
  let isStopping = $state(false);

  let cleanupSSE: (() => void) | null = null;

  const taskDAG = $derived.by(() => {
    const taskMap = new Map<string, { id: string; status: string; description: string; dependents: string[] }>();
    tasks.forEach((t: { id: string; status: string; description: string }) => {
      taskMap.set(t.id, { ...t, dependents: [] });
    });
    return Array.from(taskMap.values());
  });

  const completedTasks = $derived(tasks.filter((t: { status: string }) => t.status === 'completed').length);
  const totalTasks = $derived(tasks.length);
  const progress = $derived(totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0);

  const statusColors: Record<string, string> = {
    running: 'var(--bo-teal, #2DD4BF)',
    completed: 'var(--success, #059669)',
    failed: 'var(--error)',
    paused: 'var(--karma)',
    stopped: 'var(--text-muted)',
    idle: 'var(--text-muted)',
    spawning: 'var(--bo-violet)',
    working: 'var(--bo-amber)',
    stopping: 'var(--text-muted)',
    pending: 'var(--text-muted)',
    claimed: 'var(--bo-amber)',
  };

  function getStatusColor(status: string): string {
    return statusColors[status] ?? 'var(--text-muted)';
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'pre_flight': return 'Pre-flight';
      case 'queued': return 'Queued';
      case 'running': return 'Running';
      case 'paused': return 'Paused';
      case 'stopped': return 'Cancelled';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return status;
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  async function handleStop() {
    if (!confirm('Are you sure you want to stop this execution?')) return;
    isStopping = true;
    try {
      const res = await fetch(`/api/executions/${execution.id}/stop`, { method: 'POST' });
      if (res.ok) {
        execution = { ...execution, status: 'stopped' };
      }
    } finally {
      isStopping = false;
    }
  }

  async function loadSynthesis() {
    if (syntheses !== null) return;
    isLoadingSynthesis = true;
    try {
      const res = await fetch(`/api/ring-leader/runs/by-execution/${execution.id}/synthesis`);
      if (res.ok) {
        const data = await res.json();
        syntheses = data.synthesis;
      }
    } finally {
      isLoadingSynthesis = false;
    }
  }

  onMount(() => {
    if (execution.status === 'running' || execution.status === 'paused' || execution.status === 'queued') {
      cleanupSSE = createExecutionProgressStream(
        execution.id,
        (event: ExecutionEvent) => {
          events = [...events, event];
          if (event.type === 'execution_status_changed' && event.payload) {
            execution = { ...execution, status: (event.payload as { status: string }).status };
          }
          if (event.type === 'bot_status_changed' && event.payload) {
            const p = event.payload as { botId: string; status: string };
            bots = bots.map((b: { id: string }) => b.id === p.botId ? { ...b, status: p.status } : b);
          }
          if (event.type === 'task_completed' && event.payload) {
            const p = event.payload as { taskId: string; status: string };
            tasks = tasks.map((t: { id: string }) => t.id === p.taskId ? { ...t, status: p.status } : t);
          }
        },
        (err: Error) => {
          console.error('SSE error:', err);
        }
      );
    }
    if (execution.status === 'completed') {
      loadSynthesis();
    }
  });

  onDestroy(() => {
    if (cleanupSSE) cleanupSSE();
  });

  const canStop = execution.status === 'running' || execution.status === 'paused' || execution.status === 'queued';
  const canResume = execution.status === 'paused';
</script>

<div class="execution-detail">
  <div class="back-row">
    <a href="/office/executions" class="back-link">&larr; Runs</a>
  </div>

  <div class="execution-header">
    <div class="header-top">
      <h1 class="execution-title">Run Detail</h1>
      <span class="status-badge" style="color: {getStatusColor(execution.status)}; border-color: {getStatusColor(execution.status)}">
        {getStatusLabel(execution.status)}
      </span>
    </div>
    <p class="execution-objective">{execution.objective}</p>
  </div>

  <div class="controls-bar">
    {#if canStop}
      <button
        class="btn-danger"
        type="button"
        onclick={handleStop}
        disabled={isStopping}
      >
        {isStopping ? 'Stopping...' : 'Stop'}
      </button>
    {/if}
  </div>

  <div class="progress-section">
    <div class="section-header">
      <h2 class="section-title">Progress</h2>
      <span class="progress-text">{completedTasks}/{totalTasks} tasks</span>
    </div>
    <div class="progress-bar-wrap">
      <div class="progress-bar">
        <div class="progress-fill" style="width: {progress}%"></div>
      </div>
    </div>
    <div class="status-timeline">
      {#each ['pre_flight', 'queued', 'running', 'completed'] as step}
        <div class="timeline-step" class:active={execution.status === step} class:done={['queued', 'running', 'completed'].indexOf(execution.status) > ['queued', 'running', 'completed'].indexOf(step)}>
          <div class="step-dot" style="background: {execution.status === step ? getStatusColor(execution.status) : 'var(--border)'}"></div>
          <span class="step-label">{getStatusLabel(step)}</span>
        </div>
      {/each}
    </div>
  </div>

  <div class="bots-section">
    <div class="section-header">
      <h2 class="section-title">Bots</h2>
      <span class="meta-text">{bots.length} assigned</span>
    </div>
    {#if bots.length === 0}
      <p class="empty-text">No bots assigned yet.</p>
    {:else}
      <div class="bots-grid">
        {#each bots as bot}
          <div class="bot-card">
            <div class="bot-header">
              <span class="bot-id">{bot.id.slice(0, 8)}</span>
              <span class="bot-status" style="color: {getStatusColor(bot.status)}">{getStatusLabel(bot.status)}</span>
            </div>
            <div class="bot-stats">
              <span class="stat">
                <span class="stat-label">Claimed:</span> {bot.tasksClaimed}
              </span>
              <span class="stat">
                <span class="stat-label">Completed:</span> {bot.tasksCompleted}
              </span>
              <span class="stat">
                <span class="stat-label">Failed:</span> {bot.tasksFailed}
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="tasks-section">
    <div class="section-header">
      <h2 class="section-title">Task DAG</h2>
      <span class="meta-text">{taskDAG.length} tasks</span>
    </div>
    {#if taskDAG.length === 0}
      <p class="empty-text">No tasks yet.</p>
    {:else}
      <div class="tasks-list">
        {#each taskDAG as task}
          <div class="task-item" class:completed={task.status === 'completed'} class:failed={task.status === 'failed'}>
            <div class="task-status-dot" style="background: {getStatusColor(task.status)}"></div>
            <span class="task-desc">{task.description}</span>
            <span class="task-state" style="color: {getStatusColor(task.status)}">{getStatusLabel(task.status)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if ringLeader && ringLeader.runState}
    <div class="ring-leader-section">
      <div class="section-header">
        <h2 class="section-title">Coordination</h2>
      </div>
      <div class="coord-stats">
        <div class="coord-stat">
          <span class="coord-label">Elapsed</span>
          <span class="coord-value">{formatDuration(ringLeader.runState.elapsedTimeSeconds)}</span>
        </div>
        <div class="coord-stat">
          <span class="coord-label">Budget Used</span>
          <span class="coord-value">${(ringLeader.runState.budgetConsumedCents / 100).toFixed(2)}</span>
        </div>
        <div class="coord-stat">
          <span class="coord-label">Drift Score</span>
          <span class="coord-value">{ringLeader.runState.objectiveDriftScore.toFixed(2)}</span>
        </div>
      </div>
      {#if ringLeader.runState.anomalies.length > 0}
        <div class="anomalies">
          <span class="anomalies-label">Anomalies:</span>
          {#each ringLeader.runState.anomalies as anomaly}
            <span class="anomaly-tag">{anomaly}</span>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if execution.status === 'completed'}
    <div class="synthesis-section">
      <div class="section-header">
        <h2 class="section-title">Ring Leader Synthesis</h2>
        {#if syntheses === null && !isLoadingSynthesis}
          <button class="btn-secondary" type="button" onclick={loadSynthesis}>Load Synthesis</button>
        {/if}
      </div>
      {#if isLoadingSynthesis}
        <p class="loading-text">Loading synthesis...</p>
      {:else if syntheses}
        <div class="synthesis-content">
          <pre class="synthesis-text">{syntheses}</pre>
        </div>
      {:else}
        <p class="empty-text">No synthesis available.</p>
      {/if}
    </div>
  {/if}

  {#if events.length > 0}
    <div class="events-section">
      <div class="section-header">
        <h2 class="section-title">Live Events</h2>
        <span class="meta-text">{events.length} events</span>
      </div>
      <div class="events-log">
        {#each events.slice(-20) as event}
          <div class="event-item">
            <span class="event-type">{event.type}</span>
            <span class="event-time">{formatDate(event.timestamp)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="execution-meta">
    <div class="meta-row">
      <span class="meta-label">Created</span>
      <span class="meta-value">{formatDate(execution.createdAt)}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Last updated</span>
      <span class="meta-value">{formatDate(execution.updatedAt)}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Max bots</span>
      <span class="meta-value">{execution.maxBots}</span>
    </div>
    {#if execution.budgetCapCents}
      <div class="meta-row">
        <span class="meta-label">Budget cap</span>
        <span class="meta-value">${(execution.budgetCapCents / 100).toFixed(2)}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .execution-detail {
    max-width: 900px;
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

  .execution-header {
    margin-bottom: var(--space-xl);
  }

  .header-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-lg);
    margin-bottom: var(--space-md);
    flex-wrap: wrap;
  }

  .execution-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--fo-plum);
    margin: 0;
  }

  .status-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid;
    border-radius: var(--radius-sm);
  }

  .execution-objective {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text);
    margin: 0;
    line-height: 1.6;
  }

  .controls-bar {
    display: flex;
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
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

  .btn-danger:hover {
    background: color-mix(in srgb, var(--error) 80%, black);
  }

  .btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    padding: 8px 16px;
    background: transparent;
    color: var(--accent);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-secondary:hover {
    background: var(--bg2);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-md);
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--fo-plum);
    margin: 0;
  }

  .progress-section {
    margin-bottom: var(--space-2xl);
  }

  .progress-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
  }

  .progress-bar-wrap {
    margin-bottom: var(--space-lg);
  }

  .progress-bar {
    height: 8px;
    background: var(--bg3);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--bo-teal);
    transition: width 0.3s ease;
  }

  .status-timeline {
    display: flex;
    gap: var(--space-xl);
    padding: var(--space-md) 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }

  .timeline-step {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    opacity: 0.5;
  }

  .timeline-step.active,
  .timeline-step.done {
    opacity: 1;
  }

  .step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .step-label {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
  }

  .bots-section,
  .tasks-section,
  .ring-leader-section,
  .synthesis-section,
  .events-section {
    margin-bottom: var(--space-2xl);
  }

  .bots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-md);
  }

  .bot-card {
    padding: var(--space-md);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .bot-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-sm);
  }

  .bot-id {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text);
  }

  .bot-status {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
  }

  .bot-stats {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
  }

  .stat-label {
    color: var(--text);
  }

  .tasks-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .task-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }

  .task-item.completed {
    opacity: 0.7;
  }

  .task-item.failed {
    border-color: var(--error);
  }

  .task-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .task-desc {
    flex: 1;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
  }

  .task-state {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
  }

  .coord-stats {
    display: flex;
    gap: var(--space-2xl);
    padding: var(--space-md);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .coord-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .coord-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .coord-value {
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--text);
  }

  .anomalies {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    margin-top: var(--space-md);
    align-items: center;
  }

  .anomalies-label {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
  }

  .anomaly-tag {
    font-family: var(--font-label);
    font-size: 6px;
    padding: 2px 6px;
    background: var(--error-dim);
    color: var(--error);
    border-radius: var(--radius-sm);
  }

  .synthesis-content {
    padding: var(--space-lg);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .synthesis-text {
    font-family: var(--font-body);
    font-size: 13px;
    line-height: 1.6;
    color: var(--text);
    white-space: pre-wrap;
    margin: 0;
  }

  .events-log {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 200px;
    overflow-y: auto;
    padding: var(--space-md);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .event-item {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 2px 0;
  }

  .event-type {
    color: var(--accent);
  }

  .event-time {
    color: var(--text-muted);
  }

  .execution-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    border-top: 1px solid var(--border);
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

  .meta-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
  }

  .empty-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .loading-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    font-style: italic;
    margin: 0;
  }
</style>