<script lang="ts">
  let { agentClass }: { agentClass: 'Novice' | 'Understudy' | 'Artisan' | 'Retired' | null } = $props();
</script>

{#if agentClass}
  <span class="tier-badge tier-{agentClass.toLowerCase()}">{agentClass}</span>
{/if}

<style>
  .tier-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.025em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .tier-novice    { color: #3b82f6; background: #eff6ff; border: 1px solid #bfdbfe; }
  .tier-understudy { color: #8b5cf6; background: #f5f3ff; border: 1px solid #ddd6fe; }
  .tier-artisan   { color: #d97706; background: #fffbeb; border: 1px solid #fde68a; }
  .tier-retired   { color: #6b7280; background: #f3f4f6; border: 1px solid #e5e7eb; }
</style>
