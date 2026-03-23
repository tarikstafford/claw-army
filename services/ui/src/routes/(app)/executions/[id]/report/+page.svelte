<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getExecutionReport, getLeaderboard, getRingLeaderSynthesis } from '$lib/api';
  import type { ExecutionReport, LeaderboardEntry, RingLeaderSynthesisResponse } from '$lib/types';
  import SoulInspectorPanel from '$lib/components/SoulInspectorPanel.svelte';
  import SoulTierBadge from '$lib/components/SoulTierBadge.svelte';

  const executionId = $derived(page.params.id ?? '');

  let report = $state<ExecutionReport | null>(null);
  let leaderboard = $state<LeaderboardEntry[]>([]);
  let synthesisData = $state<RingLeaderSynthesisResponse | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let selectedBotId = $state<string | null>(null);

  $effect(() => {
    if (!browser) return;
    const id = executionId;
    if (!id) return;

    loading = true;
    error = null;

    Promise.all([
      getExecutionReport(id),
      getLeaderboard(id),
      getRingLeaderSynthesis(id).catch(() => null),
    ])
      .then(([r, l, s]) => { report = r; leaderboard = l; synthesisData = s; loading = false; })
      .catch(err => { error = (err as Error).message; loading = false; });
  });

  function scoreClass(value: number): string {
    if (value >= 0.7) return 'score-high';
    if (value >= 0.5) return 'score-mid';
    return 'score-low';
  }

  function compositeScoreClass(value: number): string {
    if (value >= 0.85) return 'composite-high';
    if (value >= 0.68) return 'composite-mid';
    return 'composite-low';
  }
</script>

<svelte:head>
  <title>Report — Execution {executionId.slice(0, 8)} | Akasa</title>
</svelte:head>

