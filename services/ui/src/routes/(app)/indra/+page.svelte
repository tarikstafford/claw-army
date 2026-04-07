<script lang="ts">
  import { onMount } from 'svelte';
  import { subscribeWS, type LiveEvent } from '$lib/ws';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let agents = $state<Array<Record<string, unknown>>>(data.agents ?? []);
  let activity = $state<Array<Record<string, unknown>>>(data.activity ?? []);
  let approvals = $state<Array<Record<string, unknown>>>(data.approvals ?? []);

  function greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function agentStatus(agent: Record<string, unknown>): string {
    const s = String(agent.status ?? 'idle');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function agentRole(agent: Record<string, unknown>): string {
    return String(agent.title ?? agent.role ?? 'Agent');
  }

  function agentTier(agent: Record<string, unknown>): string {
    const meta = agent.metadata as Record<string, unknown> | null;
    return String(meta?.tier ?? 'sonnet');
  }

  function formatTimestamp(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function handleApprove(id: string) {
    try {
      await fetch(`/api/approvals/${id}/approve`, { method: 'POST' });
      approvals = approvals.filter((a) => a.id !== id);
    } catch { /* non-critical */ }
  }

  async function handleDismiss(id: string) {
    try {
      await fetch(`/api/approvals/${id}/dismiss`, { method: 'POST' });
      approvals = approvals.filter((a) => a.id !== id);
    } catch { /* non-critical */ }
  }

  onMount(() => {
    const unsub = subscribeWS((event: LiveEvent) => {
      if (event.type === 'agent.status.changed' || event.type === 'agent.updated') {
        const newEvent = {
          id: String(event.id),
          type: event.type,
          description: 'Agent status updated',
          createdAt: event.createdAt,
          agentId: (event.payload as Record<string, unknown>)?.agentId ?? null,
        };
        activity = [newEvent, ...activity].slice(0, 50);
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
    });
    return unsub;
  });
</script>

<div class="indra-page">
  <!-- Greeting -->
  <header class="greeting">
    <span class="greeting-gem" aria-hidden="true">&#9671;</span>
    <div class="greeting-text">
      <h1 class="greeting-hello">{greeting()}, {data.userName}.</h1>
      <p class="greeting-sub">
        {#if agents.length > 0}
          Your crew of {agents.length} is ready. Here's where things stand.
        {:else}
          Welcome to Akasa. Your crew will appear here once assembled.
        {/if}
      </p>
    </div>
  </header>

  <!-- Crew -->
  {#if agents.length > 0}
    <section class="section" aria-label="Your crew">
      <h2 class="section-label">YOUR CREW</h2>
      <div class="crew-grid">
        {#each agents as agent (agent.id)}
          <div class="crew-card">
            <div class="crew-header">
              <span class="crew-name">{agent.name}</span>
              <span class="tier-dot tier-{agentTier(agent)}" title={agentTier(agent)}></span>
            </div>
            <span class="crew-role">{agentRole(agent)}</span>
            <span class="crew-status status-{String(agent.status ?? 'idle')}">
              {agentStatus(agent)}
            </span>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Pending approvals -->
  {#if approvals.length > 0}
    <section class="section" aria-label="Pending approvals">
      <h2 class="section-label">PENDING APPROVALS</h2>
      <div class="approvals-list">
        {#each approvals as approval (approval.id)}
          <div class="approval-card">
            <div class="approval-info">
              <p class="approval-desc">
                {(approval.payload as Record<string, unknown>)?.description ?? approval.type}
              </p>
              {#if (approval.payload as Record<string, unknown>)?.agentName}
                <span class="approval-agent">{String((approval.payload as Record<string, unknown>).agentName)}</span>
              {/if}
            </div>
            <div class="approval-actions">
              <button class="btn-approve" onclick={() => handleApprove(String(approval.id))}>Approve</button>
              <button class="btn-dismiss" onclick={() => handleDismiss(String(approval.id))}>Dismiss</button>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Quick actions -->
  <section class="section" aria-label="Quick actions">
    <h2 class="section-label">QUICK ACTIONS</h2>
    <div class="actions-row">
      <a href="/chat" class="action-card">
        <span class="action-icon">&#9654;</span>
        <div>
          <span class="action-title">Talk to Indra</span>
          <span class="action-desc">Give your crew a task or ask a question</span>
        </div>
      </a>
      <a href="/office/agents" class="action-card">
        <span class="action-icon">&#9670;</span>
        <div>
          <span class="action-title">View Office</span>
          <span class="action-desc">See your agents, issues, and projects</span>
        </div>
      </a>
    </div>
  </section>

  <!-- Activity -->
  <section class="section" aria-label="Recent activity">
    <h2 class="section-label">ACTIVITY</h2>
    {#if activity.length === 0}
      <p class="empty-state">No activity yet. Your crew's work will appear here as they execute tasks.</p>
    {:else}
      <ul class="activity-list">
        {#each activity as event (event.id)}
          <li class="activity-item">
            <time class="activity-time" datetime={String(event.createdAt)}>
              {formatTimestamp(String(event.createdAt))}
            </time>
            <span class="activity-desc">{event.description ?? event.type}</span>
            {#if event.agentId}
              <span class="activity-agent">· {String(event.agentId).slice(0, 8)}</span>
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
    max-width: 720px;
    margin: 0 auto;
    padding: 0 24px;
  }

  /* ── Greeting ─────────────────────────────── */
  .greeting {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 40px 0 28px;
  }

  .greeting-gem {
    color: var(--accent);
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .greeting-hello {
    font-family: var(--font-display);
    font-size: clamp(22px, 3vw, 30px);
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.01em;
    line-height: 1.15;
    margin: 0;
  }

  .greeting-sub {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text-muted);
    margin: 6px 0 0;
    line-height: 1.5;
  }

  /* ── Sections ─────────────────────────────── */
  .section {
    padding: 20px 0;
  }

  .section-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.12em;
    color: var(--text-muted);
    margin: 0 0 14px;
    text-transform: uppercase;
  }

  /* ── Crew grid ────────────────────────────── */
  .crew-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }

  .crew-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: border-color 0.2s, transform 0.15s;
  }

  .crew-card:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }

  .crew-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .crew-name {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.01em;
  }

  .tier-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tier-haiku { background: var(--tier-junior); }
  .tier-sonnet { background: var(--tier-mid); }
  .tier-opus { background: var(--tier-senior); }

  .crew-role {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
  }

  .crew-status {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    margin-top: 4px;
  }

  .status-idle { color: var(--text-muted); }
  .status-working, .status-active { color: var(--success); }
  .status-complete, .status-done { color: var(--karma); }
  .status-paused { color: var(--rose); }

  /* ── Approvals ────────────────────────────── */
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

  .approval-info { flex: 1; min-width: 0; }

  .approval-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    margin: 0;
  }

  .approval-agent {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
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

  /* ── Quick actions ────────────────────────── */
  .actions-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .action-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    text-decoration: none;
    transition: border-color 0.2s, transform 0.15s;
  }

  .action-card:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }

  .action-icon {
    font-size: 14px;
    color: var(--accent);
    flex-shrink: 0;
    margin-top: 1px;
  }

  .action-title {
    display: block;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
  }

  .action-desc {
    display: block;
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  /* ── Activity ─────────────────────────────── */
  .activity-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .activity-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .activity-time {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    flex-shrink: 0;
  }

  .activity-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
  }

  .activity-agent {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }

  .empty-state {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    font-style: italic;
  }

  @media (max-width: 480px) {
    .actions-row { grid-template-columns: 1fr; }
    .crew-grid { grid-template-columns: repeat(2, 1fr); }
  }
</style>
