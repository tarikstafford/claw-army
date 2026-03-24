<script lang="ts">
  import { onMount } from 'svelte';
  import MetricTile from '$lib/components/MetricTile.svelte';
  import { subscribeWS, type LiveEvent } from '$lib/ws';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Reactive dashboard state — updates via WebSocket
  let dashboard = $state(data.dashboard);
  let activity = $state<typeof data.activity>(data.activity ?? []);
  let approvals = $state<typeof data.approvals>(data.approvals ?? []);

  // Derived fleet counts
  let idleCount = $derived(
    dashboard ? (dashboard.idleAgents ?? dashboard.totalAgents ?? '—') : '—'
  );
  let workingCount = $derived(
    dashboard ? (dashboard.activeAgents ?? '—') : '—'
  );
  let completeCount = $derived(
    dashboard ? (dashboard.completedAgents ?? '—') : '—'
  );
  let karma = $derived(
    dashboard ? (dashboard.totalKarma ?? dashboard.karma ?? '—') : '—'
  );
  let dailyCost = $derived(
    dashboard && dashboard.dailyCostCents != null
      ? formatCents(dashboard.dailyCostCents)
      : '—'
  );

  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatTimestamp(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function handleApprove(id: string) {
    try {
      await fetch(`/api/approvals/${id}/approve`, { method: 'POST' });
      approvals = approvals.filter((a: { id: string }) => a.id !== id);
    } catch {
      // non-critical — approval action failed silently
    }
  }

  async function handleDismiss(id: string) {
    try {
      await fetch(`/api/approvals/${id}/dismiss`, { method: 'POST' });
      approvals = approvals.filter((a: { id: string }) => a.id !== id);
    } catch {
      // non-critical — dismiss action failed silently
    }
  }

  onMount(() => {
    const unsub = subscribeWS((event: LiveEvent) => {
      if (event.type === 'agent.status.changed' || event.type === 'agent.updated') {
        // Update reactive fleet counts from event payload
        if (dashboard && event.payload) {
          const payload = event.payload as Record<string, unknown>;
          if (payload.status === 'idle') {
            dashboard = { ...dashboard, idleAgents: (dashboard.idleAgents ?? 0) + 1 };
          } else if (payload.status === 'working' || payload.status === 'active') {
            dashboard = { ...dashboard, activeAgents: (dashboard.activeAgents ?? 0) + 1 };
          } else if (payload.status === 'complete' || payload.status === 'done') {
            dashboard = { ...dashboard, completedAgents: (dashboard.completedAgents ?? 0) + 1 };
          }
        }
        // Append to activity feed
        const newEvent = {
          id: String(event.id),
          type: event.type,
          description: `Agent status updated`,
          createdAt: event.createdAt,
          agentId: event.payload?.agentId as string | null ?? null,
        };
        activity = [newEvent, ...activity].slice(0, 50);
      }

      if (event.type === 'approval.required') {
        // Reload approvals list on new approval event
        const newApproval = {
          id: String(event.id),
          companyId: event.companyId,
          type: event.type,
          status: 'pending',
          payload: event.payload,
          createdAt: event.createdAt,
          updatedAt: event.createdAt,
        };
        approvals = [...approvals, newApproval];
      }
    });

    return unsub;
  });
</script>

<div class="indra-page">
  <!-- INDRA identity bar -->
  <div class="indra-identity">
    <span class="indra-gem" aria-hidden="true">&#9830;</span>
    <span class="indra-wordmark">INDRA</span>
  </div>

  <!-- Fleet stats grid -->
  <section class="section stats-section" aria-label="Fleet statistics">
    <div class="metric-grid">
      <MetricTile label="IDLE" value={String(idleCount)} sub="agents" />
      <MetricTile label="WORKING" value={String(workingCount)} sub="agents" />
      <MetricTile label="DONE" value={String(completeCount)} sub="agents" />
      <MetricTile label="KARMA" value={String(karma)} />
      <MetricTile label="DAILY COST" value={String(dailyCost)} />
    </div>
  </section>

  <!-- Pending approvals -->
  {#if approvals.length > 0}
    <section class="section approvals-section" aria-label="Pending approvals">
      <h2 class="section-heading">Pending approvals</h2>
      <ul class="approvals-list">
        {#each approvals as approval (approval.id)}
          <li class="approval-card">
            <div class="approval-info">
              <p class="approval-description">
                {approval.payload?.description ?? approval.type}
              </p>
              {#if approval.payload?.agentName}
                <span class="approval-agent">{String(approval.payload.agentName)}</span>
              {/if}
            </div>
            <div class="approval-actions">
              <button
                class="btn-approve"
                onclick={() => handleApprove(approval.id)}
              >Approve</button>
              <button
                class="btn-dismiss"
                onclick={() => handleDismiss(approval.id)}
              >Dismiss</button>
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- Activity feed -->
  <section class="section activity-section" aria-label="Recent activity">
    <h2 class="section-heading">Recent activity</h2>
    {#if activity.length === 0}
      <p class="empty-state">No recent activity. Your crew's work will appear here.</p>
    {:else}
      <ul class="activity-list">
        {#each activity as event (event.id)}
          <li class="activity-item">
            <time class="activity-time" datetime={event.createdAt}>
              {formatTimestamp(event.createdAt)}
            </time>
            <span class="activity-desc">
              {event.description ?? event.type}
            </span>
            {#if event.agentId}
              <span class="activity-agent">· agent {String(event.agentId).slice(0, 8)}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  .indra-page {
    width: 100%;
  }

  /* ── INDRA identity bar ──────────────────────────────── */
  .indra-identity {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-xl) var(--space-2xl);
    margin-bottom: var(--space-xl);
  }

  .indra-gem {
    color: var(--fo-plum);
    font-size: 18px;
    line-height: 1;
  }

  .indra-wordmark {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--fo-plum);
    letter-spacing: 0.08em;
    line-height: 1.2;
  }

  :global(body.back-office) .indra-gem,
  :global(body.back-office) .indra-wordmark {
    color: var(--bo-violet);
  }

  /* ── Section layout ─────────────────────────────────── */
  .section {
    padding: 28px 40px;
  }

  .section-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.2;
    margin: 0 0 var(--space-lg) 0;
  }

  :global(body.back-office) .section-heading {
    color: var(--bo-text);
  }

  /* ── Metric grid ─────────────────────────────────────── */
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: var(--space-md);
  }

  /* ── Approvals ──────────────────────────────────────── */
  .approvals-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .approval-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: 14px 16px;
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
  }

  :global(body.back-office) .approval-card {
    background: var(--bo-card);
    border-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .approval-info {
    flex: 1;
    min-width: 0;
  }

  .approval-description {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink);
    margin: 0 0 2px 0;
    line-height: 1.5;
  }

  :global(body.back-office) .approval-description {
    color: var(--bo-text);
  }

  .approval-agent {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
    font-style: italic;
  }

  .approval-actions {
    display: flex;
    gap: var(--space-sm);
    flex-shrink: 0;
  }

  .btn-approve {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: var(--fo-plum);
    border: none;
    border-radius: var(--radius-md);
    padding: 6px 14px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-approve:hover {
    background: var(--fo-plum-m);
  }

  :global(body.back-office) .btn-approve {
    background: var(--bo-violet);
  }

  :global(body.back-office) .btn-approve:hover {
    background: var(--bo-vb);
  }

  .btn-dismiss {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    color: var(--muted);
    background: transparent;
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    padding: 6px 14px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .btn-dismiss:hover {
    color: var(--ink);
    border-color: var(--fo-plum-p);
  }

  :global(body.back-office) .btn-dismiss {
    border-color: var(--bo-border, rgba(124, 58, 237, 0.20));
  }

  /* ── Activity feed ──────────────────────────────────── */
  .activity-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .activity-item {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
  }

  .activity-time {
    font-family: var(--font-body);
    font-size: 11px;
    font-style: italic;
    color: var(--muted);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .activity-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink);
    line-height: 1.5;
  }

  :global(body.back-office) .activity-desc {
    color: var(--bo-text);
  }

  .activity-agent {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
    font-style: italic;
  }

  .empty-state {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0;
    line-height: 1.5;
  }
</style>
