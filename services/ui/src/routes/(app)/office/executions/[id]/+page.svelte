<script lang="ts">
  import type { PageData } from './$types';
  import { onMount, onDestroy } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import type { ExecutionStatus, ExecutionProgressEvent } from '$lib/api';
  import { updateExecution } from '$lib/api';

  let { data }: { data: PageData } = $props();

  let execution = $derived(data.execution);
  let bots = $derived(data.bots);
  let tasks = $derived(data.tasks);
  let ringLeader = $derived(data.ringLeader);
  let synthesis = $derived(data.synthesis);

  let events = $state<ExecutionProgressEvent[]>([]);
  let sseConnected = $state(false);
  let eventSource: EventSource | null = null;

  let actionLoading = $state<string | null>(null);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDuration(startIso: string, endIso?: string | null): string {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    const seconds = Math.floor((end - start) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  function getStatusLabel(status: ExecutionStatus): string {
    switch (status) {
      case 'pre_flight': return 'Pre-Flight';
      case 'queued': return 'Queued';
      case 'running': return 'Running';
      case 'paused': return 'Paused';
      case 'stopped': return 'Stopped';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return status;
    }
  }

  function getStatusColor(status: ExecutionStatus): string {
    switch (status) {
      case 'pre_flight': return 'var(--text-muted)';
      case 'queued': return 'var(--bo-amber)';
      case 'running': return 'var(--bo-teal)';
      case 'paused': return 'var(--fo-gold)';
      case 'stopped': return 'var(--text-muted)';
      case 'completed': return 'var(--success)';
      case 'failed': return 'var(--error)';
      default: return 'var(--text-muted)';
    }
  }

  function getBotStatusColor(status: string): string {
    switch (status) {
      case 'spawning': return 'var(--bo-amber)';
      case 'idle': return 'var(--text-muted)';
      case 'working': return 'var(--bo-teal)';
      case 'stopping': return 'var(--fo-gold)';
      case 'stopped': return 'var(--text-muted)';
      case 'failed': return 'var(--error)';
      default: return 'var(--text-muted)';
    }
  }

  function getTaskStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'var(--text-muted)';
      case 'claimed': return 'var(--bo-amber)';
      case 'completed': return 'var(--success)';
      case 'failed': return 'var(--error)';
      default: return 'var(--text-muted)';
    }
  }

  function getTimelineSteps(status: ExecutionStatus): { label: string; state: 'completed' | 'current' | 'pending' }[] {
    const steps = [
      { label: 'Pre-Flight', key: 'pre_flight' as const },
      { label: 'Queued', key: 'queued' as const },
      { label: 'Running', key: 'running' as const },
    ];
    if (status === 'completed') {
      return [...steps.map(s => ({ ...s, state: 'completed' as const })), { label: 'Completed', state: 'completed' as const }];
    }
    if (status === 'failed') {
      return [...steps.map((s, i) => i < 2 ? { ...s, state: 'completed' as const } : { ...s, state: 'pending' as const }), { label: 'Failed', state: 'current' as const }];
    }
    if (status === 'paused' || status === 'stopped') {
      return [...steps.map((s, i) => i < 2 ? { ...s, state: 'completed' as const } : s.key === status ? { label: getStatusLabel(status), state: 'current' as const } : { label: s.label, state: 'pending' as const })];
    }
    return steps.map((s, i) => {
      const statusOrder = ['pre_flight', 'queued', 'running'];
      const currentIdx = statusOrder.indexOf(status);
      const stepIdx = i;
      if (stepIdx < currentIdx) return { ...s, state: 'completed' as const };
      if (stepIdx === currentIdx) return { ...s, state: 'current' as const };
      return { ...s, state: 'pending' as const };
    });
  }

  let timelineSteps = $derived(getTimelineSteps(execution.status));

  let completedTasks = $derived(tasks.filter(t => t.status === 'completed').length);
  let totalTasks = $derived(tasks.length);
  let taskProgress = $derived(totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0);

  async function handleAction(action: 'pause' | 'resume' | 'cancel') {
    if (actionLoading) return;
    actionLoading = action;
    try {
      await updateExecution(execution.id, action);
      await invalidateAll();
    } catch (err) {
      console.error(`Failed to ${action} execution:`, err);
    } finally {
      actionLoading = null;
    }
  }

  onMount(() => {
    const executionId = execution.id;
    const url = `/api/executions/${executionId}/events`;
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      sseConnected = true;
    };

    eventSource.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as ExecutionProgressEvent;
        events = [...events.slice(-99), event];
      } catch { /* ignore malformed */ }
    };

    eventSource.onerror = () => {
      sseConnected = false;
      eventSource?.close();
    };

    return () => {
      eventSource?.close();
    };
  });

  onDestroy(() => {
    eventSource?.close();
  });

  let showSynthesis = $state(false);
