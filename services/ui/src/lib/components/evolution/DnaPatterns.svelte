<script lang="ts">
  interface DnaEntry {
    id: string;
    title: string | null;
    description: string | null;
    compositeScore: number;
    objectiveCategory: string | null;
    generation: number;
    mutationLineageDepth: number;
    taskCategory: string | null;
    acquiredCount: number;
    capturedAt: string;
  }

  interface DnaPayload {
    systemPromptTemplate?: string;
    toolCallSequence?: string[];
    argumentPatterns?: Record<string, unknown>;
    retryStrategy?: Record<string, unknown>;
    timingProfile?: Record<string, unknown>;
    tokenDistribution?: Record<string, unknown>;
    soulContent?: string;
    taskCategory?: string;
    agentClassAtWrite?: string;
    compositeFitnessScore?: number;
    fitnessDimensionBreakdown?: Record<string, number>;
    causalAttributionSummary?: string;
    councilVerdictSummary?: string;
    councilConfidenceScores?: {
      performance: number;
      soulAnalyst: number;
      devilsAdvocate: number;
      weighted: number;
    };
    humanConfirmationTimestamp?: string | null;
    mutationLineageOps?: string[];
    isPioneerEntry?: boolean;
    skillLoadout?: {
      equippedSkills: Array<{
        skillId: string;
        skillName: string;
        activationCount: number;
        avgEffectiveness: number;
      }>;
      conflictsDetected: Array<{
        skillId: string;
        directiveId: string;
        conflictDescription: string;
      }>;
    };
  }

  let { botId, category }: { botId: string; category: string | null } = $props();

  let entries = $state<DnaEntry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let expandedIds = $state<Set<string>>(new Set());
  let payloadMap = $state<Record<string, DnaPayload | null>>({});

  async function loadDnaPatterns() {
    if (!category) {
      loading = false;
      return;
    }

    loading = true;
    error = null;
    try {
      const res = await fetch(`/api/akasa/akashic/browse?taskCategory=${encodeURIComponent(category)}&page=1`);
      if (!res.ok) throw new Error('Failed to load DNA patterns');
      const data = await res.json() as { entries: DnaEntry[]; total: number };
      entries = data.entries;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function loadPayload(dnaId: string) {
    if (payloadMap[dnaId]) return;
    try {
      const res = await fetch(`/api/akasa/akashic/browse`);
      if (res.ok) {
        const data = await res.json() as { entries: DnaEntry[] };
        const entry = data.entries.find((e: DnaEntry) => e.id === dnaId);
        if (entry) {
          payloadMap = { ...payloadMap, [dnaId]: entry as unknown as DnaPayload };
        }
      }
    } catch { /* silent */ }
  }

  function toggleExpand(id: string) {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      loadPayload(id);
    }
    expandedIds = next;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatScore(score: number | null): string {
    if (score === null || score === undefined) return '—';
    return score.toFixed(2);
  }

  $effect(() => {
    loadDnaPatterns();
  });
</script>

<div class="dna-patterns">
  {#if !category}
    <div class="dna-empty">
      <p class="empty-heading">No category assigned</p>
      <p class="empty-body">DNA patterns will appear once this bot has a task category.</p>
    </div>
  {:else if loading}
    <div class="dna-empty">
      <p class="empty-body">Loading DNA patterns...</p>
    </div>
  {:else if error}
    <div class="dna-empty">
      <p class="empty-heading error-text">{error}</p>
    </div>
  {:else if entries.length === 0}
    <div class="dna-empty">
      <p class="empty-heading">No patterns captured</p>
      <p class="empty-body">DNA patterns from this category will appear here when captured.</p>
    </div>
  {:else}
    <div class="dna-grid">
      {#each entries as entry (entry.id)}
        <div class="dna-card">
          <div class="dna-card-header">
            <span class="dna-title">{entry.title ?? entry.id.slice(0, 8)}</span>
            <span class="dna-score" style="color: var(--bo-teal)">
              {formatScore(entry.compositeScore)}
            </span>
          </div>

          {#if entry.description}
            <p class="dna-description">{entry.description}</p>
          {/if}

          <div class="dna-meta">
            <span class="dna-meta-item">
              <span class="meta-label">Gen</span>
              <span class="meta-value">{entry.generation}</span>
            </span>
            <span class="dna-meta-item">
              <span class="meta-label">Lineage</span>
              <span class="meta-value">{entry.mutationLineageDepth} ops</span>
            </span>
            <span class="dna-meta-item">
              <span class="meta-label">Acquired</span>
              <span class="meta-value">{entry.acquiredCount}</span>
            </span>
          </div>

          <div class="dna-footer">
            <span class="dna-date">{formatDate(entry.capturedAt)}</span>
            <button class="expand-btn" onclick={() => toggleExpand(entry.id)}>
              {expandedIds.has(entry.id) ? 'Hide' : 'Details'}
            </button>
          </div>

          {#if expandedIds.has(entry.id)}
            <div class="dna-details">
              {#if entry.taskCategory}
                <div class="detail-item">
                  <span class="detail-label">Task Category</span>
                  <span class="detail-value">{entry.taskCategory}</span>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dna-patterns {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .dna-empty {
    padding: var(--space-xl);
    text-align: center;
  }

  .empty-heading {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-sm);
  }

  .empty-body {
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
  }

  .error-text {
    color: var(--bo-rose);
  }

  .dna-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-md);
  }

  .dna-card {
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .dna-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-sm);
  }

  .dna-title {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 600;
    color: var(--bo-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dna-score {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    flex-shrink: 0;
  }

  .dna-description {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-muted);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .dna-meta {
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .dna-meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .meta-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    text-transform: uppercase;
  }

  .meta-value {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-caption);
  }

  .dna-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
    padding-top: var(--space-sm);
    border-top: 1px solid var(--bo-border);
  }

  .dna-date {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-faint);
  }

  .expand-btn {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-violet);
    background: none;
    border: 1px solid var(--bo-violet);
    border-radius: var(--radius-sm);
    padding: 2px 8px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .expand-btn:hover {
    background: rgba(139, 92, 246, 0.10);
  }

  .dna-details {
    padding-top: var(--space-sm);
    border-top: 1px solid var(--bo-border);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .detail-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    text-transform: uppercase;
  }

  .detail-value {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-text);
  }
</style>
