<script lang="ts">
  let { agentClass }: { agentClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null } = $props();
</script>

{#if agentClass}
  <span class="tier-badge tier-{agentClass.toLowerCase()}">
    {#if agentClass === 'Artisan'}
      <span class="pip"></span>
    {/if}
    {agentClass}
  </span>
{/if}

<style>
  .tier-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .tier-novice     { color: var(--text-muted);  background: rgba(236,232,255,0.05); border: 1px solid var(--border); }
  .tier-understudy { color: var(--bo-teal);        background: rgba(45, 212, 191, 0.10);        border: 1px solid rgba(45,212,191,0.2); }
  .tier-artisan    { color: var(--karma);       background: rgba(251, 191, 36, 0.10);       border: 1px solid rgba(251,191,36,0.2); }
  .tier-retired    { color: var(--bo-rose);        background: rgba(244, 114, 182, 0.08);        border: 1px solid rgba(244,114,182,0.15); }

  .pip {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--karma);
    flex-shrink: 0;
    animation: breathe 2.5s ease-in-out infinite;
  }
</style>
