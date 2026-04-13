<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';
  import { onMount, onDestroy } from 'svelte';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let execution = $state(data.execution);
  let bots = $state(data.bots as Array<{
    id: string;
    status: string;
    tasksClaimed: number;
    tasksCompleted: number;
    tasksFailed: number;
    createdAt: string;
    updatedAt: string;
  }>);
  let ringLeader = $state(data.ringLeader as {
    runId: string;
    status: string;
    runState: {
      elapsedTimeSeconds: number;
      budgetConsumedCents: number;
      taskStates: Record<string, {
        status: string;
        activeAgents: string[];
        completedAgents: string[];
        failedAgents: string[];
      }>;
      objectiveDriftScore: number;
      anomalies: string[];
    } | null;
  } | null);
  let synthesis = $state<{
    synthesis: {
      objective: string;
      objectiveAchieved: boolean;
      achievementRationale: string;
      taskSummary: Array<{
        taskId: string;
        completed: boolean;
        anomalies: string[];
      }>;
    } | null;
    fitness: {
      compositeScore: number;
    } | null;
  } | null>(null);

  let eventSource: EventSource | null = null;
  let isConnected = $state(false);
  let liveEvents = $state<Array<{ type: string; data: unknown }>>([]);

  const STATUS_ORDER = ['pre_flight', 'queued', 'running', 'paused', 'stopped', 'completed', 'failed'];

  function getStatusColor(status: string): string {
    switch (status) {
      case 'running': return 'var(--bo-teal, #2DD4BF)';
      case 'completed': return 'var(--success, #059669)';
      case 'failed': return 'var(--error, #f87171)';
      case 'paused': return 'var(--bo-amber, #FBBF24)';
      case 'stopped': return 'var(--text-muted)';
      case 'pre_flight': return 'var(--bo-violet, #7C3AED)';
      case 'queued': return 'var(--bo-vb, #A78BFA)';
      default: return 'var(--text-muted)';
    }
  }

  function getBotStatusColor(status: string): string {
    switch (status) {
      case 'working': return 'var(--bo-teal, #2DD4BF)';
      case 'idle': return 'var(--bo-amber, #FBBF24)';
      case 'spawning': return 'var(--bo-violet, #7C3AED)';
      case 'stopping': return 'var(--bo-rose, #F472B6)';
      case 'stopped': return 'var(--text-muted)';
      case 'failed': return 'var(--error, #f87171)';
      default: return 'var(--text-muted)';
    }
  }

  function formatDate(iso: string | Date): string {
    const date = typeof iso === 'string' ? new Date(iso) : iso;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function getStatusIndex(status: string): number {
    return STATUS_ORDER.indexOf(status);
  }

  function getProgressPercent(): number {
    const idx = getStatusIndex(execution.status);
    if (execution.status === 'completed') return 100;
    if (execution.status === 'failed') return 100;
    if (execution.status === 'stopped') return 100;
    return Math.round((idx / (STATUS_ORDER.length - 1)) * 100);
  }

  function getActiveBots(): number {
    return bots.filter(b => b.status === 'working' || b.status === 'idle').length;
  }

  async function loadSynthesis() {
    const res = await fetch(`/api/ring-leader/runs/by-execution/${execution.id}/synthesis`);
    if (res.ok) {
      synthesis = await res.json();
    }
  }

  function connectSSE() {
    if (eventSource) return;

    const url = `/api/executions/${execution.id}/events`;
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      isConnected = true;
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        liveEvents = [...liveEvents.slice(-49), { type: event.type || 'message', data: payload }];

        if (payload.executionId === execution.id) {
          if (payload.type === 'execution_status_changed' && payload.status) {
            execution = { ...execution, status: payload.status };
          }
          if (payload.type === 'bot_status_changed' && payload.botId) {
            bots = bots.map(b =>
              b.id === payload.botId ? { ...b, status: payload.status } : b
            );
          }
          if (payload.type === 'task_completed' && payload.taskId) {
            bots = bots.map(b =>
              b.id === payload.claimedByBotId
                ? { ...b, tasksCompleted: b.tasksCompleted + 1, tasksClaimed: b.tasksClaimed - 1 }
                : b
            );
          }
        }
      } catch {}
    };

    eventSource.onerror = () => {
      isConnected = false;
      eventSource?.close();
      eventSource = null;
    };
  }

  function disconnectSSE() {
    eventSource?.close();
    eventSource = null;
    isConnected = false;
  }

  onMount(() => {
    if (['running', 'queued', 'paused'].includes(execution.status)) {
      connectSSE();
    }
    if (execution.status === 'completed' || execution.status === 'failed') {
      loadSynthesis();
    }
  });

  onDestroy(() => {
    disconnectSSE();
  });

  $effect(() => {
    if (['running', 'queued', 'paused'].includes(execution.status) && !eventSource) {
      connectSSE();
    }
  });
