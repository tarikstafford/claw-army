<script lang="ts">
  interface BenchmarkRow {
    id: string;
    taskCategory: string;
    pioneerBotId: string;
    baselineCompositeScore: string;
    confirmedRunCount: number;
    thinDataFlag: boolean;
    benchmarkMature: boolean;
    createdAt: string;
  }

  let { benchmark }: { benchmark: BenchmarkRow } = $props();

  const SCORE = $derived(parseFloat(benchmark.baselineCompositeScore) || 0);

  const THRESHOLD_TIERS = [
    { label: 'Novice', min: 0, max: 0.4, color: 'var(--muted)' },
    { label: 'Understudy', min: 0.4, max: 0.7, color: 'var(--accent)' },
    { label: 'Artisan', min: 0.7, max: 0.9, color: 'var(--karma)' },
    { label: 'Master', min: 0.9, max: 1.0, color: 'var(--accent-teal)' },
  ];

  const currentTier = $derived(
    THRESHOLD_TIERS.find((t) => SCORE >= t.min && SCORE < t.max) ?? THRESHOLD_TIERS[0]
  );

  const progressPercent = $derived(Math.min(100, Math.round(SCORE * 100)));

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
</script>

<div class="benchmark-card">
  <div class="card-top-row">
    <div class="category-info">
      <span class="category-name">{benchmark.taskCategory}</span>
      <span class="tier-badge" style="color: {currentTier.color}; border-color: {currentTier.color}">
        {currentTier.label}
      </span>
    </div>
    <div class="pioneer-info">
      <span class="pioneer-badge">PIONEER</span>
      <span class="pioneer-caption">{formatDate(benchmark.createdAt)}</span>
    </div>
  </div>

  <div class="score-section">
    <div class="score-header">
      <span class="score-label">Baseline Score</span>
      <span class="score-value">{SCORE.toFixed(2)}</span>
    </div>
    <div class="threshold-bar">
      <div class="threshold-track">
        <div
          class="threshold-fill"
          style="width: {progressPercent}%; background: {currentTier.color}"
        ></div>
        {#each THRESHOLD_TIERS as tier}
          <div
            class="threshold-mark"
            style="left: {tier.min * 100}%; border-color: {tier.color}"
            title="{tier.label}: {(tier.min * 100).toFixed(0)}%"
          ></div>
        {/each}
      </div>
      <div class="threshold-labels">
        <span>0</span>
        <span>0.4</span>
        <span>0.7</span>
        <span>0.9</span>
        <span>1.0</span>
      </div>
    </div>
  </div>

  <div class="card-middle-row">
    <div class="runs-block">
      <span class="runs-label">Confirmed Runs</span>
      <span class="runs-value">{benchmark.confirmedRunCount}</span>
    </div>
    {#if benchmark.benchmarkMature}
      <div class="status-block mature">
        <span class="status-tag">CONFIRMED</span>
        <span class="status-caption">Verified benchmark</span>
      </div>
    {:else if benchmark.thinDataFlag}
      <div class="status-block unverified">
        <span class="status-tag">UNVERIFIED</span>
        <span class="status-caption">&lt;3 confirmed runs</span>
      </div>
    {/if}
  </div>

  <a href="/evolution/{benchmark.pioneerBotId}" class="pioneer-link">
    <span class="pioneer-link-text">View pioneer agent</span>
    <span class="pioneer-link-id">{benchmark.pioneerBotId.slice(0, 8)}</span>
  </a>
</div>

<style>
  .benchmark-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-left: 3px solid var(--karma);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .card-top-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
  }

  .category-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .category-name {
    font-size: 13px;
    color: var(--text);
    font-family: var(--font-body);
    font-weight: 400;
  }

  .tier-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    border: 1px solid;
    padding: 2px 6px;
    border-radius: 2px;
    width: fit-content;
  }

  .pioneer-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-xs);
    flex-shrink: 0;
  }

  .pioneer-badge {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--karma);
    background: rgba(251, 191, 36, 0.10);
    border: 1px solid rgba(251, 191, 36, 0.32);
    padding: 3px 7px;
    border-radius: 3px;
    white-space: nowrap;
  }

  .pioneer-caption {
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-body);
    text-align: right;
  }

  .score-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .score-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .score-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--muted);
    text-transform: uppercase;
  }

  .score-value {
    font-size: 20px;
    font-weight: 600;
    color: var(--text);
    font-family: var(--font-display);
  }

  .threshold-bar {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .threshold-track {
    position: relative;
    height: 4px;
    background: rgba(236, 232, 255, 0.10);
    border-radius: 2px;
    overflow: visible;
  }

  .threshold-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .threshold-mark {
    position: absolute;
    top: -2px;
    width: 1px;
    height: 8px;
    border-right: 1px dashed;
    opacity: 0.4;
  }

  .threshold-labels {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 8px;
    color: var(--muted);
  }

  .card-middle-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-xl);
  }

  .runs-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .runs-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--muted);
    text-transform: uppercase;
  }

  .runs-value {
    font-size: 13px;
    color: var(--text);
    font-family: var(--font-body);
  }

  .status-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .status-tag {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    padding: 2px 6px;
    border-radius: 2px;
    width: fit-content;
  }

  .status-block.mature .status-tag {
    color: var(--accent-teal);
    background: rgba(45, 212, 191, 0.10);
    border: 1px solid rgba(45, 212, 191, 0.30);
  }

  .status-block.unverified .status-tag {
    color: var(--karma);
    background: rgba(251, 191, 36, 0.10);
    border: 1px solid rgba(251, 191, 36, 0.30);
  }

  .status-caption {
    font-size: 10px;
    color: var(--muted);
    font-family: var(--font-body);
  }

  .pioneer-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    background: rgba(124, 58, 237, 0.06);
    border: 1px solid rgba(124, 58, 237, 0.15);
    border-radius: var(--radius-sm);
    text-decoration: none;
    transition: all 0.15s ease;
    margin-top: var(--space-xs);
  }

  .pioneer-link:hover {
    background: rgba(124, 58, 237, 0.12);
    border-color: rgba(124, 58, 237, 0.30);
  }

  .pioneer-link-text {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
  }

  .pioneer-link-id {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent-m);
  }
</style>
