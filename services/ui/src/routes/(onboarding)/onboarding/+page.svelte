<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import ChipSelect from '$lib/components/onboarding/ChipSelect.svelte';
  import AgentCard from '$lib/components/onboarding/AgentCard.svelte';
  import ToolCatalog from '$lib/components/tools/ToolCatalog.svelte';

  let { data } = $props();

  type Step = 'welcome' | 'q1' | 'q2' | 'q3' | 'tool-q1' | 'tool-q2' | 'tool-q3' | 'analysing' | 'proposal' | 'summoning' | 'complete';
  let step = $state<Step>('welcome');
  type Mode = 'start' | 'connect';
  let mode = $state<Mode>('start');

  let businessType = $state('');
  let firstGoal = $state('');
  let budget = $state('');
  let error = $state('');

  type Connection = { id: string; toolId: string; status: string; lastUsedAt: string | null };
  let connections = $state<Connection[]>([]);
  let quickWins = $state<string[]>([]);
  let isLoadingConnections = $state(false);

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

  function startOnboarding() {
    mode = 'start';
    addUser('Start Mode — I have an idea');
    addIndra('What kind of business are you building?');
    step = 'q1';
  }

  function startConnectOnboarding() {
    mode = 'connect';
    addUser('Connect Mode — I have a live business');
    addIndra('What kind of business are you building?');
    step = 'tool-q1';
  }

  function answerQ1(value: string) {
    businessType = value;
    addUser(value);
    if (mode === 'start') {
      addIndra(`${value} — understood. What's your first goal? What do you want your team to accomplish first?`);
      step = 'q2';
    } else {
      addIndra(`${value} — great. Now let's connect your tools so I can give you a personalized team.`);
      loadConnections();
      step = 'tool-q2';
    }
  }

  async function loadConnections() {
    isLoadingConnections = true;
    try {
      const res = await fetch(`/api/akasa/tool-connections?userId=${encodeURIComponent(data.userId)}`);
      if (res.ok) {
        connections = await res.json();
      }
    } catch {
      connections = [];
    }
    isLoadingConnections = false;
  }

  function startOAuth(toolId: string) {
    const redirectUri = `${window.location.origin}/api/akasa/tool-connections/oauth/${toolId}/callback`;
    window.location.href = `/api/akasa/tool-connections/oauth/${toolId}/start?userId=${encodeURIComponent(data.userId)}&redirectUri=${encodeURIComponent(redirectUri)}`;
  }

  async function handleDisconnect(connectionId: string, toolName: string) {
    try {
      await fetch(`/api/akasa/tool-connections/${connectionId}`, { method: 'DELETE' });
      await loadConnections();
    } catch {
      // silently fail
    }
  }

  function proceedFromToolSelection() {
    const connectedTools = connections.filter(c => c.status === 'connected' || c.status === 'expired');
    if (connectedTools.length === 0) {
      addIndra('You haven\'t connected any tools yet. You can skip this and connect tools later, or connect at least one now.');
      return;
    }
    const toolNames = connectedTools.map(c => c.toolId).join(', ');
    addIndra(`I see you've connected ${connectedTools.length} tool${connectedTools.length > 1 ? 's' : ''} (${toolNames}). What's your main improvement goal?`);
    step = 'tool-q3';
  }

  function skipToolSelection() {
    addIndra('No problem — you can connect tools later from your Sanctum. What\'s your main improvement goal?');
    connections = [];
    step = 'tool-q3';
  }

  function answerToolQ3(value: string) {
    firstGoal = value;
    addUser(value);
    addIndra('Let me analyse your connected tools...');
    step = 'analysing';
    analyzeTools();
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

  const ROSTER = [
    { name: 'Mira', role: 'marketing', title: 'Marketing Strategist', archetype: 'Creative Synthesizer' },
    { name: 'Kael', role: 'sales', title: 'Sales Executor', archetype: 'Aggressive Executor' },
    { name: 'Asha', role: 'ops', title: 'Operations Analyst', archetype: 'Structured Analyst' },
  ];
  const FINANCE = { name: 'Roan', role: 'finance', title: 'Finance Auditor', archetype: 'Cautious Verifier' };

  const CONNECT_AGENTS: Record<string, { name: string; role: string; title: string; archetype: string }> = {
    'hubspot': { name: 'Mira', role: 'marketing', title: 'Marketing Strategist', archetype: 'Creative Synthesizer' },
    'slack': { name: 'Asha', role: 'ops', title: 'Operations Analyst', archetype: 'Structured Analyst' },
    'google-sheets': { name: 'Kael', role: 'sales', title: 'Sales Executor', archetype: 'Aggressive Executor' },
  };

  let proposedAgents = $derived.by(() => {
    const tier = budget === '<50' ? 'haiku' : 'sonnet';
    if (mode === 'connect' && connections.length > 0) {
      const connectedToolIds = connections.filter(c => c.status === 'connected' || c.status === 'expired').map(c => c.toolId);
      const agents: Array<{ name: string; role: string; title: string; archetype: string; tier: string }> = [];
      const seenRoles = new Set<string>();

      for (const toolId of connectedToolIds) {
        const agent = CONNECT_AGENTS[toolId];
        if (agent && !seenRoles.has(agent.role)) {
          seenRoles.add(agent.role);
          agents.push({ ...agent, tier });
        }
      }

      for (const a of ROSTER) {
        if (!seenRoles.has(a.role)) {
          seenRoles.add(a.role);
          agents.push({ ...a, tier });
        }
      }

      if (budget !== '<50' && !seenRoles.has('finance')) {
        agents.push({ ...FINANCE, tier: 'haiku' });
      }

      return agents;
    }

    const agents = ROSTER.map(a => ({ ...a, tier }));
    if (budget !== '<50') {
      agents.push({ ...FINANCE, tier: 'haiku' });
    }
    return agents;
  });

  function analyzeTools() {
    const connectedToolIds = connections.filter(c => c.status === 'connected' || c.status === 'expired').map(c => c.toolId);
    quickWins = [];

    if (connectedToolIds.includes('hubspot')) {
      quickWins.push('Found contact and deal data in HubSpot — Kael can prioritise hot leads');
    }
    if (connectedToolIds.includes('slack')) {
      quickWins.push('Slack channels detected — Asha can set up automated standups');
    }
    if (connectedToolIds.includes('google-sheets')) {
      quickWins.push('Spreadsheet data available — real-time metrics dashboard can be built');
    }

    setTimeout(() => {
      buildProposal();
    }, 2000);
  }

  function buildProposal() {
    const connectedCount = connections.filter(c => c.status === 'connected' || c.status === 'expired').length;
    const agentCount = proposedAgents.length;

    if (mode === 'connect' && connectedCount > 0) {
      let proposalText = `Based on your ${businessType} business, the ${connectedCount} connected tool${connectedCount > 1 ? 's' : ''}, and your goal to ${firstGoal}, I've assembled a data-informed team of ${agentCount} agents.`;
      if (quickWins.length > 0) {
        proposalText += ` Quick wins I spotted:`;
        addIndra(proposalText);
        quickWins.forEach(win => addIndra(`• ${win}`));
      } else {
        addIndra(proposalText);
      }
      addIndra('Review your crew:');
    } else {
      const count = budget === '<50' ? 3 : 4;
      addIndra(`Based on your ${businessType} business and goal to ${firstGoal}, I've assembled a team of ${count} agents. Review your crew:`);
    }
    step = 'proposal';
  }

  async function summonCrew() {
    step = 'summoning';
    error = '';

    const connectedToolConnections = connections
      .filter(c => c.status === 'connected' || c.status === 'expired')
      .map(c => ({ toolId: c.toolId, connectionId: c.id }));

    try {
      const res = await fetch('/onboarding/api/summon', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessType,
          firstGoal,
          budget,
          companyName: `${businessType} Co.`,
          toolConnections: connectedToolConnections,
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

  onMount(() => {
    const url = $page.url;
    const connected = url.searchParams.get('connected');
    if (connected) {
      loadConnections().then(() => {
        if (step === 'tool-q2') {
          addIndra(`Connected to ${connected}! You can connect more tools or continue.`);
        }
      });
    }
  });
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

    {#if step === 'summoning' || step === 'analysing'}
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
        <button class="btn-connect-mode" type="button" onclick={startConnectOnboarding}>
          <span class="btn-label">Connect Mode — I have a live business</span>
          <span class="btn-badge">FASTER PATH</span>
        </button>
        <button class="btn-start-mode" type="button" onclick={startOnboarding}>
          Start Mode — I have an idea
        </button>
      </div>

    {:else if step === 'q1' || step === 'tool-q1'}
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

    {:else if step === 'tool-q2'}
      <div class="tool-selection">
        {#if isLoadingConnections}
          <p class="loading-text">Loading your tools...</p>
        {:else}
          <ToolCatalog
            {connections}
            onconnect={startOAuth}
            ondisconnect={handleDisconnect}
          />
          <div class="tool-actions">
            <button class="btn-skip" type="button" onclick={skipToolSelection}>
              Skip for now
            </button>
            <button class="btn-proceed" type="button" onclick={proceedFromToolSelection}>
              Continue with these tools
            </button>
          </div>
        {/if}
      </div>

    {:else if step === 'tool-q3'}
      <ChipSelect
        options={['Get more customers', 'Reduce costs', 'Automate operations', 'Launch a product', 'Grow revenue']}
        allowFreeText={true}
        onselect={answerToolQ3}
      />

    {:else if step === 'q3'}
      <ChipSelect
        options={['<50', '50-200', '200+']}
        allowFreeText={false}
        onselect={answerQ3}
      />

    {:else if step === 'analysing'}
      <p class="status-text">Analysing your connected tools...</p>

    {:else if step === 'proposal'}
      <div class="proposal-section">
        {#if quickWins.length > 0}
          <div class="quick-wins">
            <span class="quick-wins-label">QUICK WINS</span>
            {#each quickWins as win}
              <p class="quick-win-item">{win}</p>
            {/each}
          </div>
        {/if}
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

        <button class="btn-summon" type="button" onclick={summonCrew}>
          SUMMON THE CREW
        </button>
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
    font-family: 'Cormorant Garamond', serif;
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

  .input-area {
    padding-top: 8px;
    border-top: 1px solid rgba(14, 13, 11, 0.08);
  }

  .action-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .btn-connect-mode {
    width: 100%;
    padding: 16px 24px;
    background: var(--fo-plum, #3D3560);
    color: #fff;
    border: 2px solid var(--fo-plum, #3D3560);
    border-radius: 6px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .btn-connect-mode:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(61, 53, 96, 0.4);
  }

  .btn-badge {
    font-family: 'Press Start 2P', monospace;
    font-size: 5px;
    background: var(--fo-gold, #B8965A);
    color: #fff;
    padding: 4px 8px;
    border-radius: 2px;
    letter-spacing: 0.08em;
  }

  .btn-start-mode {
    width: 100%;
    padding: 14px 24px;
    background: transparent;
    color: var(--ink, #0E0D0B);
    border: 1px dashed var(--fo-border, #D9CEBB);
    border-radius: 6px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: 0.02em;
  }

  .btn-start-mode:hover {
    border-color: var(--fo-plum, #3D3560);
    color: var(--fo-plum, #3D3560);
  }

  .tool-selection {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .loading-text {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: var(--muted, #7A766D);
    text-align: center;
    font-style: italic;
  }

  .tool-actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }

  .btn-skip {
    flex: 1;
    padding: 12px 16px;
    background: transparent;
    color: var(--muted, #7A766D);
    border: 1px dashed var(--fo-border, #D9CEBB);
    border-radius: 6px;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-skip:hover {
    border-color: var(--fo-plum, #3D3560);
    color: var(--fo-plum, #3D3560);
  }

  .btn-proceed {
    flex: 2;
    padding: 12px 16px;
    background: var(--fo-plum, #3D3560);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .btn-proceed:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(61, 53, 96, 0.3);
  }

  .quick-wins {
    background: rgba(184, 150, 90, 0.08);
    border: 1px solid var(--fo-gold, #B8965A);
    border-radius: 6px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .quick-wins-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 5px;
    color: var(--fo-gold, #B8965A);
    text-transform: uppercase;
    letter-spacing: 0.10em;
    margin-bottom: 4px;
  }

  .quick-win-item {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    color: var(--ink, #0E0D0B);
    line-height: 1.5;
    margin: 0;
  }

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
    padding: 16px 24px;
    background: var(--fo-plum, #3D3560);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.06em;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .btn-summon:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(61, 53, 96, 0.35);
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