<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { getObjective, getObjectiveExecutions, getObjectiveStats, getExecutionMetrics, getObjectiveTimeline } from '$lib/api';
  import { connectSSE } from '$lib/sse';
  import type { Objective, ObjectiveRun, ObjectiveStats, ExecutionMetrics, ActivityEvent, ObjectiveTimelineEvent } from '$lib/types';

  const objectiveId = $derived(page.params.id ?? '');

  let objective = $state<Objective | null>(null);
  let runs = $state<ObjectiveRun[]>([]);
  let stats = $state<ObjectiveStats | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Live status (HUB-03)
  // activeRunId is a separate $state (NOT $derived from runs) to avoid the infinite re-run pitfall.
  // It is set once after initial load and cleared when a terminal execution_status_changed event arrives.
  let activeRunId = $state<string | null>(null);
  let liveMetrics = $state<ExecutionMetrics | null>(null);
  let activityFeed = $state<ActivityEvent[]>([]);

  // Edit mode state
  let editMode = $state(false);
  let editName = $state('');
  let editDescription = $state('');
  let editMaxBots = $state(5);
  let editBudgetCapDollars = $state('');
  let editRuntimeLimitMinutes = $state('');
  let editSelectedTools = $state<Set<string>>(new Set());
  let saving = $state(false);
  let saveError = $state<string | null>(null);

  // Archive dialog state
  let showArchiveDialog = $state(false);
  let archiving = $state(false);

  // Timeline state (OBJ-04)
  let timeline = $state<ObjectiveTimelineEvent[]>([]);
  let timelineTotal = $state(0);
  let timelineHasMore = $state(false);
  let timelineLoading = $state(false);
  let activeFilter = $state('all');
  let expandedIds = $state<Set<string>>(new Set());

  const FILTER_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'promote', label: 'Promotions' },
    { value: 'demote', label: 'Demotions' },
    { value: 'retire', label: 'Retirements' },
    { value: 'pioneer', label: 'Pioneers' },
    { value: 'monitor_maintain', label: 'Monitor/Maintain' },
  ];

  const TIMELINE_PAGE_SIZE = 20;

  const AVAILABLE_TOOLS = [
    { id: 'bash', label: 'Bash', description: 'Execute shell commands' },
    { id: 'file_read', label: 'File Read', description: 'Read files from the filesystem' },
    { id: 'file_write', label: 'File Write', description: 'Write files to the filesystem' },
    { id: 'web_search', label: 'Web Search', description: 'Search the web' },
    { id: 'web_fetch', label: 'Web Fetch', description: 'Fetch content from URLs' },
  ];

  // Timeline helpers
  function nodeColor(eventType: string): string {
    switch (eventType) {
      case 'Promote':  return 'green';
      case 'Retire':   return 'red';
      case 'Demote':   return 'amber';
      case 'Pioneer':  return 'violet';
      default:         return 'neutral';
    }
  }

  function toggleExpanded(id: string) {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedIds = next;
  }

  async function loadTimeline(reset = false) {
    if (!objectiveId) return;
    timelineLoading = true;
    const offset = reset ? 0 : timeline.length;
    try {
      const data = await getObjectiveTimeline(objectiveId, {
        limit: TIMELINE_PAGE_SIZE,
        offset,
        filter: activeFilter,
      });
      if (reset) {
        timeline = data.events;
      } else {
        timeline = [...timeline, ...data.events];
      }
      timelineTotal = data.total;
      timelineHasMore = data.hasMore;
    } catch {
      // silently fail — timeline is non-critical
    } finally {
      timelineLoading = false;
    }
  }

  function formatTimelineDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function classBadgeClass(cls: string | null): string {
    if (!cls) return '';
    switch (cls) {
      case 'Novice': return 'class-novice';
      case 'Understudy': return 'class-understudy';
      case 'Artisan': return 'class-artisan';
      case 'Retired': return 'class-retired';
      default: return '';
    }
  }

  // Effect 1 — Load all data on mount
  $effect(() => {
    if (!browser || !objectiveId) return;
    loading = true;
    Promise.all([
      getObjective(objectiveId),
      getObjectiveExecutions(objectiveId),
      getObjectiveStats(objectiveId),
    ])
      .then(([obj, r, s]) => {
        objective = obj;
        runs = r;
        stats = s;
        // Set activeRunId from loaded data (one-time)
        const running = r.find(run => run.status === 'running');
        activeRunId = running?.id ?? null;
        loading = false;
        // Load timeline after main data
        loadTimeline(true);
      })
      .catch(err => { error = (err as Error).message; loading = false; });
  });

  // Effect 2 — SSE + metrics polling for live status (HUB-03)
  $effect(() => {
    if (!browser || !activeRunId) return;
    const runId = activeRunId; // capture for cleanup closure

    // Initial metrics fetch
    getExecutionMetrics(runId).then(m => { liveMetrics = m; }).catch(() => {});

    // Poll metrics every 5 seconds
    const interval = setInterval(() => {
      getExecutionMetrics(runId).then(m => { liveMetrics = m; }).catch(() => {});
    }, 5000);

    // SSE for activity events (keep last 5)
    const cleanup = connectSSE(runId, (event) => {
      activityFeed = [event, ...activityFeed].slice(0, 5);
      // If execution reaches terminal state, clear activeRunId to disconnect
      if (event.type === 'execution_status_changed') {
        const toStatus = event['toStatus'] as string | undefined;
        if (toStatus === 'completed' || toStatus === 'failed' || toStatus === 'stopped') {
          activeRunId = null;
          // Refresh runs to update status in table
          getObjectiveExecutions(objectiveId).then(r => { runs = r; }).catch(() => {});
          getObjectiveStats(objectiveId).then(s => { stats = s; }).catch(() => {});
        }
      }
    });

    return () => { clearInterval(interval); cleanup?.(); };
  });

  function enterEditMode() {
    if (!objective) return;
    editName = objective.name;
    editDescription = objective.description ?? '';
    editMaxBots = objective.defaultMaxBots;
    editBudgetCapDollars = objective.defaultBudgetCapCents != null
      ? String(objective.defaultBudgetCapCents / 100)
      : '';
    editRuntimeLimitMinutes = objective.defaultRuntimeLimitSeconds != null
      ? String(objective.defaultRuntimeLimitSeconds / 60)
      : '';
    editSelectedTools = new Set(objective.defaultAllowedTools);
    editMode = true;
    saveError = null;
  }

  function toggleEditTool(id: string) {
    const next = new Set(editSelectedTools);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    editSelectedTools = next;
  }

  const handleUpdateEnhance = () => {
    saving = true;
    saveError = null;
    return async ({ result }: { result: { type: string; data?: Record<string, unknown> } }) => {
      saving = false;
      if (result.type === 'success' && result.data?.objective) {
        objective = result.data.objective as Objective;
        editMode = false;
      } else if (result.type === 'failure') {
        saveError = (result.data?.error as string) ?? 'Failed to save.';
      }
      // Do NOT call update() — prevents form reset and navigation
    };
  };

  function formatEventDetail(event: ActivityEvent): string {
    const botId = event['botId'] as string | undefined;
    const short = botId ? botId.slice(0, 8) : 'unknown';
    const reason = event['reason'] as string | undefined;
    switch (event.type) {
      case 'task_claimed': return `Bot ${short} claimed task`;
      case 'task_completed': return `Task completed by bot ${short}`;
      case 'bot_started': return `Bot ${short} started`;
      case 'bot_stopped': return `Bot ${short} stopped${reason ? ` (${reason})` : ''}`;
      case 'guardrail_triggered': return `Bot ${short}: ${reason ?? 'guardrail triggered'}`;
      case 'budget_exceeded': return 'Budget exceeded for execution';
      default: {
        const { type: _type, executionId: _eid, timestamp: _ts, isAlert: _ia, ...rest } = event;
        const detail = JSON.stringify(rest);
        return detail.length > 120 ? detail.slice(0, 117) + '...' : detail;
      }
    }
  }
