<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getSoulDetail } from '$lib/api';
  import type { SoulDetail } from '$lib/types';
  import SoulTierBadge from '$lib/components/SoulTierBadge.svelte';

  const soulId = $derived((page.params as Record<string, string>).id ?? '');

  let soul = $state<SoulDetail | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!browser) return;
    const id = soulId;
    if (!id) return;

    loading = true;
    error = null;

    getSoulDetail(id)
      .then(s => { soul = s; loading = false; })
      .catch(err => { error = (err as Error).message; loading = false; });
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

  const DIMENSION_TAGS: Record<string, string> = {
    identityRole: 'IR',
    decisionPriorities: 'DP',
    toolUsageDoctrine: 'TU',
    riskTolerance: 'RT',
    communicationStyle: 'CS',
    recoveryBehavior: 'RB',
    ethicalHardStops: 'EH',
  };

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<svelte:head>
  <title>{soul?.archetypeName ?? 'Soul'} {soulId.slice(0, 8)} | Akasa</title>
</svelte:head>

<div class="page">
  <!-- Header -->
  <div class="page-header">
    <a href="/souls" class="back-link">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Soul Library
    </a>
    <div class="sec-label">Soul Detail</div>
    <h1>
      {#if soul?.isArchetype && soul.archetypeName}
        {soul.archetypeName}
      {:else}
        <code class="soul-id">{soulId.slice(0, 8)}</code>
      {/if}
    </h1>
  </div>

  {#if loading}
    <div class="loading">Loading soul...</div>
  {:else if error}
    <div class="error-card">{error}</div>
  {:else if soul}
    <!-- Identity strip -->
    <div class="identity-strip">
      <div class="identity-left">
        {#if soul.isArchetype}
          <span class="tag tag-violet">Archetype</span>
        {/if}
        {#if soul.taskCategory}
          <span class="tag tag-default">{soul.taskCategory}</span>
        {/if}
        <SoulTierBadge agentClass={soul.agentClass} />
        <span class="gen-label">Gen {soul.generation}</span>
      </div>
      <div class="identity-right">
        {#if soul.compositeScore != null}
          <span class="score-label">Score</span>
          <span class="score-value">{soul.compositeScore.toFixed(2)}</span>
        {/if}
      </div>
    </div>

    <!-- Meta row -->
    <div class="meta-grid">
      <div class="meta-cell">
        <span class="meta-value">{soulId.slice(0, 12)}</span>
        <span class="meta-label">Soul ID</span>
      </div>
      {#if soul.botId}
        <div class="meta-cell">
          <span class="meta-value">{soul.botId.slice(0, 12)}</span>
          <span class="meta-label">Bot ID</span>
        </div>
      {/if}
      {#if soul.executionId}
        <div class="meta-cell">
          <a href="/executions/{soul.executionId}" class="meta-link">{soul.executionId.slice(0, 12)}</a>
          <span class="meta-label">Execution</span>
        </div>
      {/if}
      {#if soul.parentSoulId}
        <div class="meta-cell">
          <a href="/souls/{soul.parentSoulId}" class="meta-link">{soul.parentSoulId.slice(0, 12)}</a>
          <span class="meta-label">Parent Soul</span>
        </div>
      {/if}
      <div class="meta-cell">
        <span class="meta-value">{formatDate(soul.createdAt)}</span>
        <span class="meta-label">Created</span>
      </div>
    </div>

    <!-- Behavioral Dimensions -->
    <section class="section">
      <h2>Behavioral Dimensions</h2>
      <div class="dimensions">
        {#each Object.entries(soul.dimensions) as [key, value]}
          <div class="dimension-card">
            <div class="dimension-header">
              <span class="dimension-tag">{DIMENSION_TAGS[key] ?? key.slice(0, 2).toUpperCase()}</span>
              <span class="dimension-name">{DIMENSION_LABELS[key] ?? key}</span>
            </div>
            <p class="dimension-content">{value}</p>
          </div>
        {/each}
      </div>
    </section>

    <!-- Constitution Directives -->
    {#if soul.constitutionDirectives && soul.constitutionDirectives.length > 0}
      <section class="section">
        <h2>Constitution Directives</h2>
        <div class="directives">
          {#each soul.constitutionDirectives as directive, i}
            <div class="directive-row">
              <span class="directive-num">{String(i + 1).padStart(2, '0')}</span>
              <span class="directive-text">{directive}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <!-- Raw Soul Content -->
    <section class="section">
      <details class="raw-outer">
        <summary class="raw-summary">
          Raw SOUL.md ({soul.soulContent.length.toLocaleString()} chars)
        </summary>
        <pre class="raw-content">{soul.soulContent}</pre>
      </details>
    </section>
  {/if}
</div>

<style>
  .page {
    max-width: 900px;
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

  .soul-id {
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
    font-size: 0.875rem;
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

  /* ── Identity strip ───────────────────────────── */
  .identity-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px var(--space-lg);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
  }

  .identity-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .identity-right {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
  }

  .tag {
    display: inline-block;
    padding: 3px 12px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .tag-violet {
    background: var(--accent-dim);
    color: var(--accent-m);
  }

  .tag-default {
    background: var(--bg3);
    color: var(--text-muted);
  }

  .gen-label {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    color: var(--bo-faint);
    letter-spacing: 0.06em;
  }

  .score-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--bo-faint);
  }

  .score-value {
    font-family: var(--font-mono);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text);
  }

  /* ── Meta grid ────────────────────────────────── */
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: var(--space-2xl);
  }

  .meta-cell {
    background: var(--card);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .meta-value {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--text-muted);
  }

  .meta-link {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--accent-m);
    text-decoration: none;
  }

  .meta-link:hover {
    text-decoration: underline;
  }

  .meta-label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--bo-faint);
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

  /* ── Dimensions ───────────────────────────────── */
  .dimensions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .dimension-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 16px var(--space-lg);
  }

  .dimension-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .dimension-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 20px;
    border-radius: 3px;
    background: var(--accent-dim);
    color: var(--accent-m);
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }

  .dimension-name {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .dimension-content {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 300;
    color: var(--text-muted);
    line-height: 1.65;
    white-space: pre-line;
  }

  /* ── Directives ───────────────────────────────── */
  .directives {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .directive-row {
    display: flex;
    gap: 16px;
    padding: 12px var(--space-lg);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .directive-num {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--accent-m);
    flex-shrink: 0;
    min-width: 1.5rem;
  }

  .directive-text {
    font-size: 0.875rem;
    font-weight: 300;
    color: var(--text-muted);
    line-height: 1.55;
  }

  /* ── Raw content ──────────────────────────────── */
  .raw-outer {
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }

  .raw-summary {
    padding: 12px var(--space-lg);
    background: var(--bg3);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text);
    user-select: none;
    list-style: none;
  }

  .raw-summary::-webkit-details-marker {
    display: none;
  }

  .raw-summary::before {
    content: '+ ';
    font-weight: 700;
    color: var(--accent-m);
  }

  details[open] > .raw-summary::before {
    content: '- ';
  }

  .raw-content {
    max-height: 600px;
    overflow-y: auto;
    padding: 16px var(--space-lg);
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.6;
    color: var(--text-muted);
    background: var(--card);
    border-top: 1px solid var(--border);
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