<div class="page">
  <!-- Header -->
  <div class="page-header">
    <a href="/executions/{executionId}" class="back-link">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Execution
    </a>
    <div class="sec-label">Mission Report</div>
    <h1>Execution <code class="exec-id">{executionId.slice(0, 8)}</code></h1>
  </div>

  {#if loading}
    <div class="loading">Loading report...</div>
  {:else if error}
    <div class="error-card">{error}</div>
  {:else if report}
    <!-- Execution Summary -->
    <section class="section">
      <h2>Execution Summary</h2>
      <div class="hero-row">
        <div class="hero-metric hero-primary">
          <span class="hero-value">${(report.totalCostCents / 100).toFixed(2)}</span>
          <span class="hero-label">Total Cost</span>
        </div>
        <div class="hero-metric">
          <span class="hero-value">{report.totalBotHours.toFixed(2)}</span>
          <span class="hero-label">Bot-Hours</span>
        </div>
        <div class="hero-metric">
          <span class="hero-value">{report.completedTasks} / {report.totalTasks}</span>
          <span class="hero-label">Tasks Completed</span>
        </div>
        <div class="hero-metric">
          <span class="hero-value">{report.averageBotScore.toFixed(1)}</span>
          <span class="hero-label">Avg Bot Score</span>
        </div>
      </div>

      <div class="detail-grid">
        <div class="detail-cell">
          <span class="detail-value">{report.topPerformingBotId?.slice(0, 8) ?? 'N/A'}</span>
          <span class="detail-label">Top Bot</span>
        </div>
        <div class="detail-cell">
          <span class="detail-value">{report.failedTasks}</span>
          <span class="detail-label">Failed Tasks</span>
        </div>
        <div class="detail-cell">
          <span class="detail-value">${(report.costPerTaskCents / 100).toFixed(2)}</span>
          <span class="detail-label">Cost Per Task</span>
        </div>
      </div>
    </section>

    <!-- Soul Tier Distribution -->
    {#if report.soulTierDistribution}
      <section class="section">
        <h2>Soul Tier Distribution</h2>
        <div class="tier-distribution">
          <div class="tier-item">
            <SoulTierBadge agentClass="Artisan" />
            <span class="tier-count" style="color: var(--karma)">{report.soulTierDistribution.artisan}</span>
          </div>
          <div class="tier-item">
            <SoulTierBadge agentClass="Understudy" />
            <span class="tier-count" style="color: var(--bo-teal)">{report.soulTierDistribution.understudy}</span>
          </div>
          <div class="tier-item">
            <SoulTierBadge agentClass="Novice" />
            <span class="tier-count" style="color: var(--text-muted)">{report.soulTierDistribution.novice}</span>
          </div>
          {#if report.soulTierDistribution.retired > 0}
            <div class="tier-item">
              <SoulTierBadge agentClass="Retired" />
              <span class="tier-count" style="color: var(--bo-rose)">{report.soulTierDistribution.retired}</span>
            </div>
          {/if}
        </div>
      </section>
    {/if}

    <!-- Ring Leader Synthesis -->
    {#if synthesisData?.synthesis}
      {@const synthesis = synthesisData.synthesis}
      <section class="section">
        <h2>Ring Leader Synthesis</h2>

        <!-- Objective Achievement -->
        <div class="achievement-row">
          <span class="achievement-badge" class:achieved={synthesis.objectiveAchieved} class:not-achieved={!synthesis.objectiveAchieved}>
            {synthesis.objectiveAchieved ? 'ACHIEVED' : 'NOT ACHIEVED'}
          </span>
          <p class="achievement-text">{synthesis.achievementRationale}</p>
        </div>

        <!-- Run Statistics -->
        <div class="detail-grid detail-grid-4">
          <div class="detail-cell">
            <span class="detail-value">{synthesis.intelligenceRoutingEvents}</span>
            <span class="detail-label">Intelligence Routing</span>
          </div>
          <div class="detail-cell">
            <span class="detail-value">{synthesis.reallocationEvents}</span>
            <span class="detail-label">Reallocations</span>
          </div>
          <div class="detail-cell">
            <span class="detail-value">{synthesis.reanchoringEvents}</span>
            <span class="detail-label">Reanchoring</span>
          </div>
          <div class="detail-cell">
            <span class="detail-value" class:variance-under={synthesis.budgetVarianceCents < 0} class:variance-over={synthesis.budgetVarianceCents > 0}>
              ${(synthesis.budgetVarianceCents / 100).toFixed(2)}
            </span>
            <span class="detail-label">Budget Variance</span>
          </div>
        </div>

        <!-- Prose blocks -->
        <div class="text-block">
          <span class="text-block-label">Soul Selection Retrospective</span>
          <p class="text-block-content">{synthesis.soulSelectionRetrospective}</p>
        </div>

        <div class="text-block">
          <span class="text-block-label">Coordination Self-Assessment</span>
          <p class="text-block-content">{synthesis.ringLeaderSelfAssessment}</p>
        </div>

        <!-- Pills -->
        {#if synthesis.recommendedLibraryWrites.length > 0}
          <div class="pill-group">
            <span class="text-block-label">Recommended Library Writes</span>
            <div class="pills">
              {#each synthesis.recommendedLibraryWrites.slice(0, 8) as soulId}
                <span class="pill pill-teal">{soulId.slice(0, 8)}</span>
              {/each}
            </div>
          </div>
        {/if}

        {#if synthesis.pioneerEvents.length > 0}
          <div class="pill-group">
            <span class="text-block-label">Pioneer Events</span>
            <div class="pills">
              {#each synthesis.pioneerEvents as taskId}
                <span class="pill pill-amber">{taskId}</span>
              {/each}
            </div>
          </div>
        {/if}
      </section>
    {/if}

    <!-- Ring Leader Fitness -->
    {#if synthesisData?.fitness}
      {@const fitness = synthesisData.fitness}
      {@const c = fitness.coordinationScore}
      {@const s = fitness.soulSelectionScore}
      <section class="section">
        <h2>Ring Leader Fitness</h2>

        <div class="composite-row">
          <span class="composite-label">Composite Score</span>
          <span class="composite-value {compositeScoreClass(fitness.compositeScore)}">
            {fitness.compositeScore.toFixed(2)}
          </span>
        </div>

        <!-- Coordination Score -->
        <div class="score-card">
          <div class="score-card-header">
            <span class="score-card-title">Coordination Score</span>
            <span class="score-card-weight">60% weight</span>
          </div>

          <div class="dimension">
            <div class="dimension-header">
              <span class="dimension-label">Collective Outcome (40%)</span>
              <span class="dimension-value">{c.collectiveOutcome.toFixed(2)}</span>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill {scoreClass(c.collectiveOutcome)}" style="width: {(c.collectiveOutcome * 100).toFixed(1)}%"></div>
            </div>
          </div>

          <div class="dimension">
            <div class="dimension-header">
              <span class="dimension-label">Drift Prevention (25%)</span>
              <span class="dimension-value">{c.driftPrevention.toFixed(2)}</span>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill {scoreClass(c.driftPrevention)}" style="width: {(c.driftPrevention * 100).toFixed(1)}%"></div>
            </div>
          </div>

          <div class="dimension">
            <div class="dimension-header">
              <span class="dimension-label">Reallocation Effectiveness (20%)</span>
              <span class="dimension-value">{c.reallocationEffectiveness.toFixed(2)}</span>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill {scoreClass(c.reallocationEffectiveness)}" style="width: {(c.reallocationEffectiveness * 100).toFixed(1)}%"></div>
            </div>
          </div>

          <div class="dimension">
            <div class="dimension-header">
              <span class="dimension-label">Budget Management (15%)</span>
              <span class="dimension-value">{c.budgetManagement.toFixed(2)}</span>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill {scoreClass(c.budgetManagement)}" style="width: {(c.budgetManagement * 100).toFixed(1)}%"></div>
            </div>
          </div>

          <div class="score-subtotal">
            Weighted Subtotal: <span class="subtotal-value">{(c.collectiveOutcome * 0.40 + c.driftPrevention * 0.25 + c.reallocationEffectiveness * 0.20 + c.budgetManagement * 0.15).toFixed(2)}</span>
          </div>
        </div>

        <!-- Soul Selection Score -->
        <div class="score-card">
          <div class="score-card-header">
            <span class="score-card-title">Soul Selection Score</span>
            <span class="score-card-weight">40% weight</span>
          </div>

          <div class="dimension">
            <div class="dimension-header">
              <span class="dimension-label">Library Search Quality (20%)</span>
              <span class="dimension-value">{s.librarySearchQuality.toFixed(2)}</span>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill {scoreClass(s.librarySearchQuality)}" style="width: {(s.librarySearchQuality * 100).toFixed(1)}%"></div>
            </div>
          </div>

          <div class="dimension">
            <div class="dimension-header">
              <span class="dimension-label">Differentiation Effectiveness (20%)</span>
              <span class="dimension-value">{s.differentiationEffectiveness.toFixed(2)}</span>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill {scoreClass(s.differentiationEffectiveness)}" style="width: {(s.differentiationEffectiveness * 100).toFixed(1)}%"></div>
            </div>
          </div>

          <div class="dimension">
            <div class="dimension-header">
              <span class="dimension-label">Mutation Decision Quality (20%)</span>
              <span class="dimension-value">{s.mutationDecisionQuality.toFixed(2)}</span>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill {scoreClass(s.mutationDecisionQuality)}" style="width: {(s.mutationDecisionQuality * 100).toFixed(1)}%"></div>
            </div>
          </div>

          <div class="dimension">
            <div class="dimension-header">
              <span class="dimension-label">Pioneer Handling (20%)</span>
              <span class="dimension-value">{s.pioneerHandling.toFixed(2)}</span>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill {scoreClass(s.pioneerHandling)}" style="width: {(s.pioneerHandling * 100).toFixed(1)}%"></div>
            </div>
          </div>

          <div class="dimension">
            <div class="dimension-header">
              <span class="dimension-label">Selection Retrospective Quality (20%)</span>
              <span class="dimension-value">{s.selectionRetrospectiveQuality.toFixed(2)}</span>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill {scoreClass(s.selectionRetrospectiveQuality)}" style="width: {(s.selectionRetrospectiveQuality * 100).toFixed(1)}%"></div>
            </div>
          </div>

          <div class="score-subtotal">
            Weighted Subtotal: <span class="subtotal-value">{((s.librarySearchQuality + s.differentiationEffectiveness + s.mutationDecisionQuality + s.pioneerHandling + s.selectionRetrospectiveQuality) / 5).toFixed(2)}</span>
          </div>
        </div>
      </section>
    {/if}

    <!-- Bot Leaderboard -->
    <section class="section">
      <h2>Bot Leaderboard</h2>
      {#if leaderboard.length === 0}
        <p class="empty">No bots in this execution.</p>
      {:else}
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Bot ID</th>
                <th>Score</th>
                <th>Tier</th>
                <th>Completed</th>
                <th>Failed</th>
                <th>Bot-Hours</th>
                <th>Class</th>
                <th>Verdict</th>
                <th>Pioneer</th>
                <th>Soul</th>
              </tr>
            </thead>
            <tbody>
              {#each leaderboard as entry, i}
                <tr>
                  <td class="rank-cell">
                    {#if i === 0}
                      <span class="rank-badge rank-1">{i + 1}</span>
                    {:else if i === 1}
                      <span class="rank-badge rank-2">{i + 1}</span>
                    {:else if i === 2}
                      <span class="rank-badge rank-3">{i + 1}</span>
                    {:else}
                      <span class="rank-num">{i + 1}</span>
                    {/if}
                  </td>
                  <td>
                    <a href="/executions/{executionId}/bots/{entry.botId}" class="bot-link">
                      {entry.botId.slice(0, 8)}
                    </a>
                  </td>
                  <td class="col-mono">{entry.compositeScore?.toFixed(1) ?? '-'}</td>
                  <td>
                    <span class="tier-badge tier-{entry.tier?.toLowerCase() ?? 'none'}">
                      {entry.tier ?? '-'}
                    </span>
                  </td>
                  <td class="col-mono">{entry.tasksCompleted}</td>
                  <td class="col-mono">{entry.tasksFailed}</td>
                  <td class="col-mono">{entry.botHours?.toFixed(3) ?? '-'}</td>
                  <td>
                    <SoulTierBadge agentClass={entry.agentClass} />
                  </td>
                  <td>
                    {#if entry.verdictType}
                      <span class="verdict-badge verdict-{entry.verdictType.toLowerCase()}">{entry.verdictType}</span>
                      {#if entry.verdictSummary}
                        <span class="verdict-summary">{entry.verdictSummary.length > 60 ? entry.verdictSummary.slice(0, 60) + '...' : entry.verdictSummary}</span>
                      {/if}
                    {:else}
                      <span class="no-data">-</span>
                    {/if}
                  </td>
                  <td>
                    {#if entry.isPioneer}
                      <span class="pioneer-badge" title="Pioneer — first in category">P</span>
                    {:else}
                      <span class="no-data">-</span>
                    {/if}
                  </td>
                  <td>
                    <button class="action-btn" onclick={() => selectedBotId = entry.botId}>
                      Inspect
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  {/if}
</div>

<SoulInspectorPanel botId={selectedBotId} onClose={() => selectedBotId = null} />

<style>
  .page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 40px var(--space-2xl) 80px;
    min-height: 100vh;
  }

  @media (max-width: 600px) {
    .page { padding: 32px var(--space-lg) 60px; }
  }

  /* ── Page header ──────────────────────────────── */
  .page-header {
    margin-bottom: var(--space-2xl);
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    text-decoration: none;
    margin-bottom: var(--space-lg);
    transition: color 0.15s;
  }

  .back-link:hover {
    color: var(--accent-m);
  }

  .page-header h1 {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text);
    margin: var(--space-sm) 0 0;
    line-height: 1.1;
  }

  .exec-id {
    font-family: var(--font-mono);
    font-size: 0.85em;
    color: var(--accent-m);
    background: none;
  }

  /* ── States ───────────────────────────────────── */
  .loading {
    padding: var(--space-2xl);
    text-align: center;
    color: var(--text-muted);
  }

  .error-card {
    padding: 16px var(--space-lg);
    background: var(--error-dim);
    border: 1px solid rgba(248, 113, 113, 0.2);
    border-left: 3px solid var(--error);
    border-radius: 6px;
    color: var(--error);
    font-size: 0.875rem;
  }

  .empty {
    color: var(--bo-faint);
    font-style: italic;
  }

  /* ── Section ──────────────────────────────────── */
  .section {
    margin-bottom: var(--space-2xl);
  }

  .section h2 {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--bo-faint);
    margin: 0 0 16px;
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--border);
  }

  /* ── Hero metrics ─────────────────────────────── */
  .hero-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 16px;
  }

  .hero-metric {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .hero-primary {
    border-color: var(--border);
  }

  .hero-value {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
  }

  .hero-primary .hero-value {
    color: var(--accent-m);
  }

  .hero-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--bo-faint);
  }

  @media (max-width: 768px) {
    .hero-row { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 480px) {
    .hero-row { grid-template-columns: 1fr; }
  }

  /* ── Detail grid ──────────────────────────────── */
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }

  .detail-grid-4 {
    grid-template-columns: repeat(4, 1fr);
  }

  .detail-cell {
    background: var(--card);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .detail-value {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
  }

  .detail-label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--bo-faint);
  }

  @media (max-width: 600px) {
    .detail-grid { grid-template-columns: repeat(2, 1fr); }
    .detail-grid-4 { grid-template-columns: repeat(2, 1fr); }
  }

  /* ── Tier distribution ────────────────────────── */
  .tier-distribution {
    display: flex;
    gap: var(--space-xl);
    flex-wrap: wrap;
  }

  .tier-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .tier-count {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 700;
  }

  /* ── Achievement row ──────────────────────────── */
  .achievement-row {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
  }

  .achievement-badge {
    display: inline-block;
    padding: 3px 12px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .achieved {
    color: var(--bo-teal);
    background: rgba(45, 212, 191, 0.10);
  }

  .not-achieved {
    color: var(--error);
    background: var(--error-dim);
  }

  .achievement-text {
    margin: 0;
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 300;
    line-height: 1.65;
  }

  .variance-under { color: var(--bo-teal) !important; }
  .variance-over  { color: var(--error) !important; }

  /* ── Text blocks ──────────────────────────────── */
  .text-block {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: var(--space-lg);
    margin-bottom: 16px;
  }

  .text-block-label {
    display: block;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--bo-faint);
    margin-bottom: 12px;
  }

  .text-block-content {
    margin: 0;
    font-size: 14px;
    font-weight: 300;
    color: var(--text-muted);
    line-height: 1.65;
    white-space: pre-line;
  }

  /* ── Pills ────────────────────────────────────── */
  .pill-group {
    margin-bottom: 16px;
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
  }

  .pill {
    display: inline-block;
    padding: 3px 12px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.04em;
  }

  .pill-teal {
    color: var(--bo-teal);
    background: rgba(45, 212, 191, 0.10);
  }

  .pill-amber {
    color: var(--karma);
    background: rgba(251, 191, 36, 0.10);
  }

  /* ── Score cards ───────────────────────────────── */
  .composite-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: var(--space-lg);
  }

  .composite-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--bo-faint);
  }

  .composite-value {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 700;
  }

  .composite-high { color: var(--bo-teal); }
  .composite-mid  { color: var(--karma); }
  .composite-low  { color: var(--error); }

  .score-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: var(--space-lg);
    margin-bottom: 16px;
  }

  .score-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .score-card-title {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--bo-faint);
    font-weight: 600;
  }

  .score-card-weight {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--bo-faint);
  }

  .dimension {
    margin-bottom: 12px;
  }

  .dimension:last-of-type {
    margin-bottom: var(--space-sm);
  }

  .dimension-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .dimension-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--bo-faint);
  }

  .dimension-value {
    font-family: var(--font-mono);
    font-size: 14px;
    color: var(--text-muted);
  }

  .score-bar {
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    margin-top: 4px;
  }

  .score-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s;
  }

  .score-bar-fill.score-high { background: var(--bo-teal); }
  .score-bar-fill.score-mid  { background: var(--karma); }
  .score-bar-fill.score-low  { background: var(--error); }

  .score-subtotal {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--bo-faint);
    text-align: right;
  }

  .subtotal-value {
    color: var(--text);
    font-size: 12px;
    font-weight: 700;
  }

  /* ── Leaderboard table ────────────────────────── */
  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  thead th {
    text-align: left;
    padding: 12px 16px;
    background: var(--bg3);
    border-bottom: 1px solid var(--border);
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--bo-faint);
    white-space: nowrap;
  }

  tbody td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    background: var(--card);
  }

  tbody tr:hover td {
    background: var(--bg2);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  .col-mono {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
  }

  .bot-link {
    color: var(--accent-m);
    text-decoration: none;
    font-family: var(--font-mono);
    font-weight: 600;
  }

  .bot-link:hover {
    text-decoration: underline;
  }

  /* ── Rank badges ──────────────────────────────── */
  .rank-cell {
    text-align: center;
  }

  .rank-badge {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 22px;
    height: 22px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 0.6875rem;
  }

  .rank-1 { background: rgba(251, 191, 36, 0.10); color: var(--karma); }
  .rank-2 { background: rgba(99, 102, 241, 0.12); color: var(--accent-m); }
  .rank-3 { background: rgba(45, 212, 191, 0.10); color: var(--bo-teal); }

  .rank-num {
    font-family: var(--font-mono);
    color: var(--bo-faint);
    font-size: 0.8rem;
  }

  /* ── Tier / verdict / pioneer badges ──────────── */
  .tier-badge {
    display: inline-block;
    padding: 3px var(--space-sm);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .tier-high   { color: var(--bo-teal);  background: rgba(45, 212, 191, 0.10); }
  .tier-medium { color: var(--karma); background: rgba(251, 191, 36, 0.10); }
  .tier-low    { color: var(--error); background: var(--error-dim); }
  .tier-none   { color: var(--text-muted); background: var(--bg3); }

  .verdict-badge {
    display: inline-block;
    padding: 3px var(--space-sm);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .verdict-promote  { color: var(--bo-teal);          background: rgba(45, 212, 191, 0.10); }
  .verdict-retire   { color: var(--bo-rose);          background: rgba(244, 114, 182, 0.08); }
  .verdict-demote   { color: var(--karma);         background: rgba(251, 191, 36, 0.10); }
  .verdict-monitor  { color: var(--karma);         background: rgba(251, 191, 36, 0.10); }
  .verdict-maintain { color: var(--accent-m); background: rgba(99, 102, 241, 0.12); }

  .verdict-summary {
    display: block;
    font-size: 0.75rem;
    color: var(--text-muted);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 2px;
  }

  .pioneer-badge {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 22px;
    height: 22px;
    border-radius: 3px;
    background: rgba(251, 191, 36, 0.10);
    color: var(--karma);
    font-weight: 700;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
  }

  .no-data {
    color: var(--bo-faint);
  }

  .action-btn {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: 3px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--accent-m);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s;
  }

  .action-btn:hover {
    background: var(--bg3);
    border-color: var(--border);
  }
</style>
