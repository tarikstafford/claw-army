<script lang="ts">
  import { browser } from '$app/environment';
  import { getBotSoul } from '$lib/api';
  import type { BotSoul } from '$lib/types';

  let { botId, onClose }: { botId: string | null; onClose: () => void } = $props();

  let soul = $state<BotSoul | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let panelRef = $state<HTMLElement | null>(null);

  // Load soul data when botId changes
  $effect(() => {
    if (!browser || !botId) {
      soul = null;
      error = null;
      return;
    }

    loading = true;
    error = null;
    soul = null;

    getBotSoul(botId)
      .then((data) => {
        soul = data;
        loading = false;
      })
      .catch((err) => {
        error = (err as Error).message;
        loading = false;
      });
  });

  // Auto-focus panel on open
  $effect(() => {
    if (botId && panelRef) {
      panelRef.focus();
    }
  });

  const DIMENSION_LABELS: Record<string, string> = {
    identityRole: 'Identity & Role',
    decisionPriorities: 'Decision Priorities',
    toolUsageDoctrine: 'Tool Usage Doctrine',
    riskTolerance: 'Risk Tolerance',
    communicationStyle: 'Communication Style',
    recoveryBehavior: 'Recovery Behavior',
    ethicalHardStops: 'Ethical Hard Stops',
  };

  const DIMENSION_KEYS = [
    'identityRole',
    'decisionPriorities',
    'toolUsageDoctrine',
    'riskTolerance',
    'communicationStyle',
    'recoveryBehavior',
    'ethicalHardStops',
  ] as const;

  function agentClassStyle(cls: string | null): string {
    switch (cls) {
      case 'Artisan': return 'background:#fff7ed;color:#d97706;border:1px solid #fde68a;';
      case 'Understudy': return 'background:#f5f3ff;color:#8b5cf6;border:1px solid #ddd6fe;';
      case 'Novice': return 'background:#eff6ff;color:#3b82f6;border:1px solid #bfdbfe;';
      case 'Retired': return 'background:#f3f4f6;color:#6b7280;border:1px solid #e5e7eb;';
      default: return 'background:#f3f4f6;color:#6b7280;border:1px solid #e5e7eb;';
    }
  }

  function verdictBadgeStyle(type: string): string {
    switch (type) {
      case 'Promote': return 'background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;';
      case 'Retire': return 'background:#fef2f2;color:#dc2626;border:1px solid #fecaca;';
      case 'Demote': return 'background:#fff7ed;color:#ea580c;border:1px solid #fed7aa;';
      case 'Monitor': return 'background:#fefce8;color:#ca8a04;border:1px solid #fde68a;';
      case 'Maintain': return 'background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;';
      default: return 'background:#f3f4f6;color:#6b7280;border:1px solid #e5e7eb;';
    }
  }

  function formatJudgeOutput(output: unknown): string {
    if (!output || typeof output !== 'object') return 'No output available.';
    const obj = output as Record<string, unknown>;
    const parts: string[] = [];
    if (obj.verdict) parts.push(`Verdict: ${obj.verdict}`);
    if (obj.summary) parts.push(`Summary: ${obj.summary}`);
    if (obj.attributionAnalysis) parts.push('(Attribution analysis available)');
    if (obj.metrics) parts.push('(Metrics available)');
    return parts.length > 0 ? parts.join(' — ') : JSON.stringify(output).slice(0, 200);
  }
</script>

