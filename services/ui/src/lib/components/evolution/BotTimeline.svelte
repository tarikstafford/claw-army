<script lang="ts">
  interface TimelineEvent {
    id: string;
    type: 'verdict' | 'class_transition' | 'dna_capture';
    timestamp: string;
    summary: string;
    verdictType?: string;
    status?: string;
    newClass?: string;
    previousClass?: string;
    compositeScore?: string;
  }

  let { events }: { events: TimelineEvent[] } = $props();

  const EVENT_COLORS: Record<string, string> = {
    verdict: 'var(--bo-violet)',
    class_transition: 'var(--bo-amber)',
    dna_capture: 'var(--bo-teal)',
  };

  const VERDICT_COLORS: Record<string, string> = {
    Promote: 'var(--bo-violet)',
    Maintain: 'var(--bo-muted)',
    Monitor: 'var(--bo-teal)',
    Demote: 'var(--bo-rose)',
    Retire: 'var(--error)',
  };

  function formatTimestamp(ts: string): string {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

{#if events.length === 0}
  <div class="timeline-empty">
    <p class="empty-heading">No events recorded</p>
    <p class="empty-body">This agent has not completed a council evaluation yet.</p>
  </div>
{:else}
  <div class="timeline-container">
    <ul class="timeline-list" role="list">
      {#each events as event (event.id)}
        <li class="timeline-item">
          <div class="timeline-track">
            <span
              class="event-dot"
              style="background: {EVENT_COLORS[event.type] ?? 'var(--bo-faint)'}"
            ></span>
          </div>
          <div class="event-content">
            <div class="event-main">
              <span class="event-summary">{event.summary}</span>
              {#if event.type === 'verdict' && event.verdictType}
                <span
                  class="verdict-badge"
                  style="color: {VERDICT_COLORS[event.verdictType] ?? 'var(--bo-muted)'}"
                >
                  {event.verdictType.toUpperCase()}
                </span>
              {/if}
              {#if event.type === 'class_transition' && event.newClass}
                <span class="class-transition-text">Class → {event.newClass.toUpperCase()}</span>
              {/if}
              {#if event.type === 'dna_capture' && event.compositeScore}
                <span class="dna-score">DNA Captured · {parseFloat(event.compositeScore).toFixed(2)}</span>
              {/if}
            </div>
            <span class="event-timestamp">{formatTimestamp(event.timestamp)}</span>
          </div>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .timeline-empty {
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

  .timeline-container {
    position: relative;
  }

  .timeline-list {
    list-style: none;
    margin: 0;
    padding: 0;
    position: relative;
  }

  /* Vertical track line */
  .timeline-list::before {
    content: '';
    position: absolute;
    left: 7px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--bo-border);
  }

  .timeline-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-md) var(--space-md) 0;
    transition: background 0.15s ease;
    border-radius: var(--radius-md);
  }

  .timeline-item:hover {
    background: rgba(236, 232, 255, 0.04);
  }

  .timeline-track {
    position: relative;
    flex-shrink: 0;
    width: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-top: 2px;
  }

  .event-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }

  .event-content {
    flex: 1;
    min-width: 0;
  }

  .event-main {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-sm);
    margin-bottom: var(--space-xs);
  }

  .event-summary {
    font-size: 13px;
    color: var(--bo-text);
    font-family: var(--font-body);
  }

  .verdict-badge {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    padding: 2px 6px;
    border-radius: 3px;
    background: rgba(124, 58, 237, 0.08);
    border: 1px solid rgba(124, 58, 237, 0.24);
  }

  .class-transition-text {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-amber);
  }

  .dna-score {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-teal);
  }

  .event-timestamp {
    font-size: 11px;
    color: var(--bo-caption);
    display: block;
  }
</style>
