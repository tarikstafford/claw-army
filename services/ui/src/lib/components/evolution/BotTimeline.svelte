<script lang="ts">
  import Accordion from '$lib/components/Accordion.svelte';

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
    performanceJudgeOutput?: Record<string, unknown> | null;
    soulAnalystOutput?: Record<string, unknown> | null;
    devilsAdvocateOutput?: Record<string, unknown> | null;
  }

  let { events }: { events: TimelineEvent[] } = $props();

  const EVENT_COLORS: Record<string, string> = {
    verdict: 'var(--accent)',
    class_transition: 'var(--karma)',
    dna_capture: 'var(--accent-teal)',
  };

  const VERDICT_COLORS: Record<string, string> = {
    Promote: 'var(--accent)',
    Maintain: 'var(--text-muted)',
    Monitor: 'var(--accent-teal)',
    Demote: 'var(--accent-rose)',
    Retire: 'var(--error)',
  };

  let expandedId = $state<string | null>(null);

  function toggleExpand(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  function formatTimestamp(ts: string): string {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function renderJudgeOutput(output: Record<string, unknown>): string[] {
    if ('reasoning' in output || 'score' in output || 'recommendation' in output) {
      const parts: string[] = [];
      if (output.score !== undefined) parts.push(`Score: ${output.score}`);
      if (output.reasoning) parts.push(`Reasoning: ${output.reasoning}`);
      if (output.recommendation) parts.push(`Recommendation: ${output.recommendation}`);
      return parts;
    }
    return [JSON.stringify(output, null, 2)];
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
              style="background: {EVENT_COLORS[event.type] ?? 'var(--muted)'}"
            ></span>
          </div>
          <div class="event-content">
            <div class="event-main">
              <span class="event-summary">{event.summary}</span>
              {#if event.type === 'verdict' && event.verdictType}
                <span
                  class="verdict-badge"
                  style="color: {VERDICT_COLORS[event.verdictType] ?? 'var(--text-muted)'}"
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

            {#if event.type === 'verdict' && (event.performanceJudgeOutput || event.soulAnalystOutput || event.devilsAdvocateOutput)}
              <button class="expand-toggle" onclick={() => toggleExpand(event.id)}>
                {expandedId === event.id ? 'Hide' : 'Show'} Judge Detail
              </button>
              {#if expandedId === event.id}
                <div class="verdict-detail" style="--card: var(--card); --border: var(--border); --text-muted: var(--text-muted)">
                  {#if event.performanceJudgeOutput}
                    <Accordion label="PERFORMANCE JUDGE" color="var(--accent)">
                      {#each renderJudgeOutput(event.performanceJudgeOutput) as part}
                        <p class="judge-output">{part}</p>
                      {/each}
                    </Accordion>
                  {/if}
                  {#if event.soulAnalystOutput}
                    <Accordion label="SOUL ANALYST" color="var(--accent-teal)">
                      {#each renderJudgeOutput(event.soulAnalystOutput) as part}
                        <p class="judge-output">{part}</p>
                      {/each}
                    </Accordion>
                  {/if}
                  {#if event.devilsAdvocateOutput}
                    <Accordion label="DEVIL'S ADVOCATE" color="var(--accent-rose)">
                      {#each renderJudgeOutput(event.devilsAdvocateOutput) as part}
                        <p class="judge-output">{part}</p>
                      {/each}
                    </Accordion>
                  {/if}
                </div>
              {/if}
            {/if}
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
    color: var(--text);
    margin: 0 0 var(--space-sm);
  }

  .empty-body {
    font-size: 13px;
    color: var(--muted);
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
    background: var(--border);
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
    color: var(--text);
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
    color: var(--karma);
  }

  .dna-score {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--accent-teal);
  }

  .event-timestamp {
    font-size: 11px;
    color: var(--text-muted);
    display: block;
  }

  .expand-toggle {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--accent);
    background: none;
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 2px 8px;
    cursor: pointer;
    margin-top: var(--space-xs);
  }

  .expand-toggle:hover {
    background: rgba(124, 58, 237, 0.08);
  }

  .verdict-detail {
    margin-top: var(--space-sm);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .judge-output {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--text);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    line-height: 1.6;
  }
</style>
