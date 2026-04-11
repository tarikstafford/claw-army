<script lang="ts">
  import { goto } from '$app/navigation';
  import Button from '$lib/components/ui/Button.svelte';
  import ChipSelect from '$lib/components/onboarding/ChipSelect.svelte';
  import AgentCard from '$lib/components/onboarding/AgentCard.svelte';

  let { data } = $props();

  type Step = 'welcome' | 'q1' | 'q2' | 'q3' | 'proposal' | 'summoning' | 'complete';
  let step = $state<Step>('welcome');

  // Collected answers
  let businessType = $state('');
  let firstGoal = $state('');
  let budget = $state('');
  let error = $state('');

  // Chat messages for conversational feel
  type Message = { sender: 'indra' | 'user'; text: string };
  let messages = $state<Message[]>([
    { sender: 'indra', text: `Welcome, ${data.userName}. I'm Indra — your Chief of Staff. I'll help you assemble the right team for your business.` },
  ]);

  function addIndra(text: string) {
    messages = [...messages, { sender: 'indra', text }];
  }

  function addUser(text: string) {
    messages = [...messages, { sender: 'user', text }];
  }

  // Step transitions
  function startOnboarding() {
    addUser('Start Mode — I have an idea');
    addIndra('What kind of business are you building?');
    step = 'q1';
  }

  function answerQ1(value: string) {
    businessType = value;
    addUser(value);
    addIndra(`${value} — understood. What\'s your first goal? What do you want your team to accomplish first?`);
    step = 'q2';
  }

  function answerQ2(value: string) {
    firstGoal = value;
    addUser(value);
    addIndra('Last question — what\'s your monthly budget for AI agents?');
    step = 'q3';
  }

  function answerQ3(value: string) {
    budget = value;
    addUser(value);
    buildProposal();
  }

  // Team proposal
  const ROSTER = [
    { name: 'Mira', role: 'marketing', title: 'Marketing Strategist', archetype: 'Creative Synthesizer' },
    { name: 'Kael', role: 'sales', title: 'Sales Executor', archetype: 'Aggressive Executor' },
    { name: 'Asha', role: 'ops', title: 'Operations Analyst', archetype: 'Structured Analyst' },
  ];
  const FINANCE = { name: 'Roan', role: 'finance', title: 'Finance Auditor', archetype: 'Cautious Verifier' };

  let proposedAgents = $derived.by(() => {
    const tier = budget === '<50' ? 'haiku' : 'sonnet';
    const agents = ROSTER.map(a => ({ ...a, tier }));
    if (budget !== '<50') {
      agents.push({ ...FINANCE, tier: 'haiku' });
    }
    return agents;
  });

  function buildProposal() {
    const count = budget === '<50' ? 3 : 4;
    addIndra(`Based on your ${businessType} business and goal to ${firstGoal}, I've assembled a team of ${count} agents. Review your crew:`);
    step = 'proposal';
  }

  // Summon
  async function summonCrew() {
    step = 'summoning';
    error = '';

    try {
      const res = await fetch('/onboarding/api/summon', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessType,
          firstGoal,
          budget,
          companyName: `${businessType} Co.`,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(body || `Server error ${res.status}`);
      }

      const result = await res.json();
      addIndra(`Your crew is assembled. ${result.agents.length} agents are ready. Let me take you to your office.`);
      step = 'complete';

      setTimeout(() => {
        goto('/indra');
      }, 2000);
    } catch (e) {
      error = (e as Error).message || 'Failed to summon crew. Please try again.';
      step = 'proposal';
    }
  }
</script>