</script>

<div class="execution-detail">
  <div class="back-row">
    <a href="/office/executions" class="back-link">&larr; Runs</a>
  </div>

  <div class="execution-header">
    <div class="header-top">
      <h1 class="execution-objective">{execution.objective}</h1>
      <span class="status-badge" style="color: {getStatusColor(execution.status)}">
        {execution.status.replace('_', ' ').toUpperCase()}
      </span>
    </div>
    <div class="header-meta">
      <span class="meta-item">Started {formatDate(execution.createdAt)}</span>
      {#if execution.status === 'running' && ringLeader?.runState}
        <span class="meta-item">Elapsed: {formatTime(ringLeader.runState.elapsedTimeSeconds)}</span>
      {/if}
      {#if isConnected}
        <span class="live-indicator">
          <span class="live-dot"></span> LIVE
        </span>
      {/if}
    </div>
  </div>

  <div class="progress-section">
    <div class="progress-header">
      <span class="progress-label">PROGRESS</span>
      <span class="progress-percent">{getProgressPercent()}%</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: {getProgressPercent()}%; background: {getStatusColor(execution.status)}"></div>
    </div>
    <div class="status-timeline">
      {#each STATUS_ORDER as status}
        <div class="timeline-item" class:active={execution.status === status} class:past={getStatusIndex(execution.status) > getStatusIndex(status)}>
          <div class="timeline-dot" style="background: {getStatusColor(status)}"></div>
          <span class="timeline-label">{status.replace('_', ' ')}</span>
        </div>
      {/each}
    </div>
  </div>

  <div class="controls-section">
    {#if execution.status === 'running' || execution.status === 'queued' || execution.status === 'paused'}
      <div class="control-buttons">
        {#if execution.status === 'running'}
          <form method="POST" action="?/pause" use:enhance>
            <button type="submit" class="btn btn-secondary">Pause</button>
          </form>
        {/if}
        {#if execution.status === 'paused'}
          <form method="POST" action="?/resume" use:enhance>
            <button type="submit" class="btn btn-primary">Resume</button>
          </form>
        {/if}
        <form method="POST" action="?/cancel" use:enhance>
          <button type="submit" class="btn btn-danger">Cancel</button>
        </form>
      </div>
    {/if}
  </div>

  <div class="bots-section">
    <h2 class="section-title">BOTS</h2>
    {#if bots.length === 0}
      <p class="empty-text">No bots assigned yet.</p>
    {:else}
      <div class="bots-list">
        {#each bots as bot}
          <div class="bot-card">
            <div class="bot-header">
              <span class="bot-id">{bot.id.slice(0, 8)}</span>
              <span class="bot-status" style="color: {getBotStatusColor(bot.status)}">{bot.status}</span>
            </div>
            <div class="bot-stats">
              <span class="bot-stat">
                <span class="stat-value">{bot.tasksClaimed}</span>
                <span class="stat-label">claimed</span>
              </span>
              <span class="bot-stat">
                <span class="stat-value">{bot.tasksCompleted}</span>
                <span class="stat-label">completed</span>
              </span>
              <span class="bot-stat">
                <span class="stat-value">{bot.tasksFailed}</span>
                <span class="stat-label">failed</span>
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if ringLeader?.runState}
    <div class="tasks-section">
      <h2 class="section-title">TASKS</h2>
      <div class="tasks-grid">
        {#each Object.entries(ringLeader.runState.taskStates) as [taskId, taskState]}
          <div class="task-card" class:complete={taskState.status === 'complete'} class:failed={taskState.status === 'failed'} class:active={taskState.status === 'active'}>
            <div class="task-header">
              <span class="task-id">{taskId.slice(0, 8)}</span>
              <span class="task-status">{taskState.status}</span>
            </div>
            <div class="task-agents">
              {#if taskState.activeAgents.length > 0}
                <span class="agents-count active">{taskState.activeAgents.length} active</span>
              {/if}
              {#if taskState.completedAgents.length > 0}
                <span class="agents-count complete">{taskState.completedAgents.length} done</span>
              {/if}
              {#if taskState.failedAgents.length > 0}
                <span class="agents-count failed">{taskState.failedAgents.length} failed</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if synthesis?.synthesis}
    <div class="synthesis-section">
      <h2 class="section-title">RING LEADER SYNTHESIS</h2>
      <div class="synthesis-card">
        <div class="synthesis-header">
          <span class="objective-achieved" class:achieved={synthesis.synthesis.objectiveAchieved}>
            {synthesis.synthesis.objectiveAchieved ? 'OBJECTIVE ACHIEVED' : 'OBJECTIVE NOT ACHIEVED'}
          </span>
          {#if synthesis.fitness}
            <span class="fitness-score">Fitness: {synthesis.fitness.compositeScore.toFixed(2)}</span>
          {/if}
        </div>
        <p class="synthesis-rationale">{synthesis.synthesis.achievementRationale}</p>
        <div class="task-summary">
          <h3>Task Summary</h3>
          <div class="task-summary-list">
            {#each synthesis.synthesis.taskSummary as task}
              <div class="task-summary-item" class:completed={task.completed} class:failed={!task.completed}>
                <span class="summary-task-id">{task.taskId.slice(0, 8)}</span>
                <span class="summary-status">{task.completed ? 'completed' : 'failed'}</span>
                {#if task.anomalies.length > 0}
                  <span class="summary-anomalies">{task.anomalies.length} anomalies</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if liveEvents.length > 0}
    <div class="events-section">
      <h2 class="section-title">LIVE EVENTS</h2>
      <div class="events-log">
        {#each liveEvents.slice(-10).reverse() as event}
          <div class="event-entry">
            <span class="event-type">{event.type}</span>
            <span class="event-data">{JSON.stringify(event.data)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
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
    margin-bottom: var(--space-2xl);
  }

  .header-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-lg);
    margin-bottom: var(--space-md);
    flex-wrap: wrap;
  }

  .execution-objective {
    font-family: var(--font-display);
    font-size: clamp(22px, 3vw, 32px);
    font-weight: 600;
    line-height: 1.2;
    color: var(--fo-plum);
    margin: 0;
    flex: 1;
  }

  .status-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid currentColor;
    border-radius: var(--radius-sm);
  }

  .header-meta {
    display: flex;
    gap: var(--space-lg);
    align-items: center;
    flex-wrap: wrap;
  }

  .meta-item {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
  }

  .live-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-teal);
  }

  .live-dot {
    width: 6px;
    height: 6px;
    background: var(--bo-teal);
    border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .progress-section {
    margin-bottom: var(--space-2xl);
    padding: var(--space-lg);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-md);
  }

  .progress-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
  }

  .progress-percent {
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--text);
  }

  .progress-bar {
    height: 8px;
    background: var(--fo-bg2);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: var(--space-lg);
  }

  .progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .status-timeline {
    display: flex;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .timeline-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
    flex: 1;
  }

  .timeline-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    opacity: 0.4;
  }

  .timeline-item.active .timeline-dot,
  .timeline-item.past .timeline-dot {
    opacity: 1;
  }

  .timeline-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .timeline-item.active .timeline-label {
    color: var(--text);
  }

  .controls-section {
    margin-bottom: var(--space-2xl);
  }

  .control-buttons {
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .btn {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-md);
    border: none;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--fo-plum);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--fo-plum-m);
  }

  .btn-secondary {
    background: var(--fo-bg2);
    color: var(--text);
    border: 1px solid var(--fo-border);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--fo-bg3);
  }

  .btn-danger {
    background: var(--error-dim);
    color: var(--error);
    border: 1px solid var(--error);
  }

  .btn-danger:hover:not(:disabled) {
    background: var(--error);
    color: white;
  }

  .section-title {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
    margin: 0 0 var(--space-lg);
  }

  .bots-section {
    margin-bottom: var(--space-2xl);
  }

  .empty-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .bots-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--space-md);
  }

  .bot-card {
    padding: var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
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
    font-size: 11px;
    color: var(--text-muted);
  }

  .bot-status {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
  }

  .bot-stats {
    display: flex;
    gap: var(--space-md);
  }

  .bot-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-value {
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--text);
  }

  .stat-label {
    font-family: var(--font-body);
    font-size: 9px;
    color: var(--text-muted);
  }

  .tasks-section {
    margin-bottom: var(--space-2xl);
  }

  .tasks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-md);
  }

  .task-card {
    padding: var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
  }

  .task-card.complete {
    border-color: var(--success);
    background: rgba(5, 150, 105, 0.05);
  }

  .task-card.failed {
    border-color: var(--error);
    background: rgba(248, 113, 113, 0.05);
  }

  .task-card.active {
    border-color: var(--bo-teal);
    background: rgba(45, 212, 191, 0.05);
  }

  .task-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-sm);
  }

  .task-id {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
  }

  .task-status {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .task-agents {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .agents-count {
    font-family: var(--font-body);
    font-size: 10px;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }

  .agents-count.active {
    background: rgba(45, 212, 191, 0.15);
    color: var(--bo-teal);
  }

  .agents-count.complete {
    background: rgba(5, 150, 105, 0.15);
    color: var(--success);
  }

  .agents-count.failed {
    background: rgba(248, 113, 113, 0.15);
    color: var(--error);
  }

  .synthesis-section {
    margin-bottom: var(--space-2xl);
  }

  .synthesis-card {
    padding: var(--space-lg);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
  }

  .synthesis-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
    gap: var(--space-md);
  }

  .objective-achieved {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--error);
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--error);
    border-radius: var(--radius-sm);
  }

  .objective-achieved.achieved {
    color: var(--success);
    border-color: var(--success);
  }

  .fitness-score {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-muted);
  }

  .synthesis-rationale {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.7;
    color: var(--text);
    margin: 0 0 var(--space-lg);
  }

  .task-summary h3 {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 var(--space-md);
  }

  .task-summary-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .task-summary-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm);
    background: var(--fo-bg2);
    border-radius: var(--radius-sm);
  }

  .summary-task-id {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
  }

  .summary-status {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }

  .task-summary-item.completed .summary-status {
    color: var(--success);
  }

  .task-summary-item.failed .summary-status {
    color: var(--error);
  }

  .summary-anomalies {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--bo-amber);
    margin-left: auto;
  }

  .events-section {
    margin-bottom: var(--space-2xl);
  }

  .events-log {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    max-height: 300px;
    overflow-y: auto;
  }

  .event-entry {
    display: flex;
    gap: var(--space-md);
    padding: var(--space-sm);
    background: var(--fo-bg2);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .event-type {
    color: var(--bo-violet);
    flex-shrink: 0;
  }

  .event-data {
    color: var(--text-muted);
    word-break: break-all;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>