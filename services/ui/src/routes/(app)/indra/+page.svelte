<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { subscribeWS, type LiveEvent } from '$lib/ws';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let agents = $state<Array<Record<string, unknown>>>(data.agents ?? []);
  let goals = $state<Array<Record<string, unknown>>>(data.goals ?? []);
  let activity = $state<Array<Record<string, unknown>>>(data.activity ?? []);
  let approvals = $state<Array<Record<string, unknown>>>(data.approvals ?? []);

  // ── New Goal form state ─────────────────────────────────────────
  let showGoalForm = $state(false);
  let goalName = $state('');
  let goalDescription = $state('');
  let goalBudget = $state('');
  let goalSubmitting = $state(false);
  let goalError = $state('');

  // ── Helpers ─────────────────────────────────────────────────────
  function greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function agentInitial(agent: Record<string, unknown>): string {
    const name = String(agent.name ?? '?');
    return name.charAt(0).toUpperCase();
  }

  function agentStatus(agent: Record<string, unknown>): string {
    const s = String(agent.status ?? 'idle');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function agentStatusKey(agent: Record<string, unknown>): string {
    return String(agent.status ?? 'idle').toLowerCase();
  }

  function agentClassTier(agent: Record<string, unknown>): string {
    const cls = agent.agentClass as string | undefined;
    if (cls) return cls;
    const meta = agent.metadata as Record<string, unknown> | null;
    return String(meta?.agentClass ?? meta?.tier ?? 'novice');
  }

  function goalStatus(goal: Record<string, unknown>): string {
    return String(goal.status ?? 'active');
  }

  function goalProgress(goal: Record<string, unknown>): number {
    const meta = (goal.metadata ?? goal) as Record<string, unknown>;
    if (typeof meta.progress === 'number') return Math.min(100, Math.max(0, meta.progress));
    if (typeof meta.progressPercent === 'number') return Math.min(100, Math.max(0, meta.progressPercent));
    const status = goalStatus(goal);
    if (status === 'completed' || status === 'done') return 100;
    return 0;
  }

  function goalBudgetDisplay(goal: Record<string, unknown>): { spent: string; cap: string } | null {
    const meta = (goal.metadata ?? goal) as Record<string, unknown>;
    const spentCents = typeof meta.spentCents === 'number' ? meta.spentCents : null;
    const capCents = typeof meta.budgetCapCents === 'number' ? meta.budgetCapCents : null;
    if (spentCents == null && capCents == null) return null;
    return {
      spent: spentCents != null ? '$' + (spentCents / 100).toFixed(2) : '$0.00',
      cap: capCents != null ? '$' + (capCents / 100).toFixed(2) : '--',
    };
  }

  const MAX_ACTIVITY = 8;
  let recentActivity = $derived(activity.slice(0, MAX_ACTIVITY));
  let hasMoreActivity = $derived(activity.length > MAX_ACTIVITY);

  function activityIcon(event: Record<string, unknown>): string {
    const type = String(event.type ?? event.action ?? '');
    if (type.includes('goal')) return '\u25C7';
    if (type.includes('agent') || type.includes('bot')) return '\u25C6';
    if (type.includes('promot') || type.includes('class')) return '\u2605';
    if (type.includes('task') || type.includes('complet')) return '\u2713';
    if (type.includes('run') || type.includes('heartbeat')) return '\u25B6';
    return '\u25CB';
  }

  function activityLabel(event: Record<string, unknown>): string {
    const action = String(event.action ?? event.type ?? '');
    const entity = String(event.entityType ?? '');
    const details = (event.details ?? event.payload ?? {}) as Record<string, unknown>;
    const name = details.name ?? details.agentName ?? details.title ?? null;

    if (event.description && String(event.description).length > 5) return String(event.description);
    if (details.description && String(details.description).length > 5) return String(details.description);

    const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
    const entityLabel = entity.replace(/_/g, ' ');
    const suffix = name ? ': ' + name : '';

    if (entity && action) return actionLabel + ' ' + entityLabel + suffix;
    if (action) return actionLabel + suffix;
    return String(event.type ?? 'Activity');
  }

  function formatTimestamp(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return diffMin + 'm ago';
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return diffHrs + 'h ago';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // ── Actions ─────────────────────────────────────────────────────
  async function handleApprove(id: string) {
    try {
      await fetch('/api/approvals/' + id + '/approve', { method: 'POST' });
      approvals = approvals.filter((a) => a.id !== id);
    } catch { /* non-critical */ }
  }

  async function handleDismiss(id: string) {
    try {
      await fetch('/api/approvals/' + id + '/dismiss', { method: 'POST' });
      approvals = approvals.filter((a) => a.id !== id);
    } catch { /* non-critical */ }
  }

  function approvalTitle(approval: Record<string, unknown>): string {
    const type = String(approval.type ?? '');
    const payload = (approval.payload ?? {}) as Record<string, unknown>;
    const agentName = payload.name ?? payload.agentName ?? '';
    const budgetCents = typeof payload.budgetMonthlyCents === 'number' ? payload.budgetMonthlyCents : null;
    switch (type) {
      case 'hire_agent':
        return agentName ? 'Hire new agent: ' + agentName : 'Hire a new agent';
      case 'budget_override':
      case 'budget_override_required':
        return budgetCents != null
          ? 'Budget override — $' + (budgetCents / 100).toFixed(0) + '/mo requested'
          : 'Budget override requested';
      case 'tool_access':
        return payload.toolName ? 'Grant tool access: ' + payload.toolName : 'Tool access request';
      case 'execution_approval':
        return payload.objectiveName ? 'Run: ' + payload.objectiveName : 'Execution approval';
      default:
        return (payload.description as string) ?? type.replace(/_/g, ' ');
    }
  }

  async function submitGoal() {
    if (!goalName.trim()) {
      goalError = 'Goal name is required';
      return;
    }
    goalSubmitting = true;
    goalError = '';
    try {
      const body: Record<string, unknown> = { title: goalName.trim() };
      if (goalDescription.trim()) body.description = goalDescription.trim();
      if (goalBudget.trim()) {
        const cents = Math.round(parseFloat(goalBudget) * 100);
        if (!isNaN(cents) && cents > 0) body.budgetCapCents = cents;
      }
      const res = await fetch('/api/companies/' + data.companyId + '/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create goal');
      const newGoal = await res.json();
      goals = [newGoal, ...goals];
      showGoalForm = false;
      goalName = '';
      goalDescription = '';
      goalBudget = '';
    } catch (err) {
      goalError = (err as Error).message;
    } finally {
      goalSubmitting = false;
    }
  }

  // ── Real-time updates ───────────────────────────────────────────
  onMount(() => {
    const unsub = subscribeWS((event: LiveEvent) => {
      if (event.type === 'agent.status.changed' || event.type === 'agent.updated') {
        const payload = event.payload as Record<string, unknown>;
        const agentId = payload.agentId as string | undefined;
        if (agentId) {
          agents = agents.map((a) =>
            a.id === agentId ? { ...a, status: payload.status ?? a.status } : a,
          );
        }
        activity = [{
          id: String(event.id),
          type: event.type,
          description: 'Agent ' + (payload.agentName ?? agentId?.slice(0, 8) ?? '') + ' status updated',
          createdAt: event.createdAt,
          agentId: agentId ?? null,
        }, ...activity].slice(0, 50);
      }
      if (event.type === 'goal.updated' || event.type === 'goal.progress') {
        const payload = event.payload as Record<string, unknown>;
        const goalId = payload.goalId as string | undefined;
        if (goalId) {
          goals = goals.map((g) =>
            g.id === goalId ? { ...g, ...payload } : g,
          );
        }
        activity = [{
          id: String(event.id),
          type: event.type,
          description: 'Goal progress updated',
          createdAt: event.createdAt,
        }, ...activity].slice(0, 50);
      }
      if (event.type === 'approval.required') {
        approvals = [...approvals, {
          id: String(event.id),
          companyId: event.companyId,
          type: event.type,
          status: 'pending',
          payload: event.payload,
          createdAt: event.createdAt,
          updatedAt: event.createdAt,
        }];
      }
      if (event.type === 'heartbeat.run.status') {
        const payload = event.payload as Record<string, unknown>;
        const status = String(payload.status ?? '');
        const runId = String(payload.runId ?? '');
        activity = [{
          id: String(event.id),
          type: event.type,
          description: runId ? 'Run ' + status + ' (' + runId.slice(0, 8) + ')' : 'Run ' + status,
          createdAt: event.createdAt,
          agentId: (payload.agentId as string | undefined) ?? null,
        }, ...activity].slice(0, 50);
      }
      if (event.type === 'evolution.class_transition') {
        const payload = event.payload as Record<string, unknown>;
        activity = [{
          id: String(event.id),
          type: event.type,
          description: 'Agent promoted: ' + (payload.fromClass ?? '?') + ' -> ' + (payload.toClass ?? '?'),
          createdAt: event.createdAt,
          agentId: (payload.botId as string | undefined) ?? null,
        }, ...activity].slice(0, 50);
      }
    });
    return unsub;
  });
</script>

<div class="home">
  <!-- Greeting + Quick Actions -->
  <header class="greeting">
    <h1 class="greeting-hello">{greeting()}, {data.userName}.</h1>
    <p class="greeting-sub">
      {#if agents.length > 0}
        Your crew of {agents.length} is ready. Here's where things stand.
      {:else}
        Welcome to Akasa. Set your first goal to get started.
      {/if}
    </p>
  </header>

  <section class="quick-actions" aria-label="Quick actions">
    <button class="qa-btn qa-primary" onclick={() => { showGoalForm = true; }}>
      <span class="qa-icon">+</span>
      New Goal
    </button>
    <button class="qa-btn" onclick={() => goto('/chat')}>
      <span class="qa-icon">&#9654;</span>
      Chat with Indra
    </button>
    <button class="qa-btn" onclick={() => goto('/team/new')}>
      <span class="qa-icon">&#9670;</span>
      Add Agent
    </button>
  </section>

  <!-- Section 1: Team Status -->
  {#if agents.length > 0}
    <section class="section" aria-label="Team status">
      <h2 class="section-label">TEAM STATUS</h2>
      <div class="team-row">
        {#each agents as agent (agent.id)}
          <div class="agent-card">
            <div class="agent-avatar" class:avatar-working={agentStatusKey(agent) === 'working' || agentStatusKey(agent) === 'active'}>
              <span class="avatar-letter">{agentInitial(agent)}</span>
              <span class="status-indicator status-indicator-{agentStatusKey(agent)}"></span>
            </div>
            <span class="agent-name">{agent.name}</span>
            <div class="agent-meta">
              <span class="agent-status-text">{agentStatus(agent)}</span>
              <span class="agent-class">{agentClassTier(agent)}</span>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Pending Approvals -->
  {#if approvals.length > 0}
    <section class="section" aria-label="Pending approvals">
      <h2 class="section-label">PENDING APPROVALS</h2>
      <div class="approvals-list">
        {#each approvals as approval (approval.id)}
          <div class="approval-card">
            <span class="approval-desc">{approvalTitle(approval)}</span>
            <div class="approval-actions">
              <button class="btn-approve" onclick={() => handleApprove(String(approval.id))}>Approve</button>
              <button class="btn-dismiss" onclick={() => handleDismiss(String(approval.id))}>Dismiss</button>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Section 2: Active Goals -->
  <section class="section" aria-label="Active goals">
    <div class="section-header">
      <h2 class="section-label">ACTIVE GOALS</h2>
      <button class="section-action" onclick={() => { showGoalForm = true; }}>+ New Goal</button>
    </div>

    {#if showGoalForm}
      <div class="goal-form-card">
        <div class="goal-form">
          <label class="form-label">
            Name
            <input
              class="form-input"
              type="text"
              placeholder="e.g. Launch email campaign"
              bind:value={goalName}
              onkeydown={(e) => { if (e.key === 'Enter') submitGoal(); }}
            />
          </label>
          <label class="form-label">
            Target description
            <textarea
              class="form-textarea"
              placeholder="What does success look like?"
              rows="2"
              bind:value={goalDescription}
            ></textarea>
          </label>
          <label class="form-label">
            Budget cap (optional)
            <div class="form-budget-row">
              <span class="budget-prefix">$</span>
              <input
                class="form-input form-budget"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                bind:value={goalBudget}
              />
            </div>
          </label>
          {#if goalError}
            <p class="form-error">{goalError}</p>
          {/if}
          <div class="form-actions">
            <button class="btn-create" onclick={submitGoal} disabled={goalSubmitting}>
              {goalSubmitting ? 'Creating...' : 'Create Goal'}
            </button>
            <button class="btn-cancel" onclick={() => { showGoalForm = false; goalError = ''; }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if goals.length === 0 && !showGoalForm}
      <p class="empty-state">No active goals yet. Create one to put your crew to work.</p>
    {:else}
      <div class="goals-grid">
        {#each goals as goal (goal.id)}
          <div class="goal-card">
            <div class="goal-top">
              <span class="goal-name">{goal.title ?? goal.name}</span>
              <span class="goal-status status-tag-{goalStatus(goal)}">{goalStatus(goal)}</span>
            </div>
            {#if goal.description}
              <p class="goal-desc">{goal.description}</p>
            {/if}
            <div class="goal-progress-track">
              <div class="goal-progress-fill" style="width: {goalProgress(goal)}%"></div>
            </div>
            <div class="goal-meta">
              <span class="goal-percent">{goalProgress(goal)}%</span>
              {#if goalBudgetDisplay(goal)}
                <span class="goal-budget">{goalBudgetDisplay(goal)?.spent} / {goalBudgetDisplay(goal)?.cap}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <!-- Section 3: Activity Feed -->
  <section class="section" aria-label="Activity feed">
    <h2 class="section-label">ACTIVITY</h2>
    {#if activity.length === 0}
      <p class="empty-state">No activity yet. Your crew's work will appear here as they execute tasks.</p>
    {:else}
      <ul class="activity-list">
        {#each recentActivity as event (event.id)}
          <li class="activity-item">
            <span class="activity-icon">{activityIcon(event)}</span>
            <span class="activity-desc">{activityLabel(event)}</span>
            <time class="activity-time" datetime={String(event.createdAt)}>
              {formatTimestamp(String(event.createdAt))}
            </time>
          </li>
        {/each}
      </ul>
      {#if hasMoreActivity}
        <a href="/office/issues" class="view-all">View all activity &#8594;</a>
      {/if}
    {/if}
  </section>
</div>

<style>
  .home {
    width: 100%;
    max-width: 840px;
    margin: 0 auto;
    padding: 0 24px 60px;
  }

  .greeting {
    padding: 40px 0 24px;
  }

  .greeting-hello {
    font-family: var(--font-display);
    font-size: clamp(24px, 3.5vw, 36px);
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 0;
  }

  .greeting-sub {
    font-family: var(--font-body);
    font-size: 15px;
    color: var(--text-muted);
    margin: 8px 0 0;
    line-height: 1.5;
  }

  .quick-actions {
    display: flex;
    gap: 10px;
    padding-bottom: 32px;
    flex-wrap: wrap;
  }

  .qa-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: border-color 0.2s, transform 0.15s, background 0.2s;
  }

  .qa-btn:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }

  .qa-primary {
    background: var(--fo-plum);
    color: #fff;
    border-color: var(--fo-plum);
  }

  .qa-primary:hover {
    background: var(--fo-plum-m);
    border-color: var(--fo-plum-m);
  }

  .qa-icon {
    font-size: 12px;
    flex-shrink: 0;
  }

  .section {
    padding: 20px 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .section-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.12em;
    color: var(--text-muted);
    margin: 0 0 14px;
    text-transform: uppercase;
  }

  .section-header .section-label {
    margin-bottom: 0;
  }

  .section-action {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 500;
    color: var(--accent-m);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: opacity 0.15s;
  }

  .section-action:hover {
    opacity: 0.7;
  }

  .team-row {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: thin;
    scrollbar-color: var(--fo-bg3) transparent;
  }

  .team-row::-webkit-scrollbar {
    height: 4px;
  }

  .team-row::-webkit-scrollbar-track {
    background: transparent;
  }

  .team-row::-webkit-scrollbar-thumb {
    background: var(--fo-bg3);
    border-radius: 2px;
  }

  .agent-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 88px;
    padding: 14px 12px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    transition: border-color 0.2s, transform 0.15s;
    flex-shrink: 0;
  }

  .agent-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
  }

  .agent-avatar {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--fo-plum-p);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .agent-avatar.avatar-working {
    background: var(--fo-plum);
  }

  .agent-avatar.avatar-working .avatar-letter {
    color: #fff;
  }

  .avatar-letter {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    color: var(--fo-plum);
    line-height: 1;
  }

  .status-indicator {
    position: absolute;
    bottom: 1px;
    right: 1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--card);
  }

  .status-indicator-working,
  .status-indicator-active {
    background: var(--success);
  }

  .status-indicator-idle {
    background: var(--text-muted);
  }

  .status-indicator-paused {
    background: var(--rose);
  }

  .status-indicator-complete,
  .status-indicator-done {
    background: var(--karma);
  }

  .agent-name {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 80px;
  }

  .agent-meta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .agent-status-text {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--text-muted);
    text-transform: capitalize;
  }

  .agent-class {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--karma);
    background: var(--fo-gold-p);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }

  .goals-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }

  .goal-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color 0.2s, transform 0.15s;
  }

  .goal-card:hover {
    border-color: var(--karma);
    transform: translateY(-1px);
  }

  .goal-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .goal-name {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  .goal-status {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    padding: 3px 6px;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }

  .status-tag-active { color: var(--success); background: rgba(5, 150, 105, 0.08); }
  .status-tag-completed, .status-tag-done { color: var(--karma); background: rgba(184, 150, 90, 0.10); }
  .status-tag-paused { color: var(--rose); background: rgba(219, 39, 119, 0.08); }

  .goal-desc {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.4;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .goal-progress-track {
    width: 100%;
    height: 4px;
    background: var(--fo-bg2);
    border-radius: 2px;
    overflow: hidden;
  }

  .goal-progress-fill {
    height: 100%;
    background: var(--karma);
    border-radius: 2px;
    transition: width 0.4s ease;
  }

  .goal-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .goal-percent {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 500;
    color: var(--karma);
  }

  .goal-budget {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }

  .goal-form-card {
    background: var(--card);
    border: 1px solid var(--karma);
    border-radius: var(--radius-md);
    padding: 20px;
    margin-bottom: 16px;
  }

  .goal-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .form-label {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-input,
  .form-textarea {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    outline: none;
    transition: border-color 0.2s;
    resize: vertical;
  }

  .form-input:focus,
  .form-textarea:focus {
    border-color: var(--karma);
  }

  .form-budget-row {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .budget-prefix {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text-muted);
    background: var(--fo-bg2);
    border: 1px solid var(--border);
    border-right: none;
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    padding: 10px 10px;
    line-height: 1;
  }

  .form-budget {
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    flex: 1;
  }

  .form-error {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--error);
    margin: 0;
  }

  .form-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .btn-create {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    background: var(--fo-plum);
    border: none;
    border-radius: var(--radius-md);
    padding: 8px 18px;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-create:hover { opacity: 0.85; }
  .btn-create:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-cancel {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 8px 18px;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .btn-cancel:hover { border-color: var(--accent); }

  .approvals-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .approval-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 12px 16px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .approval-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    flex: 1;
    min-width: 0;
  }

  .approval-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn-approve {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 500;
    color: #fff;
    background: var(--accent);
    border: none;
    border-radius: var(--radius-md);
    padding: 6px 14px;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-approve:hover { opacity: 0.85; }

  .btn-dismiss {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 6px 14px;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .btn-dismiss:hover { border-color: var(--accent); }

  .activity-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .activity-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    transition: border-color 0.15s;
  }

  .activity-item:hover {
    border-color: var(--fo-bg3);
  }

  .activity-icon {
    font-size: 10px;
    color: var(--karma);
    flex-shrink: 0;
    width: 16px;
    text-align: center;
  }

  .activity-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .activity-time {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .view-all {
    display: inline-block;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--accent-m);
    text-decoration: none;
    margin-top: 10px;
    transition: opacity 0.15s;
  }

  .view-all:hover { opacity: 0.7; }

  .empty-state {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    font-style: italic;
  }

  @media (max-width: 768px) {
    .home {
      padding: 0 16px 40px;
    }

    .greeting {
      padding: 24px 0 16px;
    }

    .greeting-hello {
      font-size: 22px;
    }

    .quick-actions {
      gap: 8px;
      padding-bottom: 20px;
    }

    .qa-btn {
      padding: 8px 14px;
      font-size: 12px;
    }

    .goals-grid {
      grid-template-columns: 1fr;
    }

    .team-row {
      gap: 10px;
    }

    .agent-card {
      min-width: 76px;
      padding: 10px 8px;
    }

    .agent-avatar {
      width: 38px;
      height: 38px;
    }

    .avatar-letter {
      font-size: 17px;
    }

    .approval-card {
      flex-direction: column;
      align-items: flex-start;
    }

    .approval-actions {
      width: 100%;
      margin-top: 8px;
    }

    .btn-approve,
    .btn-dismiss {
      flex: 1;
    }

    .section {
      padding: 16px 0;
    }
  }

  @media (max-width: 480px) {
    .home {
      padding: 0 12px 32px;
    }

    .greeting {
      padding: 20px 0 12px;
    }

    .greeting-hello {
      font-size: 20px;
    }

    .quick-actions {
      flex-direction: column;
    }

    .agent-card {
      min-width: 68px;
      padding: 8px 6px;
    }

    .agent-avatar {
      width: 34px;
      height: 34px;
    }

    .avatar-letter {
      font-size: 15px;
    }

    .section-label {
      font-size: 5px;
    }
  }
</style>