<div class="onboarding-container">
  <div class="brand-header">
    <span class="brand-name">Akasa</span>
    <span class="brand-tagline">Where agents build your business.</span>
  </div>

  <div class="chat-area">
    {#each messages as msg}
      <div class="msg {msg.sender}">
        {#if msg.sender === 'indra'}
          <span class="sender-label">INDRA</span>
        {/if}
        <div class="bubble">{msg.text}</div>
      </div>
    {/each}

    {#if step === 'summoning'}
      <div class="msg indra">
        <span class="sender-label">INDRA</span>
        <div class="bubble">
          <span class="typing">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </span>
        </div>
      </div>
    {/if}
  </div>

  <div class="input-area">
    {#if step === 'welcome'}
      <div class="action-group">
        <Button class="btn-primary" onclick={startOnboarding}>
          Start Mode — I have an idea
        </Button>
        <Button class="btn-secondary" variant="secondary" disabled>
          Connect Mode — I have a live business
          <span class="coming-soon">COMING SOON</span>
        </Button>
      </div>

    {:else if step === 'q1'}
      <ChipSelect
        options={['E-commerce', 'SaaS', 'Agency', 'Content Creator', 'Consulting']}
        allowFreeText={true}
        onselect={answerQ1}
      />

    {:else if step === 'q2'}
      <ChipSelect
        options={['Get more customers', 'Reduce costs', 'Automate operations', 'Launch a product', 'Grow revenue']}
        allowFreeText={true}
        onselect={answerQ2}
      />

    {:else if step === 'q3'}
      <ChipSelect
        options={['<50', '50-200', '200+']}
        allowFreeText={false}
        onselect={answerQ3}
      />

    {:else if step === 'proposal'}
      <div class="proposal-section">
        <div class="agent-grid">
          {#each proposedAgents as agent}
            <AgentCard
              name={agent.name}
              role={agent.role}
              title={agent.title}
              tier={agent.tier}
              archetype={agent.archetype}
            />
          {/each}
        </div>

        {#if error}
          <p class="error-msg">{error}</p>
        {/if}

        <Button class="btn-summon" onclick={summonCrew}>
          SUMMON THE CREW
        </Button>
      </div>

    {:else if step === 'summoning'}
      <p class="status-text">Assembling your team...</p>

    {:else if step === 'complete'}
      <p class="status-text">Redirecting to your office...</p>
    {/if}
  </div>
</div>

<style>
  .onboarding-container {
    width: 100%;
    max-width: 540px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .brand-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }

  .brand-name {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 600;
    color: var(--fo-plum, #3D3560);
    letter-spacing: -0.02em;
  }

  .brand-tagline {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: var(--muted, #7A766D);
    font-style: italic;
  }

  /* Chat */
  .chat-area {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 400px;
    overflow-y: auto;
    padding: 4px 0;
  }

  .msg {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-width: 88%;
  }

  .msg.user {
    align-self: flex-end;
    align-items: flex-end;
  }

  .sender-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 5px;
    color: rgba(97, 95, 160, 0.55);
    text-transform: uppercase;
    letter-spacing: 0.10em;
    margin-bottom: 1px;
  }

  .bubble {
    background: var(--fo-bg2, #EDE9E0);
    border: 1px solid rgba(14, 13, 11, 0.10);
    padding: 10px 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    line-height: 1.65;
    color: var(--ink, #0E0D0B);
    border-radius: 6px;
  }

  .msg.user .bubble {
    background: var(--fo-plum, #3D3560);
    color: #fff;
    border-color: transparent;
  }

  /* Input area */
  .input-area {
    padding-top: 8px;
    border-top: 1px solid rgba(14, 13, 11, 0.08);
  }

  .action-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .btn-primary {
    width: 100%;
  }

  .btn-secondary {
    width: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-style: dashed;
  }

  .coming-soon {
    font-family: 'Press Start 2P', monospace;
    font-size: 5px;
    color: var(--fo-gold, #B8965A);
    text-transform: uppercase;
    letter-spacing: 0.10em;
  }

  /* Proposal */
  .proposal-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .agent-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  @media (min-width: 480px) {
    .agent-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .btn-summon {
    width: 100%;
    letter-spacing: 0.06em;
  }

  .error-msg {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #DC2626;
    text-align: center;
  }

  .status-text {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: var(--muted, #7A766D);
    text-align: center;
    font-style: italic;
  }

  /* Typing indicator */
  .typing {
    display: flex;
    gap: 4px;
    padding: 2px 0;
  }

  .dot {
    width: 5px;
    height: 5px;
    background: var(--fo-plum, #3D3560);
    border-radius: 50%;
    animation: typing-bounce 1.1s infinite;
  }

  .dot:nth-child(2) { animation-delay: 0.18s; }
  .dot:nth-child(3) { animation-delay: 0.36s; }

  @keyframes typing-bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-5px); }
  }
</style>