{#if botId}
  <!-- Backdrop -->
  <div
    class="backdrop"
    onclick={onClose}
    role="presentation"
  ></div>

  <!-- Panel -->
  <aside
    class="panel"
    bind:this={panelRef}
    tabindex="-1"
  >
    <!-- Header -->
    <div class="panel-header">
      <h2 class="panel-title">Soul Inspector</h2>
      <button class="close-btn" onclick={onClose} aria-label="Close soul inspector">
        ✕
      </button>
    </div>

    <!-- Content -->
    <div class="panel-body">
      {#if loading}
        <p class="loading-text">Loading soul data...</p>
      {:else if error}
        <p class="error-text">{error}</p>
      {:else if soul && soul.soulId === null}
        <p class="empty-text">No soul data available for this bot.</p>
      {:else if soul}

        <!-- Agent Class Badge -->
        {#if soul.agentClass}
          <div class="section">
            <span class="class-badge" style={agentClassStyle(soul.agentClass)}>
              {soul.agentClass}
            </span>
          </div>
        {/if}

        <!-- Lineage Section -->
        <div class="section">
          <h3 class="section-title">Lineage</h3>
          <div class="lineage-grid">
            <div class="lineage-item">
              <span class="lineage-label">Generation</span>
              <span class="lineage-value">{soul.generation ?? 'N/A'}</span>
            </div>
            <div class="lineage-item">
              <span class="lineage-label">Parent Soul</span>
              <span class="lineage-value monospace">
                {soul.parentSoulId ? soul.parentSoulId.slice(0, 8) + '...' : 'Seed Soul'}
              </span>
            </div>
            <div class="lineage-item">
              <span class="lineage-label">Task Category</span>
              <span class="lineage-value">{soul.taskCategory ?? 'Unknown'}</span>
            </div>
            <div class="lineage-item">
              <span class="lineage-label">Archetype</span>
              <span class="lineage-value">{soul.isArchetype ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        <!-- Behavioral Dimensions -->
        <div class="section">
          <h3 class="section-title">Behavioral Dimensions</h3>
          {#if soul.dimensions}
            {#each DIMENSION_KEYS as key}
              <div class="dimension-block">
                <h4 class="dimension-heading">{DIMENSION_LABELS[key]}</h4>
                <p class="dimension-content">{soul.dimensions[key] ?? ''}</p>
              </div>
            {/each}
          {:else}
            <p class="empty-text">Dimensions not available.</p>
          {/if}
        </div>

        <!-- Constitution Directives -->
        <div class="section">
          <h3 class="section-title">Constitution Directives</h3>
          {#if soul.constitutionDirectives && soul.constitutionDirectives.length > 0}
            <ol class="directives-list">
              {#each soul.constitutionDirectives as directive, i (i)}
                <li class="directive-item">{directive}</li>
              {/each}
            </ol>
          {:else}
            <p class="empty-text">No directives.</p>
          {/if}
        </div>

        <!-- Council Verdict (only if present) -->
        {#if soul.verdict}
          <div class="section">
            <h3 class="section-title">Council Verdict</h3>

            <div class="verdict-row">
              <span class="verdict-badge" style={verdictBadgeStyle(soul.verdict.verdictType)}>
                {soul.verdict.verdictType}
              </span>
              <span class="confidence-score">
                {(soul.verdict.weightedConfidenceScore * 100).toFixed(1)}% confidence
              </span>
            </div>

            <p class="verdict-summary">{soul.verdict.verdictSummary}</p>

            <!-- Per-judge outputs (expandable) -->
            <details class="judge-details">
              <summary class="judge-summary">Soul Analyst Output</summary>
              <p class="judge-output">{formatJudgeOutput(soul.verdict.soulAnalystOutput)}</p>
            </details>

            <details class="judge-details">
              <summary class="judge-summary">Performance Judge Output</summary>
              <p class="judge-output">{formatJudgeOutput(soul.verdict.performanceJudgeOutput)}</p>
            </details>
          </div>
        {/if}

      {:else}
        <p class="loading-text">Loading soul data...</p>
      {/if}
    </div>
  </aside>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 100;
  }

  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 480px;
    background: #fff;
    color: #111827;
    z-index: 101;
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
    animation: slideIn 0.25s ease-out;
    outline: none;
  }

  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }

  .panel-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #111827;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    line-height: 1;
    transition: background 0.1s;
  }

  .close-btn:hover {
    background: #f3f4f6;
    color: #111827;
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
  }

  .loading-text {
    color: #6b7280;
    font-size: 0.9rem;
    font-style: italic;
    margin: 0;
    padding: 1rem 0;
  }

  .error-text {
    color: #dc2626;
    font-size: 0.875rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    margin: 0;
  }

  .empty-text {
    color: #9ca3af;
    font-size: 0.875rem;
    font-style: italic;
    margin: 0;
    padding: 0.5rem 0;
  }

  /* Sections */
  .section {
    padding-bottom: 1.25rem;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .section:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  .section-title {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6b7280;
  }

  /* Agent Class Badge */
  .class-badge {
    display: inline-block;
    padding: 0.2rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Lineage */
  .lineage-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .lineage-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .lineage-label {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #9ca3af;
  }

  .lineage-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
  }

  .monospace {
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 0.8rem;
  }

  /* Dimensions */
  .dimension-block {
    margin-bottom: 1rem;
  }

  .dimension-block:last-child {
    margin-bottom: 0;
  }

  .dimension-heading {
    margin: 0 0 0.3rem;
    font-size: 0.8rem;
    font-weight: 700;
    color: #374151;
  }

  .dimension-content {
    margin: 0;
    font-size: 0.875rem;
    color: #4b5563;
    line-height: 1.55;
    white-space: pre-wrap;
  }

  /* Directives */
  .directives-list {
    margin: 0;
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .directive-item {
    font-size: 0.875rem;
    color: #374151;
    line-height: 1.5;
  }

  /* Verdict */
  .verdict-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .verdict-badge {
    display: inline-block;
    padding: 0.2rem 0.65rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .confidence-score {
    font-size: 0.85rem;
    font-weight: 600;
    color: #374151;
  }

  .verdict-summary {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    color: #4b5563;
    line-height: 1.55;
  }

  /* Per-judge details */
  .judge-details {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    margin-bottom: 0.5rem;
  }

  .judge-summary {
    padding: 0.6rem 0.875rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    user-select: none;
    list-style: none;
  }

  .judge-summary::-webkit-details-marker {
    display: none;
  }

  .judge-summary::before {
    content: '+ ';
    font-weight: 700;
    color: #6366f1;
  }

  details[open] > .judge-summary::before {
    content: '- ';
  }

  .judge-output {
    margin: 0;
    padding: 0.75rem 0.875rem;
    border-top: 1px solid #e5e7eb;
    font-size: 0.8rem;
    color: #4b5563;
    line-height: 1.5;
  }
</style>
