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
  <nav class="breadcrumb">
    <a href="/executions/{executionId}">Back to Execution</a>
  </nav>

  <h1>Execution Report</h1>
  <p class="subtitle">Execution <code>{executionId.slice(0, 8)}</code></p>

  {#if loading}
    <div class="loading">Loading report...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if report}
    <!-- Execution Summary Panel (UI-06) -->
    <section class="section">
      <h2>Execution Summary</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Total Cost</span>
          <span class="stat-value">${(report.totalCostCents / 100).toFixed(2)}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Total Bot-Hours</span>
          <span class="stat-value">{report.totalBotHours.toFixed(2)}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Tasks Completed</span>
          <span class="stat-value">{report.completedTasks} / {report.totalTasks}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Average Bot Score</span>
          <span class="stat-value">{report.averageBotScore.toFixed(1)}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Top Bot</span>
          <span class="stat-value">{report.topPerformingBotId?.slice(0, 8) ?? 'N/A'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Failed Tasks</span>
          <span class="stat-value">{report.failedTasks}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Cost Per Task</span>
          <span class="stat-value">${(report.costPerTaskCents / 100).toFixed(2)}</span>
        </div>
      </div>
    </section>

    <!-- Soul Tier Distribution (RUN-03) -->
    {#if report.soulTierDistribution}
      <section class="section">
        <h2>Soul Tier Distribution</h2>
        <div class="tier-distribution">
          <div class="tier-item">
            <SoulTierBadge agentClass="Artisan" />
            <span class="tier-count tier-count-artisan">{report.soulTierDistribution.artisan}</span>
          </div>
          <div class="tier-item">
            <SoulTierBadge agentClass="Understudy" />
            <span class="tier-count tier-count-understudy">{report.soulTierDistribution.understudy}</span>
          </div>
          <div class="tier-item">
            <SoulTierBadge agentClass="Novice" />
            <span class="tier-count tier-count-novice">{report.soulTierDistribution.novice}</span>
          </div>
          {#if report.soulTierDistribution.retired > 0}
            <div class="tier-item">
              <SoulTierBadge agentClass="Retired" />
              <span class="tier-count tier-count-retired">{report.soulTierDistribution.retired}</span>
            </div>
          {/if}
        </div>
      </section>
    {/if}

    <!-- Ring Leader Synthesis (DASH-04) -->
    {#if synthesisData?.synthesis}
      {@const synthesis = synthesisData.synthesis}
      <section class="section">
        <h2>Ring Leader Synthesis</h2>

        <!-- Objective Achievement -->
        <div class="synthesis-achievement">
          <span class="achievement-badge" class:achievement-achieved={synthesis.objectiveAchieved} class:achievement-not-achieved={!synthesis.objectiveAchieved}>
            {synthesis.objectiveAchieved ? 'ACHIEVED' : 'NOT ACHIEVED'}
          </span>
          <p class="achievement-rationale">{synthesis.achievementRationale}</p>
        </div>

        <!-- Run Statistics -->
        <div class="stats-grid synthesis-stats">
          <div class="stat-card">
            <span class="stat-label">Intelligence Routing Events</span>
            <span class="stat-value">{synthesis.intelligenceRoutingEvents}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Reallocation Events</span>
            <span class="stat-value">{synthesis.reallocationEvents}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Reanchoring Events</span>
            <span class="stat-value">{synthesis.reanchoringEvents}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Budget Variance</span>
            <span class="stat-value" class:variance-under={synthesis.budgetVarianceCents < 0} class:variance-over={synthesis.budgetVarianceCents > 0}>
              ${(synthesis.budgetVarianceCents / 100).toFixed(2)}
            </span>
          </div>
        </div>

        <!-- Soul Selection Retrospective -->
        <div class="text-block">
          <span class="text-block-label">Soul Selection Retrospective</span>
          <p class="text-block-content">{synthesis.soulSelectionRetrospective}</p>
        </div>

        <!-- Coordination Self-Assessment -->
        <div class="text-block">
          <span class="text-block-label">Coordination Self-Assessment</span>
          <p class="text-block-content">{synthesis.ringLeaderSelfAssessment}</p>
        </div>

        <!-- Recommended Library Writes -->
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

        <!-- Pioneer Events -->
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

    <!-- Ring Leader Fitness (DASH-05) -->
    {#if synthesisData?.fitness}
      {@const fitness = synthesisData.fitness}
      {@const c = fitness.coordinationScore}
      {@const s = fitness.soulSelectionScore}
      <section class="section">
        <h2>Ring Leader Fitness</h2>

        <!-- Composite Score -->
        <div class="composite-score-row">
          <span class="stat-label">Composite Score</span>
          <span class="composite-score-value {compositeScoreClass(fitness.compositeScore)}">
            {fitness.compositeScore.toFixed(2)}
          </span>
        </div>

        <!-- Coordination Score Breakdown (60% weight) -->
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

        <!-- Soul Selection Score Breakdown (40% weight) -->
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

    <!-- Bot Leaderboard Table (UI-07) -->
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
                <tr class:row-top={i === 0} class:row-second={i === 1} class:row-third={i === 2} class:row-alt={i % 2 !== 0}>
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
                    <a href="/executions/{executionId}/bots/{entry.botId}">
                      {entry.botId.slice(0, 8)}
                    </a>
                  </td>
                  <td>
                    <span class="score-value">{entry.compositeScore?.toFixed(1) ?? '-'}</span>
                  </td>
                  <td>
                    <span class="tier tier-{entry.tier?.toLowerCase() ?? 'none'}">
                      {entry.tier ?? '-'}
                    </span>
                  </td>
                  <td>{entry.tasksCompleted}</td>
                  <td>{entry.tasksFailed}</td>
                  <td>{entry.botHours?.toFixed(3) ?? '-'}</td>
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
                    <button class="inspect-soul-btn" onclick={() => selectedBotId = entry.botId}>
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
    padding: 96px 36px 80px;
    background: var(--bg);
    min-height: 100vh;
  }

  @media (max-width: 600px) {
    .page {
      padding: 88px 20px 60px;
    }
  }

  .breadcrumb {
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .breadcrumb a {
    color: var(--violet-bright);
    text-decoration: none;
  }

  .breadcrumb a:hover {
    color: var(--violet-light);
    text-decoration: underline;
  }

  h1 {
    margin: 0 0 0.25rem;
    font-size: 1.75rem;
    color: var(--text);
  }

  .subtitle {
    margin: 0 0 2rem;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .loading {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }

  .error {
    padding: 1rem;
    background: var(--error-dim);
    border: 1px solid var(--error);
    border-radius: 0.5rem;
    color: var(--error);
  }

  .section {
    margin-bottom: 2.5rem;
  }

  .section h2 {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
  }

  /* Stats grid: 3 cols on desktop, 2 on tablet, 1 on mobile */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }

  .stat-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    font-weight: 600;
  }

  .stat-value {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text);
  }

  .empty {
    color: var(--text-faint);
    font-style: italic;
  }

  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  thead th {
    text-align: left;
    padding: 0.75rem 1rem;
    background: var(--bg-3);
    border-bottom: 2px solid var(--border);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--text-faint);
    white-space: nowrap;
  }

  tbody td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    background: var(--bg-card);
  }

  tbody tr.row-alt td {
    background: var(--bg-3);
  }

  tbody tr:hover td {
    background: var(--bg-2);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody td a {
    color: var(--violet-bright);
    text-decoration: none;
    font-family: var(--font-mono);
    font-weight: 600;
  }

  tbody td a:hover {
    text-decoration: underline;
  }

  /* Rank badges — podium colors */
  .rank-cell {
    text-align: center;
  }

  .rank-badge {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 0.7rem;
  }

  .rank-1 {
    background: var(--amber-dim);
    color: var(--amber);
    border: 1px solid var(--amber);
  }

  .rank-2 {
    background: rgba(99, 102, 241, 0.12);
    color: var(--violet-bright);
    border: 1px solid var(--violet-bright);
  }

  .rank-3 {
    background: var(--teal-dim);
    color: var(--teal);
    border: 1px solid var(--teal);
  }

  .rank-num {
    font-family: var(--font-mono);
    color: var(--text-faint);
    font-size: 0.8rem;
  }

  /* Score values */
  .score-value {
    font-family: var(--font-mono);
    color: var(--text);
    font-weight: 600;
  }

  /* Percentages */
  .pct-value {
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  /* Tier badges */
  .tier {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  .tier-high {
    color: var(--teal);
    background: var(--teal-dim);
    border: 1px solid var(--teal);
  }

  .tier-medium {
    color: var(--amber);
    background: var(--amber-dim);
    border: 1px solid var(--amber);
  }

  .tier-low {
    color: var(--error);
    background: var(--error-dim);
    border: 1px solid var(--error);
  }

  .tier-none {
    color: var(--text-muted);
    background: var(--bg-3);
    border: 1px solid var(--border);
  }

  /* Pioneer badge */
  .pioneer-badge {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--amber-dim);
    color: var(--amber);
    font-weight: 700;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    border: 1px solid var(--amber);
  }

  /* Verdict badges */
  .verdict-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  .verdict-promote {
    color: var(--teal);
    background: var(--teal-dim);
    border: 1px solid var(--teal);
  }

  .verdict-retire {
    color: var(--rose);
    background: var(--rose-dim);
    border: 1px solid var(--rose);
  }

  .verdict-demote {
    color: var(--amber);
    background: var(--amber-dim);
    border: 1px solid var(--amber);
  }

  .verdict-monitor {
    color: var(--amber);
    background: var(--amber-dim);
    border: 1px solid var(--amber);
  }

  .verdict-maintain {
    color: var(--violet-bright);
    background: rgba(99, 102, 241, 0.12);
    border: 1px solid var(--violet-bright);
  }

  .verdict-summary {
    display: block;
    font-size: 0.75rem;
    color: var(--text-muted);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 0.2rem;
  }

  .no-data {
    color: var(--text-faint);
  }

  .inspect-soul-btn {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.2rem 0.55rem;
    border-radius: 9999px;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--violet-bright);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s, border-color 0.1s;
  }

  .inspect-soul-btn:hover {
    background: var(--bg-3);
    border-color: var(--border-mid);
    opacity: 0.85;
  }

  /* Soul tier distribution */
  .tier-distribution {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .tier-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tier-count {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 700;
  }

  .tier-count-artisan { color: var(--amber); }
  .tier-count-understudy { color: var(--teal); }
  .tier-count-novice { color: var(--text-muted); }
  .tier-count-retired { color: var(--rose); }

  /* Ring Leader Synthesis styles */

  .synthesis-achievement {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .achievement-badge {
    display: inline-block;
    padding: 0.3rem 0.75rem;
    border-radius: 9999px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 0.1rem;
  }

  .achievement-achieved {
    color: var(--teal);
    background: var(--teal-dim);
    border: 1px solid var(--teal);
  }

  .achievement-not-achieved {
    color: var(--error);
    background: var(--error-dim);
    border: 1px solid var(--error);
  }

  .achievement-rationale {
    margin: 0;
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 300;
    line-height: 1.65;
  }

  .synthesis-stats {
    margin-bottom: 1.5rem;
  }

  .variance-under {
    color: var(--teal) !important;
  }

  .variance-over {
    color: var(--error) !important;
  }

  .text-block {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 1rem;
  }

  .text-block-label {
    display: block;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin-bottom: 0.75rem;
  }

  .text-block-content {
    margin: 0;
    font-size: 14px;
    font-weight: 300;
    color: var(--text-muted);
    line-height: 1.65;
    white-space: pre-line;
  }

  .pill-group {
    margin-bottom: 1rem;
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .pill {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .pill-teal {
    color: var(--teal);
    background: var(--teal-dim);
    border: 1px solid var(--teal);
  }

  .pill-amber {
    color: var(--amber);
    background: var(--amber-dim);
    border: 1px solid var(--amber);
  }

  /* Ring Leader Fitness styles */

  .composite-score-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .composite-score-value {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 700;
  }

  .composite-high {
    color: var(--teal);
  }

  .composite-mid {
    color: var(--amber);
  }

  .composite-low {
    color: var(--error);
  }

  .score-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 1rem;
  }

  .score-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .score-card-title {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-faint);
    font-weight: 600;
  }

  .score-card-weight {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .dimension {
    margin-bottom: 0.875rem;
  }

  .dimension:last-of-type {
    margin-bottom: 0.5rem;
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
    color: var(--text-faint);
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

  .score-bar-fill.score-high {
    background: var(--teal);
  }

  .score-bar-fill.score-mid {
    background: var(--amber);
  }

  .score-bar-fill.score-low {
    background: var(--error);
  }

  .score-subtotal {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-faint);
    text-align: right;
  }

  .subtotal-value {
    color: var(--text);
    font-size: 12px;
    font-weight: 700;
  }
</style>
