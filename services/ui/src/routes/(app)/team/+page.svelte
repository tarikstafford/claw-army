<script lang="ts">
  import type { PageData } from './$types';
  import type { Agent } from '$lib/api';

  let { data }: { data: PageData } = $props();

  type ClassFilter = 'all' | 'Novice' | 'Understudy' | 'Artisan';
  let activeFilter = $state<ClassFilter>('all');

  const CLASS_FILTERS: { value: ClassFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'Novice', label: 'Novice' },
    { value: 'Understudy', label: 'Understudy' },
    { value: 'Artisan', label: 'Artisan' },
  ];

  const filteredAgents = $derived.by(() => {
    const agents = data.agents as Agent[];
    if (activeFilter === 'all') return agents;
    return agents.filter((a) => (a.agentClass ?? 'Novice') === activeFilter);
  });

  function getStatusColor(status: string | null | undefined): string {
    return status === 'working' ? '#22c55e' : '#9ca3af';
  }

  function getStatusLabel(status: string | null | undefined): string {
    return status === 'working' ? 'Working' : 'Idle';
  }

  function getClassColor(cls: string | null | undefined): string {
    switch (cls) {
      case 'Understudy': return '#8B5CF6';
      case 'Artisan': return '#F59E0B';
      default: return '#3B82F6';
    }
  }

  function getInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  function getAdapterLabel(adapter: string | null | undefined): string {
    if (!adapter) return '';
    const labels: Record<string, string> = {
      claude: 'Claude',
      codex: 'Codex',
      gemini: 'Gemini',
      openclaw: 'OpenClaw',
    };
    return labels[adapter] ?? adapter;
  }
</script>

<div class="team-page">
  <div class="page-header">
    <div class="header-left">
      <h1 class="page-title">Team</h1>
      <p class="page-subtitle">{data.agents.length} agent{data.agents.length === 1 ? '' : 's'}</p>
    </div>
    <a href="/team/new" class="btn-primary">Add agent</a>
  </div>

  {#if data.agents.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="var(--border)" stroke-width="2" stroke-dasharray="6 4"/>
          <circle cx="24" cy="20" r="6" stroke="var(--text-muted)" stroke-width="1.5" fill="none"/>
          <path d="M14 36c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="var(--text-muted)" stroke-width="1.5" fill="none"/>
        </svg>
      </div>
      <p class="empty-heading">No agents yet</p>
      <p class="empty-body">Add your first team member to start building your fleet.</p>
      <a href="/team/new" class="btn-primary">Add agent</a>
    </div>
  {:else}
    <div class="filter-bar">
      {#each CLASS_FILTERS as filter}
        <button
          class="filter-chip"
          class:active={activeFilter === filter.value}
          onclick={() => (activeFilter = filter.value)}
        >{filter.label}</button>
      {/each}
    </div>

    {#if filteredAgents.length === 0}
      <p class="no-results">No {activeFilter} agents found.</p>
    {:else}
      <div class="agents-grid">
        {#each filteredAgents as agent}
          {@const cls = agent.agentClass ?? 'Novice'}
          {@const clsColor = getClassColor(cls)}
          <a href="/team/{agent.id}" class="agent-card">
            <div class="card-top">
              <div class="avatar" style="background: {clsColor}15; border-color: {clsColor}40">
                <span class="avatar-letter" style="color: {clsColor}">{getInitial(agent.name)}</span>
              </div>
              <div class="status-indicator">
                <span class="status-dot" style="background: {getStatusColor(agent.status)}"></span>
                <span class="status-text">{getStatusLabel(agent.status)}</span>
              </div>
            </div>

            <div class="card-body">
              <h3 class="agent-name">{agent.name}</h3>
              {#if agent.description}
                <p class="agent-desc">{agent.description}</p>
              {:else if agent.adapter}
                <p class="agent-desc">{getAdapterLabel(agent.adapter)}</p>
              {/if}
            </div>

            <div class="card-footer">
              <span class="class-badge" style="color: {clsColor}; border-color: {clsColor}40; background: {clsColor}10">
                {cls.toUpperCase()}
              </span>
              {#if agent.compositeScore}
                <span class="score-badge">{parseFloat(agent.compositeScore).toFixed(1)}</span>
              {/if}
              {#if agent.skillCount != null && agent.skillCount > 0}
                <span class="skill-count">{agent.skillCount} skill{agent.skillCount === 1 ? '' : 's'}</span>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .team-page {
    max-width: 1200px;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: var(--space-xl);
    gap: var(--space-lg);
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(26px, 3.5vw, 38px);
    font-weight: 600;
    line-height: 1.1;
    color: var(--text);
    margin: 0;
  }

  .page-subtitle {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 10px 18px;
    background: var(--accent, var(--fo-plum));
    color: white;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    border-radius: var(--radius-md);
    transition: background 0.15s;
    border: none;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-primary:hover {
    background: var(--accent-m, var(--fo-plum-m));
  }

  /* ── Filter Bar ─────────────────────────────── */

  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: var(--space-xl);
  }

  .filter-chip {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--border, var(--fo-border));
    padding: 5px 12px;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-chip:hover {
    color: var(--text);
    border-color: var(--accent, var(--fo-plum));
  }

  .filter-chip.active {
    color: white;
    background: var(--accent, var(--fo-plum));
    border-color: var(--accent, var(--fo-plum));
  }

  .no-results {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
    padding: var(--space-3xl) 0;
  }

  /* ── Grid ───────────────────────────────────── */

  .agents-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-lg);
  }

  /* ── Agent Card ─────────────────────────────── */

  .agent-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-lg);
    background: var(--card, var(--fo-card));
    border: 1px solid var(--border, var(--fo-border));
    border-radius: var(--radius-lg);
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
  }

  .agent-card:hover {
    border-color: var(--accent, var(--fo-plum));
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-xl);
    border: 1.5px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .avatar-letter {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    line-height: 1;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-text {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    flex: 1;
    min-height: 0;
  }

  .agent-name {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    line-height: 1.2;
    margin: 0;
  }

  .agent-desc {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-footer {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
    padding-top: var(--space-sm);
    border-top: 1px solid var(--border, var(--fo-border));
  }

  .class-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.1em;
    padding: 2px 6px;
    border: 1px solid;
    border-radius: 3px;
  }

  .score-badge {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
  }

  .skill-count {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    margin-left: auto;
  }

  /* ── Empty State ────────────────────────────── */

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-3xl) 0;
    text-align: center;
  }

  .empty-icon {
    margin-bottom: var(--space-sm);
    opacity: 0.6;
  }

  .empty-heading {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .empty-body {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
    max-width: 320px;
  }
</style>
