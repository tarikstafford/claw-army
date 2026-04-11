<script lang="ts">
  let { name, role, title, tier, archetype }: {
    name: string;
    role: string;
    title: string;
    tier: string;
    archetype: string;
  } = $props();

  const tierLabel = tier === 'haiku' ? 'HAIKU' : tier === 'sonnet' ? 'SONNET' : 'OPUS';
  const tierClass = tier === 'haiku' ? 'tier-haiku' : tier === 'sonnet' ? 'tier-sonnet' : 'tier-opus';
</script>

<div class="agent-card">
  <div class="card-header">
    <span class="agent-name">{name}</span>
    <span class="tier-badge {tierClass}">{tierLabel}</span>
  </div>
  <span class="agent-title">{title}</span>
  <div class="card-meta">
    <span class="role-label">{role}</span>
    <span class="archetype-label">{archetype}</span>
  </div>
</div>

<style>
  .agent-card {
    background: var(--fo-card, #FDFAF6);
    border: 1px solid var(--fo-border, #D9CEBB);
    border-radius: 6px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color 0.2s, transform 0.15s;
  }

  .agent-card:hover {
    border-color: var(--fo-plum, #3D3560);
    transform: translateY(-2px);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .agent-name {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    color: var(--ink, #0E0D0B);
    letter-spacing: -0.01em;
  }

  .agent-title {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: var(--muted, #7A766D);
    font-style: italic;
  }

  .card-meta {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .role-label, .archetype-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 5px;
    text-transform: uppercase;
    letter-spacing: 0.10em;
    color: var(--muted, #7A766D);
  }

  .archetype-label {
    opacity: 0.7;
  }

  .tier-badge {
    font-family: 'Press Start 2P', monospace;
    font-size: 5px;
    padding: 3px 7px;
    border-radius: 2px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .tier-haiku {
    background: rgba(59, 130, 246, 0.12);
    color: #3B82F6;
    border: 1px solid rgba(59, 130, 246, 0.30);
  }

  .tier-sonnet {
    background: rgba(139, 92, 246, 0.12);
    color: #8B5CF6;
    border: 1px solid rgba(139, 92, 246, 0.30);
  }

  .tier-opus {
    background: rgba(217, 119, 6, 0.12);
    color: #D97706;
    border: 1px solid rgba(217, 119, 6, 0.30);
  }
</style>
