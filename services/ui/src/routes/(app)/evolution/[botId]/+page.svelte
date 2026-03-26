<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="bot-detail-page">
  <a href="/evolution/agents" class="back-link">← Back to Fleet</a>
  <h1 class="page-title">Bot <span class="bot-id">{data.botId.slice(0, 8)}</span></h1>

  <section class="detail-section">
    <h2 class="section-title">Soul Lineage</h2>
    {#if data.lineage.length === 0}
      <p class="placeholder">No lineage data available.</p>
    {:else}
      <div class="lineage-chain">
        {#each data.lineage as node, i}
          <div class="lineage-node">
            <span class="node-label">{node.label}</span>
            <span class="node-gen">Gen {node.generation}</span>
            {#if node.isArchetype}
              <span class="archetype-badge">ARCHETYPE</span>
            {/if}
          </div>
          {#if i < data.lineage.length - 1}
            <span class="chain-arrow">→</span>
          {/if}
        {/each}
      </div>
    {/if}
  </section>

  <section class="detail-section">
    <h2 class="section-title">Evolution Timeline</h2>
    {#if data.timeline.length === 0}
      <p class="placeholder">No timeline events yet.</p>
    {:else}
      <div class="timeline-list">
        {#each data.timeline as event}
          <div class="timeline-event type-{event.type}">
            <span class="event-type">{event.type.replace('_', ' ')}</span>
            <span class="event-summary">{event.summary}</span>
            <span class="event-time">{new Date(event.timestamp).toLocaleDateString()}</span>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="detail-section">
    <h2 class="section-title">Experiment Ledger</h2>
    {#if data.ledger.length === 0}
      <p class="placeholder">No runs recorded yet.</p>
    {:else}
      <table class="ledger-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Verdict</th>
            <th>Score</th>
            <th>Delta</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {#each data.ledger as row}
            <tr>
              <td>{new Date(row.executionDate).toLocaleDateString()}</td>
              <td>{row.verdictType}</td>
              <td>{parseFloat(row.compositeScore).toFixed(2)}</td>
              <td>{row.scoreDelta !== null ? (parseFloat(row.scoreDelta) >= 0 ? '+' : '') + row.scoreDelta : '—'}</td>
              <td class="outcome-{row.keepDiscard}">{row.keepDiscard}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
</div>

<style>
  .bot-detail-page {
    max-width: 900px;
  }

  .back-link {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    text-decoration: none;
    display: inline-block;
    margin-bottom: var(--space-md);
    transition: color 0.15s ease;
  }

  .back-link:hover {
    color: var(--bo-text);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-xl);
  }

  .bot-id {
    font-family: var(--font-mono);
    color: var(--bo-violet);
  }

  .detail-section {
    margin-bottom: var(--space-2xl);
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-md);
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--bo-border);
  }

  .placeholder {
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
  }

  .lineage-chain {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  .lineage-node {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
  }

  .node-label {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--bo-text);
  }

  .node-gen {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
  }

  .archetype-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-amber);
    border: 1px solid var(--bo-amber);
    padding: 1px 4px;
    border-radius: 2px;
  }

  .chain-arrow {
    color: var(--bo-faint);
    font-size: 14px;
  }

  .timeline-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .timeline-event {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
  }

  .event-type {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-violet);
    text-transform: uppercase;
    flex-shrink: 0;
    min-width: 120px;
  }

  .type-class_transition .event-type { color: var(--bo-amber); }
  .type-dna_capture .event-type { color: var(--bo-rose, #f43f5e); }

  .event-summary {
    font-size: 13px;
    color: var(--bo-text);
    flex: 1;
  }

  .event-time {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--bo-faint);
    flex-shrink: 0;
  }

  .ledger-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .ledger-table th {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-faint);
    text-align: left;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--bo-border);
  }

  .ledger-table td {
    color: var(--bo-text);
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .outcome-keep    { color: var(--bo-violet); }
  .outcome-discard { color: var(--bo-rose, #f43f5e); }
  .outcome-pending { color: var(--bo-faint); }
</style>