</script>

<svelte:head>
  <title>{objective?.name ?? 'Objective'} | Akasa</title>
</svelte:head>

<div class="page">
  {#if loading}
    <div class="loading">Loading objective...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}

    <!-- Section 1: Objective Header -->
    {#if editMode}
      <!-- Edit Form -->
      <form method="POST" action="?/update" use:enhance={handleUpdateEnhance} class="edit-form">
        <div class="panel">
          <label class="panel-label" for="edit-name">Name</label>
          <input
            id="edit-name"
            type="text"
            name="name"
            bind:value={editName}
            required
            class="edit-input"
            placeholder="Objective name"
          />
        </div>

        <div class="panel">
          <label class="panel-label" for="edit-description">Description</label>
          <textarea
            id="edit-description"
            name="description"
            bind:value={editDescription}
            class="edit-textarea"
            placeholder="What should the crew accomplish?"
            rows="3"
          ></textarea>
        </div>

        <div class="panel">
          <label class="panel-label" for="edit-maxbots">Crew Size: {editMaxBots} bots</label>
          <input
            id="edit-maxbots"
            type="range"
            name="defaultMaxBots"
            min="3"
            max="20"
            bind:value={editMaxBots}
            class="edit-range"
          />
          <div class="range-labels">
            <span>3</span>
            <span>20</span>
          </div>
        </div>

        <div class="panel panel-row">
          <div class="panel-half">
            <label class="panel-label" for="edit-budget">Budget Cap (USD)</label>
            <input
              id="edit-budget"
              type="number"
              name="budgetCapDollars"
              bind:value={editBudgetCapDollars}
              step="0.01"
              min="0"
              class="edit-input"
              placeholder="Leave blank for no limit"
            />
          </div>
          <div class="panel-half">
            <label class="panel-label" for="edit-runtime">Runtime Limit (minutes)</label>
            <input
              id="edit-runtime"
              type="number"
              name="runtimeLimitMinutes"
              bind:value={editRuntimeLimitMinutes}
              min="1"
              class="edit-input"
              placeholder="Leave blank for no limit"
            />
          </div>
        </div>

        <div class="panel">
          <div class="panel-label">Tool Allowlist</div>
          <div class="tools-grid">
            {#each AVAILABLE_TOOLS as tool}
              <button
                type="button"
                class="tool-toggle"
                class:active={editSelectedTools.has(tool.id)}
                onclick={() => toggleEditTool(tool.id)}
              >
                <span class="tool-name">{tool.label}</span>
                {#if editSelectedTools.has(tool.id)}
                  <span class="tool-badge">ENABLED</span>
                {/if}
              </button>
              {#if editSelectedTools.has(tool.id)}
                <input type="hidden" name="allowedTools" value={tool.id} />
              {/if}
            {/each}
          </div>
        </div>

        {#if saveError}
          <p class="field-error">{saveError}</p>
        {/if}

        <div class="edit-actions">
          <button type="button" class="btn-cancel" onclick={() => { editMode = false; saveError = null; }}>
            Cancel
          </button>
          <button type="submit" class="btn-save" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    {:else}
      <!-- Read View -->
      <h1>{objective?.name ?? 'Objective'}</h1>
      {#if objective?.description}
        <p class="subtitle">{objective.description}</p>
      {/if}
      <p class="meta">Created {new Date(objective?.createdAt ?? '').toLocaleDateString()} | Default bots: {objective?.defaultMaxBots}</p>

      <div class="header-actions">
        <button onclick={enterEditMode} class="btn-edit">Edit</button>
        <button onclick={() => showArchiveDialog = true} class="btn-archive">Archive</button>
        <a
          href="/new-execution?objectiveId={objectiveId}&maxBots={objective?.defaultMaxBots ?? 3}&budgetCapDollars={objective?.defaultBudgetCapCents ? objective.defaultBudgetCapCents / 100 : 10}"
          class="launch-objective-btn"
        >
          Launch from this objective
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      </div>
    {/if}

    <!-- Section 2: Aggregate Stats Panel (HUB-02) -->
    <section class="section">
      <h2>Aggregate Stats</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Total Spend</span>
          <span class="stat-value">${stats ? (stats.totalSpendCents / 100).toFixed(2) : '---'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Tasks Completed</span>
          <span class="stat-value">{stats?.totalTasksCompleted ?? '---'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Bot-Hours</span>
          <span class="stat-value">{stats ? stats.totalBotHours.toFixed(2) : '---'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Total Runs</span>
          <span class="stat-value">{stats?.runCount ?? '---'}</span>
        </div>
      </div>
    </section>

    <!-- Section 3: Live Status Panel (HUB-03) — conditional -->
    {#if activeRunId}
      <section class="section live-section">
        <h2>Live Run</h2>
        <div class="live-panel">
          <div class="live-stats">
            <div class="live-stat">
              <span class="live-label">Active Bots</span>
              <span class="live-value teal-val">{liveMetrics?.activeBotCount ?? '---'}</span>
            </div>
            <div class="live-stat">
              <span class="live-label">Budget Burn</span>
              <span class="live-value amber-val">${liveMetrics ? (liveMetrics.spentCents / 100).toFixed(2) : '---'} / ${liveMetrics ? (liveMetrics.budgetCapCents / 100).toFixed(2) : '---'}</span>
            </div>
            <div class="live-stat">
              <span class="live-label">Remaining</span>
              <span class="live-value">${liveMetrics ? (liveMetrics.remainingCents / 100).toFixed(2) : '---'}</span>
            </div>
          </div>
          <div class="activity-feed">
            <h3>Recent Activity</h3>
            {#if activityFeed.length === 0}
              <p class="empty">Waiting for events...</p>
            {:else}
              {#each activityFeed as event}
                <div class="activity-item">
                  <span class="activity-detail">{formatEventDetail(event)}</span>
                  <span class="activity-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
              {/each}
            {/if}
            <a href="/executions/{activeRunId}" class="view-full-run">View full run &rarr;</a>
          </div>
        </div>
      </section>
    {/if}

    <!-- Section 4: Run History Table (HUB-01) -->
    <section class="section">
      <h2>Run History</h2>
      {#if runs.length === 0}
        <p class="empty">No runs yet for this objective.</p>
      {:else}
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Bots</th>
                <th>Avg Score</th>
                <th class="col-cost">Cost</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each runs as run}
                <tr>
                  <td class="col-date">{new Date(run.createdAt).toLocaleDateString()}</td>
                  <td><span class="status status-{run.status}">{run.status}</span></td>
                  <td>{run.botCount}</td>
                  <td class="col-score">{run.avgCompositeScore !== null ? run.avgCompositeScore.toFixed(2) : '---'}</td>
                  <td class="col-cost">${(run.totalCostCents / 100).toFixed(2)}</td>
                  <td><a href="/executions/{run.id}" class="view-link">View</a></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    <!-- Section 5: DNA Evolution Summary (HUB-04) -->
    <section class="section">
      <h2>DNA Evolution</h2>
      {#if stats && stats.runCount > 0}
        <p class="trend-summary">{stats.classTrendSummary}</p>
        <div class="class-list">
          <div class="class-item">
            <span class="class-badge class-artisan">Artisan</span>
            <span class="class-count">{stats.classBreakdown.artisan}</span>
          </div>
          <div class="class-item">
            <span class="class-badge class-understudy">Understudy</span>
            <span class="class-count">{stats.classBreakdown.understudy}</span>
          </div>
          <div class="class-item">
            <span class="class-badge class-novice">Novice</span>
            <span class="class-count">{stats.classBreakdown.novice}</span>
          </div>
          <div class="class-item">
            <span class="class-badge class-retired">Retired</span>
            <span class="class-count">{stats.classBreakdown.retired}</span>
          </div>
        </div>
      {:else}
        <p class="empty">Run this objective to start evolving your army's DNA.</p>
      {/if}
    </section>

    <!-- Section 6: Evolution Timeline (OBJ-04) -->
    <section class="section">
      <h2>Evolution Timeline</h2>

      <!-- Filter chips -->
      <div class="tl-filters">
        {#each FILTER_OPTIONS as opt}
          <button
            class="tl-chip"
            class:tl-chip-active={activeFilter === opt.value}
            onclick={() => { activeFilter = opt.value; loadTimeline(true); }}
          >{opt.label}</button>
        {/each}
      </div>

      {#if timelineLoading && timeline.length === 0}
        <!-- Loading skeleton -->
        <div class="tl-skeleton">
          {#each [1, 2, 3] as _}
            <div class="tl-skeleton-row">
              <div class="tl-skeleton-node"></div>
              <div class="tl-skeleton-content">
                <div class="tl-skeleton-line tl-skeleton-short"></div>
                <div class="tl-skeleton-line tl-skeleton-long"></div>
              </div>
            </div>
          {/each}
        </div>
      {:else if timeline.length === 0 && !timelineLoading}
        <!-- Empty state -->
        <div class="tl-empty">
          {#if stats && stats.runCount === 0}
            <p>No evolution history yet. Launch your first run to start building soul intelligence.</p>
            <a href="/new-execution?objectiveId={objectiveId}" class="tl-launch-link">Launch a run</a>
          {:else}
            <p>No events match the current filter.</p>
          {/if}
        </div>
      {:else}
        <!-- Timeline -->
        <div class="tl-timeline">
          {#each timeline as event (event.id)}
            <div class="tl-item">
              <div class="tl-node tl-node-{nodeColor(event.eventType)}" role="presentation"></div>
              <div class="tl-content">
                <!-- Collapsed header (always visible) -->
                <button class="tl-header" onclick={() => toggleExpanded(event.id)}>
                  <div class="tl-header-top">
                    <span class="tl-event-type tl-type-{nodeColor(event.eventType)}">{event.eventType}</span>
                    {#if event.isPioneer && event.eventType === 'Pioneer'}
                      <span class="tl-pioneer-badge">PIONEER</span>
                    {/if}
                    {#if event.taskCategory}
                      <span class="tl-category">{event.taskCategory}</span>
                    {/if}
                    <span class="tl-date">{formatTimelineDate(event.occurredAt)}</span>
                  </div>
                  <div class="tl-header-mid">
                    {#if event.fromClass || event.toClass}
                      <span class="tl-transition">
                        {#if event.fromClass}
                          <span class="class-badge {classBadgeClass(event.fromClass)}">{event.fromClass}</span>
                        {/if}
                        {#if event.fromClass && event.toClass}
                          <span class="tl-arrow">&rarr;</span>
                        {/if}
                        {#if event.toClass}
                          <span class="class-badge {classBadgeClass(event.toClass)}">{event.toClass}</span>
                        {/if}
                      </span>
                    {/if}
                    <a href="/executions/{event.executionId}" class="tl-run-link" onclick={(e) => e.stopPropagation()}>
                      Run #{event.runNumber}
                    </a>
                  </div>
                  <div class="tl-header-bottom">
                    <div class="tl-scores">
                      {#if event.weightedConfidenceScore != null}
                        <span class="tl-score" title="Weighted confidence">
                          <span class="tl-score-label">Conf</span>
                          <span class="tl-score-value">{(event.weightedConfidenceScore * 100).toFixed(0)}%</span>
                        </span>
                      {/if}
                      {#if event.compositeScore != null}
                        <span class="tl-score" title="Composite fitness">
                          <span class="tl-score-label">Fitness</span>
                          <span class="tl-score-value">{Number(event.compositeScore).toFixed(1)}</span>
                        </span>
                      {/if}
                    </div>
                    {#if event.verdictSummary}
                      <p class="tl-summary">{event.verdictSummary.length > 120 ? event.verdictSummary.slice(0, 120) + '...' : event.verdictSummary}</p>
                    {/if}
                  </div>
                </button>

                <!-- Expanded view -->
                {#if expandedIds.has(event.id)}
                  <div class="tl-expanded">
                    {#if event.verdictSummary}
                      <div class="tl-exp-section">
                        <h4 class="tl-exp-label">Full Verdict Summary</h4>
                        <p class="tl-exp-text">{event.verdictSummary}</p>
                      </div>
                    {/if}

                    {#if event.performanceJudgeOutput || event.soulAnalystOutput || event.devilsAdvocateOutput}
                      <div class="tl-exp-section">
                        <h4 class="tl-exp-label">Council Judges</h4>
                        <div class="tl-judges">
                          {#if event.performanceJudgeOutput}
                            <div class="tl-judge">
                              <span class="tl-judge-name">Performance Judge <span class="tl-judge-weight">50%</span></span>
                              <p class="tl-judge-text">
                                {typeof event.performanceJudgeOutput === 'object' && event.performanceJudgeOutput !== null && 'summary' in (event.performanceJudgeOutput as Record<string, unknown>)
                                  ? String((event.performanceJudgeOutput as Record<string, unknown>).summary)
                                  : typeof event.performanceJudgeOutput === 'object' && event.performanceJudgeOutput !== null && 'verdict' in (event.performanceJudgeOutput as Record<string, unknown>)
                                    ? String((event.performanceJudgeOutput as Record<string, unknown>).verdict)
                                    : JSON.stringify(event.performanceJudgeOutput).slice(0, 200)}
                              </p>
                            </div>
                          {/if}
                          {#if event.soulAnalystOutput}
                            <div class="tl-judge">
                              <span class="tl-judge-name">Soul Analyst <span class="tl-judge-weight">35%</span></span>
                              <p class="tl-judge-text">
                                {typeof event.soulAnalystOutput === 'object' && event.soulAnalystOutput !== null && 'summary' in (event.soulAnalystOutput as Record<string, unknown>)
                                  ? String((event.soulAnalystOutput as Record<string, unknown>).summary)
                                  : typeof event.soulAnalystOutput === 'object' && event.soulAnalystOutput !== null && 'verdict' in (event.soulAnalystOutput as Record<string, unknown>)
                                    ? String((event.soulAnalystOutput as Record<string, unknown>).verdict)
                                    : JSON.stringify(event.soulAnalystOutput).slice(0, 200)}
                              </p>
                            </div>
                          {/if}
                          {#if event.devilsAdvocateOutput}
                            <div class="tl-judge">
                              <span class="tl-judge-name">Devil's Advocate <span class="tl-judge-weight">15%</span></span>
                              <p class="tl-judge-text">
                                {typeof event.devilsAdvocateOutput === 'object' && event.devilsAdvocateOutput !== null && 'verdict' in (event.devilsAdvocateOutput as Record<string, unknown>)
                                  ? String((event.devilsAdvocateOutput as Record<string, unknown>).verdict)
                                  : JSON.stringify(event.devilsAdvocateOutput).slice(0, 200)}
                              </p>
                            </div>
                          {/if}
                        </div>
                      </div>
                    {/if}

                    {#if event.hasMutationLineage}
                      <div class="tl-exp-section">
                        <span class="tl-mutation-badge">Mutation lineage detected</span>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        {#if timelineHasMore}
          <button class="tl-load-more" onclick={() => loadTimeline(false)} disabled={timelineLoading}>
            {timelineLoading ? 'Loading...' : 'Load more'}
          </button>
        {/if}
      {/if}
    </section>

  {/if}
</div>

<!-- Archive confirmation dialog -->
{#if showArchiveDialog}
  <div class="dialog-backdrop" onclick={() => showArchiveDialog = false} role="presentation">
    <div class="dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <h3>Archive {objective?.name}?</h3>
      <p>It will be hidden from your list. Run history is preserved.</p>
      <div class="dialog-actions">
        <button onclick={() => showArchiveDialog = false} class="btn-cancel">Cancel</button>
        <form method="POST" action="?/archive" use:enhance={() => {
          archiving = true;
          return async ({ result }: { result: { type: string } }) => {
            archiving = false;
            if (result.type === 'success') {
              goto('/objectives');
            }
          };
        }}>
          <button type="submit" class="btn-archive-confirm" disabled={archiving}>
            {archiving ? 'Archiving...' : 'Archive'}
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}

<style>
  .page {
    max-width: 1000px;
    margin: 0 auto;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
    font-family: var(--font-display);
    color: var(--text);
  }

  .subtitle {
    color: var(--text-muted);
    margin: 0 0 0.25rem;
    font-size: 0.9rem;
  }

  .meta {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 0 0 0.5rem;
    font-family: var(--font-mono);
  }

  /* Header actions row */
  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 1rem 0 2rem;
    flex-wrap: wrap;
  }

  .launch-objective-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: var(--accent);
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 10px;
    text-decoration: none;
    transition: background 0.15s;
  }

  .launch-objective-btn:hover {
    background: var(--accent-m);
  }

  .btn-edit {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);
    padding: 0.5rem 1rem;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .btn-edit:hover {
    background: var(--bg3);
    border-color: var(--accent);
  }

  .btn-archive {
    background: transparent;
    border: 1px solid rgba(248,113,113,0.25);
    color: var(--error);
    padding: 0.5rem 1rem;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .btn-archive:hover {
    background: var(--error-dim);
  }

  /* Edit form */
  .edit-form {
    margin-bottom: 2rem;
  }

  .panel {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1rem;
  }

  .panel-row {
    display: flex;
    gap: 1rem;
  }

  .panel-half {
    flex: 1;
  }

  .panel-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: var(--font-mono);
    margin-bottom: 0.5rem;
  }

  .edit-input {
    width: 100%;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.625rem 0.75rem;
    color: var(--text);
    font-size: 0.9375rem;
    outline: none;
    box-sizing: border-box;
  }

  .edit-input:focus {
    border-color: var(--accent);
  }

  .edit-textarea {
    width: 100%;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.625rem 0.75rem;
    color: var(--text);
    font-size: 0.9375rem;
    outline: none;
    resize: vertical;
    font-family: inherit;
    box-sizing: border-box;
  }

  .edit-textarea:focus {
    border-color: var(--accent);
  }

  .edit-range {
    width: 100%;
    accent-color: var(--accent);
  }

  .range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--bo-faint);
    font-family: var(--font-mono);
    margin-top: 0.25rem;
  }

  /* Tool toggles */
  .tools-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tool-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg3);
    color: var(--text-muted);
    font-size: 0.8125rem;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .tool-toggle:hover {
    border-color: var(--accent);
    color: var(--text);
  }

  .tool-toggle.active {
    border-color: var(--accent);
    background: var(--accent-dim);
    color: var(--accent-m);
  }

  .tool-name {
    font-weight: 500;
  }

  .tool-badge {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: var(--font-mono);
    color: var(--accent-m);
  }

  .field-error {
    color: var(--error);
    font-size: 0.8rem;
    margin: 0.5rem 0;
  }

  .edit-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
    padding: 0.5rem 1rem;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-cancel:hover {
    background: var(--bg3);
  }

  .btn-save {
    padding: 0.5rem 1.25rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-save:hover:not(:disabled) {
    background: var(--accent-m);
  }

  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Archive dialog */
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .dialog {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 1.5rem 2rem;
    max-width: 400px;
    width: 90%;
  }

  .dialog h3 {
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text);
  }

  .dialog p {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin: 0 0 1.25rem;
  }

  .dialog-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .btn-archive-confirm {
    padding: 0.5rem 1.25rem;
    background: var(--error);
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-archive-confirm:hover:not(:disabled) {
    opacity: 0.85;
  }

  .btn-archive-confirm:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loading {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }

  .error {
    padding: 1rem;
    background: var(--error-dim);
    border: 1px solid rgba(248,113,113,0.25);
    border-radius: 0.5rem;
    color: var(--error);
  }

  .section {
    margin-bottom: 2.5rem;
  }

  .section h2 {
    font-size: 1.1rem;
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
    font-family: var(--font-display);
    color: var(--text);
  }

  /* Summary stat cards */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }

  .stat-card {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-align: center;
  }

  .stat-label {
    font-size: 10px;
    color: var(--bo-faint);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    font-family: var(--font-mono);
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text);
    font-family: var(--font-mono);
  }

  .empty {
    color: var(--text-muted);
    font-style: italic;
  }

  /* Live panel */
  .live-section {
    border: 1px solid var(--bo-teal);
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
    background: var(--card);
  }
  .live-panel { display: flex; gap: 2rem; flex-wrap: wrap; }
  .live-stats { display: flex; gap: 1.5rem; flex-wrap: wrap; }
  .live-stat { display: flex; flex-direction: column; gap: 0.25rem; }
  .live-label {
    font-size: 10px;
    color: var(--bo-faint);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    font-family: var(--font-mono);
  }
  .live-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text);
    font-family: var(--font-mono);
  }
  .teal-val { color: var(--bo-teal); }
  .amber-val { color: var(--karma); }
  .activity-feed { flex: 1; min-width: 200px; }
  .activity-feed h3 {
    font-weight: 600;
    margin: 0 0 0.5rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.12em;
  }
  .activity-item {
    display: flex;
    justify-content: space-between;
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.8125rem;
    background: var(--bg3);
  }
  .activity-detail {
    color: var(--text-muted);
    font-size: 0.8125rem;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .activity-time {
    color: var(--bo-faint);
    font-size: 0.75rem;
    font-family: var(--font-mono);
  }
  .view-full-run {
    display: inline-block;
    margin-top: 0.75rem;
    font-size: 0.8125rem;
    color: var(--accent-m);
    text-decoration: none;
    font-weight: 500;
  }
  .view-full-run:hover {
    text-decoration: underline;
  }

  /* Execution history table */
  .table-wrapper {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  thead th {
    text-align: left;
    padding: 0.75rem 1rem;
    background: var(--bg3);
    border-bottom: 1px solid var(--border);
    font-weight: 600;
    color: var(--bo-faint);
    white-space: nowrap;
    font-family: var(--font-mono);
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.15em;
  }

  tbody td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }

  tbody tr {
    background: var(--card);
  }

  tbody tr:nth-child(even) {
    background: var(--bg3);
  }

  tbody tr:hover {
    background: var(--card);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  .col-date {
    white-space: nowrap;
    font-size: 0.85rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .col-cost {
    text-align: right;
    font-weight: 600;
    font-family: var(--font-mono);
    color: var(--text);
  }

  .col-score {
    font-family: var(--font-mono);
    color: var(--karma);
  }

  /* Status badge */
  .status {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.025em;
    text-transform: uppercase;
    font-family: var(--font-mono);
  }

  .status-completed {
    color: var(--accent-m);
    background: var(--accent-dim);
    border: 1px solid rgba(167,139,250,0.2);
  }

  .status-failed {
    color: var(--error);
    background: var(--error-dim);
    border: 1px solid rgba(248,113,113,0.2);
  }

  .status-running {
    color: var(--bo-teal);
    background: rgba(45, 212, 191, 0.10);
    border: 1px solid rgba(45,212,191,0.2);
  }

  .status-queued {
    color: var(--bo-faint);
    background: rgba(236,232,255,0.05);
    border: 1px solid var(--border);
  }

  .status-stopped {
    color: var(--karma);
    background: rgba(251, 191, 36, 0.10);
    border: 1px solid rgba(251,191,36,0.2);
  }

  .status-paused {
    color: var(--karma);
    background: rgba(251, 191, 36, 0.10);
    border: 1px solid rgba(251,191,36,0.2);
  }

  /* DNA Evolution */
  .class-list { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.75rem; }
  .class-item { display: flex; align-items: center; gap: 0.5rem; }
  .class-badge {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    font-family: var(--font-mono);
  }
  .class-novice {
    color: var(--text-muted);
    background: rgba(236,232,255,0.05);
    border: 1px solid var(--border);
  }
  .class-understudy {
    color: var(--bo-teal);
    background: rgba(45, 212, 191, 0.10);
    border: 1px solid rgba(45,212,191,0.2);
  }
  .class-artisan {
    color: var(--karma);
    background: rgba(251, 191, 36, 0.10);
    border: 1px solid rgba(251,191,36,0.2);
  }
  .class-retired {
    color: var(--bo-rose);
    background: rgba(244, 114, 182, 0.08);
    border: 1px solid rgba(244,114,182,0.15);
  }
  .class-count {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text);
    font-family: var(--font-mono);
  }
  .trend-summary {
    font-size: 1rem;
    color: var(--text-muted);
    font-weight: 500;
    margin: 0;
  }

  /* View link in table */
  .view-link {
    color: var(--accent-m);
    text-decoration: none;
    font-weight: 500;
  }
  .view-link:hover { text-decoration: underline; }

  /* Evolution Timeline (OBJ-04) */
  .tl-filters {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }
  .tl-chip {
    padding: 0.3rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: var(--font-mono);
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .tl-chip:hover {
    border-color: var(--border);
    color: var(--text);
  }
  .tl-chip-active {
    background: var(--accent-dim);
    border-color: var(--accent);
    color: var(--accent-m);
  }

  /* Timeline structure */
  .tl-timeline {
    position: relative;
    padding-left: 2rem;
  }
  .tl-timeline::before {
    content: '';
    position: absolute;
    left: 0.5rem;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--border);
  }

  .tl-item {
    position: relative;
    margin-bottom: 1rem;
  }

  .tl-node {
    position: absolute;
    left: -1.75rem;
    top: 0.75rem;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid;
    z-index: 1;
  }
  .tl-node-green {
    border-color: var(--bo-teal);
    background: rgba(45, 212, 191, 0.10);
  }
  .tl-node-red {
    border-color: var(--bo-rose);
    background: rgba(244, 114, 182, 0.08);
  }
  .tl-node-amber {
    border-color: var(--karma);
    background: rgba(251, 191, 36, 0.10);
  }
  .tl-node-violet {
    border-color: var(--accent-m);
    background: var(--accent-dim);
  }
  .tl-node-neutral {
    border-color: var(--border);
    background: var(--bg3);
  }

  .tl-content {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .tl-header {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 0.75rem 1rem;
    cursor: pointer;
    color: var(--text);
    font-family: var(--font-body);
    font-size: 0.875rem;
  }
  .tl-header:hover {
    background: rgba(139, 92, 246, 0.03);
  }

  .tl-header-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.35rem;
  }

  .tl-event-type {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    font-family: var(--font-mono);
    letter-spacing: 0.05em;
  }
  .tl-type-green { color: var(--bo-teal); }
  .tl-type-red { color: var(--bo-rose); }
  .tl-type-amber { color: var(--karma); }
  .tl-type-violet { color: var(--accent-m); }
  .tl-type-neutral { color: var(--text-muted); }

  .tl-pioneer-badge {
    display: inline-block;
    padding: 0.1rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    font-family: var(--font-mono);
    color: var(--accent-m);
    background: var(--accent-dim);
    border: 1px solid rgba(139, 92, 246, 0.25);
  }

  .tl-category {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .tl-date {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--bo-faint);
    font-family: var(--font-mono);
  }

  .tl-header-mid {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.35rem;
    flex-wrap: wrap;
  }

  .tl-transition {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .tl-arrow {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .tl-run-link {
    font-size: 0.8rem;
    color: var(--accent-m);
    text-decoration: none;
    font-weight: 500;
    font-family: var(--font-mono);
  }
  .tl-run-link:hover { text-decoration: underline; }

  .tl-header-bottom {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .tl-scores {
    display: flex;
    gap: 1rem;
  }
  .tl-score {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .tl-score-label {
    font-size: 0.65rem;
    color: var(--bo-faint);
    text-transform: uppercase;
    font-family: var(--font-mono);
    letter-spacing: 0.08em;
  }
  .tl-score-value {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text);
    font-family: var(--font-mono);
  }

  .tl-summary {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.4;
  }

  /* Expanded view */
  .tl-expanded {
    border-top: 1px solid var(--border);
    padding: 0.75rem 1rem;
    background: var(--bg3);
  }

  .tl-exp-section {
    margin-bottom: 0.75rem;
  }
  .tl-exp-section:last-child {
    margin-bottom: 0;
  }
  .tl-exp-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--bo-faint);
    font-family: var(--font-mono);
    margin: 0 0 0.35rem;
  }
  .tl-exp-text {
    font-size: 0.85rem;
    color: var(--text);
    margin: 0;
    line-height: 1.5;
  }

  .tl-judges {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .tl-judge {
    padding: 0.5rem 0.75rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 0.35rem;
  }
  .tl-judge-name {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text);
    font-family: var(--font-mono);
  }
  .tl-judge-weight {
    color: var(--bo-faint);
    font-weight: 400;
  }
  .tl-judge-text {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0.25rem 0 0;
    line-height: 1.4;
  }

  .tl-mutation-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 600;
    font-family: var(--font-mono);
    color: var(--accent-m);
    background: var(--accent-dim);
    border: 1px solid rgba(139, 92, 246, 0.2);
  }

  /* Load more */
  .tl-load-more {
    display: block;
    margin: 1rem auto 0;
    padding: 0.5rem 1.5rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font-body);
    transition: all 0.15s ease;
  }
  .tl-load-more:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent-m);
  }
  .tl-load-more:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Empty state */
  .tl-empty {
    padding: 2rem 1rem;
    text-align: center;
  }
  .tl-empty p {
    color: var(--text-muted);
    font-style: italic;
    margin: 0 0 0.75rem;
  }
  .tl-launch-link {
    display: inline-block;
    padding: 0.4rem 1rem;
    border-radius: 0.5rem;
    background: var(--accent);
    color: #fff;
    text-decoration: none;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .tl-launch-link:hover {
    background: var(--accent-m);
  }

  /* Skeleton */
  .tl-skeleton {
    padding-left: 2rem;
  }
  .tl-skeleton-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    margin-bottom: 1rem;
  }
  .tl-skeleton-node {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--border);
    flex-shrink: 0;
    margin-top: 0.25rem;
  }
  .tl-skeleton-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .tl-skeleton-line {
    height: 0.75rem;
    border-radius: 0.25rem;
    background: var(--border);
    animation: tl-pulse 1.5s ease-in-out infinite;
  }
  .tl-skeleton-short { width: 40%; }
  .tl-skeleton-long { width: 80%; }

  @keyframes tl-pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.6; }
  }
</style>