</script>

<div class="execution-detail">
  <div class="page-header">
    <a href="/office/executions" class="back-link">← All Executions</a>
    <h1 class="page-title">Execution</h1>
  </div>

  <div class="execution-overview">
    <div class="overview-main">
      <div class="status-row">
        <span
          class="status-badge"
          style="color: {getStatusColor(execution.status)}; border-color: {getStatusColor(execution.status)}"
        >
          {getStatusLabel(execution.status)}
        </span>
        <span class="execution-date">{formatDate(execution.createdAt)}</span>
      </div>
      <p class="execution-objective">{execution.objective}</p>
      <div class="execution-meta">
        <span class="meta-item">◈ {execution.maxBots} bots max</span>
        {#if execution.budgetCapCents}
          <span class="meta-item">◎ ${(execution.budgetCapCents / 100).toFixed(2)} budget</span>
        {/if}
        {#if execution.runtimeLimitSeconds}
          <span class="meta-item">⏱ {Math.floor(execution.runtimeLimitSeconds / 60)}m limit</span>
        {/if}
      </div>
    </div>

    <div class="overview-controls">
      {#if execution.status === 'running'}
        <button
          class="btn-control"
          class:loading={actionLoading === 'pause'}
          onclick={() => handleAction('pause')}
          disabled={!!actionLoading}
        >
          {actionLoading === 'pause' ? 'Pausing...' : 'Pause'}
        </button>
      {/if}
      {#if execution.status === 'paused'}
        <button
          class="btn-control btn-resume"
          class:loading={actionLoading === 'resume'}
          onclick={() => handleAction('resume')}
          disabled={!!actionLoading}
        >
          {actionLoading === 'resume' ? 'Resuming...' : 'Resume'}
        </button>
      {/if}
      {#if execution.status === 'running' || execution.status === 'paused'}
        <button
          class="btn-control btn-cancel"
          class:loading={actionLoading === 'cancel'}
          onclick={() => handleAction('cancel')}
          disabled={!!actionLoading}
        >
          {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel'}
        </button>
      {/if}
    </div>
  </div>

  <div class="progress-section">
    <div class="timeline">
      {#each timelineSteps as step, i}
        <div class="timeline-step" class:completed={step.state === 'completed'} class:current={step.state === 'current'} class:pending={step.state === 'pending'}>
          <div class="timeline-dot"></div>
          {#if i < timelineSteps.length - 1}
            <div class="timeline-line" class:filled={step.state === 'completed'}></div>
          {/if}
          <span class="timeline-label">{step.label}</span>
        </div>
      {/each}
    </div>

    {#if totalTasks > 0}
      <div class="task-progress">
        <div class="progress-header">
          <span class="progress-label">TASKS</span>
          <span class="progress-count">{completedTasks} / {totalTasks}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: {taskProgress}%"></div>
        </div>
      </div>
    {/if}

    <div class="sse-status">
      <span class="sse-dot" class:connected={sseConnected}></span>
      <span class="sse-label">{sseConnected ? 'Live' : 'Disconnected'}</span>
    </div>
  </div>

  <div class="detail-grid">
    <section class="detail-section bots-section">
      <h2 class="section-heading">Bots ({bots.length})</h2>
      {#if bots.length === 0}
        <p class="empty-text">No bots assigned yet.</p>
      {:else}
        <div class="bots-list">
          {#each bots as bot}
            <div class="bot-item">
              <div class="bot-header">
                <span class="bot-id">{bot.id.slice(0, 8)}</span>
                <span
                  class="bot-status"
                  style="color: {getBotStatusColor(bot.status)}"
                >{bot.status}</span>
              </div>
              <div class="bot-stats">
                <span class="bot-stat">Claimed: {bot.tasksClaimed}</span>
                <span class="bot-stat">Done: {bot.tasksCompleted}</span>
                <span class="bot-stat">Failed: {bot.tasksFailed}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="detail-section tasks-section">
      <h2 class="section-heading">Tasks ({totalTasks})</h2>
      {#if tasks.length === 0}
        <p class="empty-text">No tasks yet.</p>
      {:else}
        <div class="tasks-list">
          {#each tasks as task}
            <div class="task-item" class:completed={task.status === 'completed'} class:failed={task.status === 'failed'}>
              <span
                class="task-status-dot"
                style="background: {getTaskStatusColor(task.status)}"
              ></span>
              <span class="task-desc">{task.description}</span>
              {#if task.claimedByBotId}
                <span class="task-bot">◈ {task.claimedByBotId.slice(0, 8)}</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </div>

  {#if ringLeader?.runState}
    <section class="detail-section ringleader-section">
      <h2 class="section-heading">Ring Leader</h2>
      <div class="ringleader-state">
        <div class="rl-stat">
          <span class="rl-label">Elapsed</span>
          <span class="rl-value">{Math.floor((ringLeader.runState?.elapsedTimeSeconds ?? 0) / 60)}m {((ringLeader.runState?.elapsedTimeSeconds ?? 0) % 60)}s</span>
        </div>
        <div class="rl-stat">
          <span class="rl-label">Budget Used</span>
          <span class="rl-value">${((ringLeader.runState?.budgetConsumedCents ?? 0) / 100).toFixed(2)}</span>
        </div>
        <div class="rl-stat">
          <span class="rl-label">Drift Score</span>
          <span class="rl-value">{((ringLeader.runState?.objectiveDriftScore ?? 0) * 100).toFixed(1)}%</span>
        </div>
        {#if ringLeader.runState?.anomalies?.length}
          <div class="rl-anomalies">
            <span class="rl-label">Anomalies</span>
            {#each ringLeader.runState.anomalies as anomaly}
              <span class="anomaly-tag">{anomaly}</span>
            {/each}
          </div>
        {/if}
      </div>
    </section>
  {/if}

  {#if synthesis?.synthesis}
    <section class="detail-section synthesis-section">
      <div class="section-header">
        <h2 class="section-heading">Ring Leader Synthesis</h2>
        <button class="toggle-btn" onclick={() => showSynthesis = !showSynthesis}>
          {showSynthesis ? 'Hide' : 'Show'}
        </button>
      </div>
      {#if showSynthesis}
        <div class="synthesis-content">
          <div class="synthesis-main">
            <p class="synthesis-achievement">
              <strong>Objective Achieved:</strong> {synthesis.synthesis.objectiveAchieved ? 'Yes' : 'No'}
            </p>
            <p class="synthesis-rationale">{synthesis.synthesis.achievementRationale}</p>
          </div>

          {#if synthesis.fitness}
            <div class="fitness-scores">
              <h3 class="fitness-title">Fitness</h3>
              <div class="fitness-grid">
                <div class="fitness-category">
                  <span class="fitness-cat-label">Coordination</span>
                  <span class="fitness-score">{((synthesis.fitness.coordinationScore?.collectiveOutcome ?? 0) * 100).toFixed(0)}%</span>
                </div>
                <div class="fitness-category">
                  <span class="fitness-cat-label">Soul Selection</span>
                  <span class="fitness-score">{((synthesis.fitness.soulSelectionScore?.differentiationEffectiveness ?? 0) * 100).toFixed(0)}%</span>
                </div>
                <div class="fitness-category composite">
                  <span class="fitness-cat-label">Composite</span>
                  <span class="fitness-score">{(synthesis.fitness.compositeScore * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          {/if}

          <div class="synthesis-events">
            <span class="event-stat">Routing: {synthesis.synthesis.intelligenceRoutingEvents}</span>
            <span class="event-stat">Reallocations: {synthesis.synthesis.reallocationEvents}</span>
            <span class="event-stat">Reanchoring: {synthesis.synthesis.reanchoringEvents}</span>
          </div>

          {#if synthesis.synthesis.ringLeaderSelfAssessment}
            <div class="synthesis-assessment">
              <h4>Self Assessment</h4>
              <p>{synthesis.synthesis.ringLeaderSelfAssessment}</p>
            </div>
          {/if}
        </div>
      {/if}
    </section>
  {/if}

  {#if events.length > 0}
    <section class="detail-section events-section">
      <h2 class="section-heading">Live Events</h2>
      <div class="events-list">
        {#each events.slice(-20).reverse() as event}
          <div class="event-item">
            <span class="event-time">{event.timestamp ? formatDate(event.timestamp) : '—'}</span>
            <span class="event-type">{event.type}</span>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .execution-detail {
    max-width: 1200px;
  }

  .page-header {
    margin-bottom: var(--space-xl);
  }

  .back-link {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
    text-decoration: none;
    display: inline-block;
    margin-bottom: var(--space-sm);
    transition: color 0.15s;
  }

  .back-link:hover {
    color: var(--accent);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(22px, 3vw, 32px);
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .execution-overview {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-xl);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
    margin-bottom: var(--space-xl);
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }

  .status-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    padding: 4px 10px;
    border: 1px solid;
    border-radius: var(--radius-sm);
  }

  .execution-date {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
  }

  .execution-objective {
    font-family: var(--font-body);
    font-size: 16px;
    font-weight: 500;
    color: var(--text);
    margin: 0 0 var(--space-md) 0;
    line-height: 1.5;
  }

  .execution-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-lg);
  }

  .meta-item {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
  }

  .overview-controls {
    display: flex;
    gap: var(--space-sm);
    flex-shrink: 0;
  }

  .btn-control {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-control:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }

  .btn-control:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-resume {
    border-color: var(--success);
    color: var(--success);
  }

  .btn-cancel {
    border-color: var(--error);
    color: var(--error);
  }

  .progress-section {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
    margin-bottom: var(--space-xl);
  }

  .timeline {
    display: flex;
    align-items: center;
    margin-bottom: var(--space-xl);
  }

  .timeline-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    flex: 1;
  }

  .timeline-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--border);
    background: var(--card);
    margin-bottom: var(--space-xs);
    transition: all 0.2s;
  }

  .timeline-step.completed .timeline-dot {
    background: var(--success);
    border-color: var(--success);
  }

  .timeline-step.current .timeline-dot {
    background: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-dim);
  }

  .timeline-line {
    position: absolute;
    top: 6px;
    left: calc(50% + 6px);
    right: calc(-50% + 6px);
    height: 2px;
    background: var(--border);
  }

  .timeline-line.filled {
    background: var(--success);
  }

  .timeline-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .timeline-step.completed .timeline-label,
  .timeline-step.current .timeline-label {
    color: var(--text);
  }

  .task-progress {
    margin-bottom: var(--space-lg);
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-xs);
  }

  .progress-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
  }

  .progress-count {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }

  .progress-bar {
    height: 6px;
    background: var(--bg2);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--success);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .sse-status {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .sse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--error);
  }

  .sse-dot.connected {
    background: var(--success);
  }

  .sse-label {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--text-muted);
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-xl);
    margin-bottom: var(--space-xl);
  }

  .detail-section {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
  }

  .section-heading {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 var(--space-lg) 0;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
  }

  .section-header .section-heading {
    margin: 0;
  }

  .toggle-btn {
    font-family: var(--font-body);
    font-size: 11px;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .toggle-btn:hover {
    border-color: var(--accent);
    color: var(--text);
  }

  .empty-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
    font-style: italic;
  }

  .bots-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .bot-item {
    background: var(--bg2);
    border-radius: var(--radius-sm);
    padding: var(--space-md);
  }

  .bot-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-xs);
  }

  .bot-id {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text);
  }

  .bot-status {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .bot-stats {
    display: flex;
    gap: var(--space-md);
  }

  .bot-stat {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--text-muted);
  }

  .tasks-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    max-height: 300px;
    overflow-y: auto;
  }

  .task-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    transition: background 0.1s;
  }

  .task-item:hover {
    background: var(--bg2);
  }

  .task-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .task-desc {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-bot {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .task-item.completed .task-desc {
    text-decoration: line-through;
    opacity: 0.6;
  }

  .ringleader-state {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xl);
  }

  .rl-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rl-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
  }

  .rl-value {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
  }

  .rl-anomalies {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .anomaly-tag {
    font-family: var(--font-body);
    font-size: 10px;
    padding: 2px 6px;
    background: var(--error-dim);
    color: var(--error);
    border-radius: var(--radius-sm);
  }

  .synthesis-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .synthesis-main {
    border-bottom: 1px solid var(--border);
    padding-bottom: var(--space-lg);
  }

  .synthesis-achievement {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    margin: 0 0 var(--space-sm) 0;
  }

  .synthesis-rationale {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.6;
  }

  .fitness-scores {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .fitness-title {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
    margin: 0;
  }

  .fitness-grid {
    display: flex;
    gap: var(--space-md);
  }

  .fitness-category {
    flex: 1;
    background: var(--bg2);
    padding: var(--space-md);
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .fitness-category.composite {
    background: var(--accent-dim);
  }

  .fitness-cat-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .fitness-score {
    font-family: var(--font-body);
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
  }

  .synthesis-events {
    display: flex;
    gap: var(--space-xl);
  }

  .event-stat {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }

  .synthesis-assessment h4 {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
    margin: 0 0 var(--space-sm) 0;
  }

  .synthesis-assessment p {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text);
    margin: 0;
    line-height: 1.6;
  }

  .events-section {
    max-height: 300px;
    overflow-y: auto;
  }

  .events-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .event-item {
    display: flex;
    gap: var(--space-md);
    padding: var(--space-xs) 0;
    border-bottom: 1px solid var(--bg2);
  }

  .event-time {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .event-type {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text);
  }

  @media (max-width: 768px) {
    .detail-grid {
      grid-template-columns: 1fr;
    }

    .execution-overview {
      flex-direction: column;
    }
  }
</style>
