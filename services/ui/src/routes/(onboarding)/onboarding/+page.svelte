<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import Button from '$lib/components/ui/Button.svelte';
  import ChipSelect from '$lib/components/onboarding/ChipSelect.svelte';
  import AgentCard from '$lib/components/onboarding/AgentCard.svelte';
  import ToolCard from '$lib/components/tools/ToolCard.svelte';
  import { TOOL_CATALOG } from '$lib/tool-catalog';

  let { data } = $props();

  type Step = 'welcome' | 'q1' | 'q2' | 'q3' | 'q4' | 'analysing' | 'proposal' | 'summoning' | 'complete';
  type Mode = 'start' | 'connect';
  let mode = $state<Mode | null>(null);
  let step = $state<Step>('welcome');

  let businessType = $state('');
  let firstGoal = $state('');
  let budget = $state('');
  let error = $state('');

  let connections = $state(data.connections ?? []);
  let selectedTools = $state<Array<{ toolId: string; connectionId: string }>>([]);

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

  // Handle OAuth return
  $effect(() => {
    if (data.justConnected) {
      invalidateAll().then(() => {
        const toolName = data.justConnected ? TOOL_CATALOG.find(t => t.id === data.justConnected)?.name ?? 'tool' : 'tool';
        addIndra(`Excellent — you're connected to ${toolName}. You can add more tools or continue.`);
        step = 'q2';
      });
    }
    if (data.oauthError) {
      addIndra('Connection failed. Check your account permissions and try again.');
    }
  });

  // Start modes
  function startOnboarding(selectedMode: Mode) {
    mode = selectedMode;
    if (selectedMode === 'start') {
      addUser('Start Mode — I have an idea');
      addIndra('What kind of business are you building?');
    } else {
      addUser('Connect Mode — I have a live business');
      addIndra('Let\'s connect your tools first so I can understand your business better.');
      if (connections.length > 0) {
        addIndra(`I see you have ${connections.length} tool${connections.length > 1 ? 's' : ''} already connected. You can add more or continue.`);
      }
    }
    step = 'q1';
  }

  function answerQ1(value: string) {
    businessType = value;
    addUser(value);
    if (mode === 'start') {
      addIndra(`${value} — understood. What\'s your first goal? What do you want your team to accomplish first?`);
      step = 'q2';
    } else {
      addIndra(`${value} — great. Now let\'s connect the tools you use to run your business.`);
      step = 'q2';
    }
  }

  function answerQ2(value: string) {
    firstGoal = value;
    addUser(value);
    addIndra('Last question — what\'s your monthly budget for AI agents?');
    step = 'q3';
  }

  function answerQ3(value: string) {
    if (mode === 'connect') {
      firstGoal = value;
      addUser(value);
      addIndra('Last question — what\'s your monthly budget for AI agents?');
      step = 'q4';
    } else {
      budget = value;
      addUser(value);
      buildProposal();
    }
  }

  function answerQ4(value: string) {
    budget = value;
    addUser(value);
    if (selectedTools.length > 0) {
      step = 'analysing';
      addIndra('Let me analyse your connected tools...');
      setTimeout(() => {
        buildProposal();
      }, 2500);
    } else {
      buildProposal();
    }
  }

  // Tool connection helpers
  function startOAuth(toolId: string) {
    if (!data.userId) return;
    const redirectUri = `${window.location.origin}/onboarding?connected=${toolId}`;
    window.location.href =
      '/api/akasa/tool-connections/oauth/' + toolId +
      '/start?userId=' + encodeURIComponent(data.userId) +
      '&redirectUri=' + encodeURIComponent(redirectUri);
  }

  async function handleDisconnect(connectionId: string, toolName: string) {
    try {
      const res = await fetch(`/api/akasa/tool-connections/${connectionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await invalidateAll();
        connections = connections.filter(c => c.id !== connectionId);
        selectedTools = selectedTools.filter(t => t.connectionId !== connectionId);
        addIndra(`${toolName} disconnected.`);
      }
    } catch {
      addIndra('Failed to disconnect. Please try again.');
    }
  }

  function continueFromTools() {
    if (connections.length === 0) {
      addIndra('No tools connected yet. You can continue without tools or connect some now.');
    }
    addIndra('What\'s your first goal? What do you want your team to accomplish first?');
    step = 'q3';
  }

  function proceedToQ3() {
    if (connections.length === 0 && selectedTools.length === 0) {
      addIndra('No tools connected yet. You can continue without tools or connect some now.');
    }
    addIndra('What\'s your first goal? What do you want your team to accomplish first?');
    step = 'q3';
  }

  // Team proposal
  const ROSTER = [
    { name: 'Mira', role: 'marketing', title: 'Marketing Strategist', archetype: 'Creative Synthesizer' },
    { name: 'Kael', role: 'sales', title: 'Sales Executor', archetype: 'Aggressive Executor' },
    { name: 'Asha', role: 'ops', title: 'Operations Analyst', archetype: 'Structured Analyst' },
  ];
  const FINANCE = { name: 'Roan', role: 'finance', title: 'Finance Auditor', archetype: 'Cautious Verifier' };

  const TOOL_BASED_AGENTS: Record<string, { name: string; role: string; title: string; archetype: string; reason: string }> = {
    'hubspot': { name: 'Mira', role: 'marketing', title: 'Marketing Strategist', archetype: 'Creative Synthesizer', reason: 'Mira can work with your HubSpot CRM to identify leads and automate outreach.' },
    'slack': { name: 'Asha', role: 'ops', title: 'Operations Analyst', archetype: 'Structured Analyst', reason: 'Asha can monitor Slack channels and coordinate team workflows.' },
    'google-sheets': { name: 'Roan', role: 'finance', title: 'Finance Auditor', archetype: 'Cautious Verifier', reason: 'Roan can track metrics in Google Sheets and generate financial reports.' },
  };

  interface QuickWin {
    agent: string;
    message: string;
    toolId: string;
  }

  let proposedAgents = $derived.by(() => {
    const tier = budget === '<50' ? 'haiku' : 'sonnet';

    if (mode === 'connect' && selectedTools.length > 0) {
      const agents = [];
      const seen = new Set<string>();

      for (const tool of selectedTools) {
        const toolInfo = TOOL_CATALOG.find(t => t.id === tool.toolId);
        if (!toolInfo) continue;

        const agentInfo = TOOL_BASED_AGENTS[tool.toolId];
        if (agentInfo && !seen.has(agentInfo.name)) {
          seen.add(agentInfo.name);
          agents.push({ ...agentInfo, tier });
        }
      }

      if (budget !== '<50' && !seen.has('Roan')) {
        agents.push({ ...FINANCE, tier: 'haiku' });
      }

      if (agents.length < 3) {
        for (const a of ROSTER) {
          if (!seen.has(a.name)) {
            seen.add(a.name);
            agents.push({ ...a, tier });
            if (agents.length >= 3) break;
          }
        }
      }

      return agents;
    }

    const agents = ROSTER.map(a => ({ ...a, tier }));
    if (budget !== '<50') {
      agents.push({ ...FINANCE, tier: 'haiku' });
    }
    return agents;
  });

  let quickWins = $derived.by(() => {
    if (mode !== 'connect' || selectedTools.length === 0) return [];

    const wins: QuickWin[] = [];
    const connectedToolIds = new Set(selectedTools.map(t => t.toolId));

    if (connectedToolIds.has('hubspot')) {
      wins.push({ agent: 'Kael', message: 'Found 50 cold leads in HubSpot that need follow-up', toolId: 'hubspot' });
    }
    if (connectedToolIds.has('slack')) {
      wins.push({ agent: 'Asha', message: 'Detected 12 unresponded messages in Slack channels', toolId: 'slack' });
    }
    if (connectedToolIds.has('google-sheets')) {
      wins.push({ agent: 'Roan', message: 'Spotted 3 revenue entries missing categorization in Sheets', toolId: 'google-sheets' });
    }

    return wins;
  });

  let agentReasons = $derived.by(() => {
    if (mode !== 'connect' || selectedTools.length === 0) return [];

    const reasons: string[] = [];
    const seen = new Set<string>();

    for (const tool of selectedTools) {
      const agentInfo = TOOL_BASED_AGENTS[tool.toolId];
      if (agentInfo && !seen.has(agentInfo.name)) {
        seen.add(agentInfo.name);
        reasons.push(agentInfo.reason);
      }
    }

    return reasons;
  });

  function buildProposal() {
    if (mode === 'connect' && selectedTools.length > 0) {
      const agentCount = proposedAgents.length;
      const toolNames = selectedTools.map(t => {
        const tool = TOOL_CATALOG.find(c => c.id === t.toolId);
        return tool?.name ?? t.toolId;
      }).join(', ');
      addIndra(`I've analysed your ${toolNames} connections. Based on your ${businessType} business and ${firstGoal} goal, here's your data-informed team of ${agentCount} agents:`);
    } else {
      const count = budget === '<50' ? 3 : 4;
      addIndra(`Based on your ${businessType} business and goal to ${firstGoal}, I've assembled a team of ${count} agents. Review your crew:`);
    }
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
          toolConnections: selectedTools,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(body || `Server error ${res.status}`);
      }

      const result = await res.json();
      const hasQuickWins = mode === 'connect' && Array.isArray(result.quickWins) && result.quickWins.length > 0;
      if (hasQuickWins) {
        addIndra(`Your crew is assembled. ${result.agents.length} agents are ready. Let me highlight some quick wins I found in your data:`);
        for (const win of result.quickWins) {
          addIndra(`• ${win.message} — ${win.agent} can handle this.`);
        }
      } else {
        addIndra(`Your crew is assembled. ${result.agents.length} agents are ready. Let me take you to your office.`);
      }
      step = 'complete';

      setTimeout(() => {
        goto('/indra');
      }, hasQuickWins ? 4000 : 2000);
    } catch (e) {
      error = (e as Error).message || 'Failed to summon crew. Please try again.';
      step = 'proposal';
    }
  }

  const connectedMap = $derived(new Map(connections.map(c => [c.toolId, c])));

  function toggleTool(toolId: string) {
    const existing = selectedTools.find(t => t.toolId === toolId);
    const connection = connectedMap.get(toolId);

    if (existing) {
      selectedTools = selectedTools.filter(t => t.toolId !== toolId);
    } else if (connection) {
      selectedTools = [...selectedTools, { toolId, connectionId: connection.id }];
    }
  }

  function isToolSelected(toolId: string) {
    return selectedTools.some(t => t.toolId === toolId);
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
        <button class="btn-connect-mode" type="button" onclick={() => startOnboarding('connect')}>
          <span class="btn-label">Connect Mode — I have a live business</span>
          <span class="btn-sublabel">Faster path to value — connect your tools</span>
        </button>
        <button class="btn-start-mode" type="button" onclick={() => startOnboarding('start')}>
          <span class="btn-label">Start Mode — I have an idea</span>
          <span class="btn-sublabel">Build from scratch</span>
        </button>
      </div>

    {:else if step === 'q1'}
      <ChipSelect
        options={['E-commerce', 'SaaS', 'Agency', 'Content Creator', 'Consulting']}
        allowFreeText={true}
        onselect={answerQ1}
      />

    {:else if step === 'q2' && mode === 'connect'}
      <div class="tool-selection">
        <div class="tool-grid">
          {#each TOOL_CATALOG as tool}
            {@const connection = connectedMap.get(tool.id) ?? null}
            {@const selected = isToolSelected(tool.id)}
            <div class="tool-item" class:selected>
              <ToolCard
                {tool}
                {connection}
                onconnect={startOAuth}
                ondisconnect={handleDisconnect}
              />
              {#if connection && !selected}
                <button class="select-tool-btn" type="button" onclick={() => toggleTool(tool.id)} aria-label={`Select ${tool.name}`}>
                  Select this tool
                </button>
              {:else if connection && selected}
                <button class="deselect-tool-btn" type="button" onclick={() => toggleTool(tool.id)} aria-label={`Deselect ${tool.name}`}>
                  Selected ✓
                </button>
              {/if}
            </div>
          {/each}
        </div>
        <div class="tool-actions">
          {#if selectedTools.length > 0}
            <p class="selected-summary">{selectedTools.length} tool{selectedTools.length > 1 ? 's' : ''} selected</p>
          {/if}
          <button class="btn-continue" type="button" onclick={proceedToQ3}>
            Continue
          </button>
        </div>
      </div>

    {:else if step === 'q2' && mode === 'start'}
      <ChipSelect
        options={['Get more customers', 'Reduce costs', 'Automate operations', 'Launch a product', 'Grow revenue']}
        allowFreeText={true}
        onselect={answerQ2}
      />

    {:else if step === 'q3' && mode === 'connect'}
      <ChipSelect
        options={['Get more customers', 'Reduce costs', 'Automate operations', 'Launch a product', 'Grow revenue']}
        allowFreeText={true}
        onselect={answerQ3}
      />

    {:else if step === 'q3' && mode === 'start'}
      <ChipSelect
        options={['<50', '50-200', '200+']}
        allowFreeText={false}
        onselect={answerQ3}
      />

    {:else if step === 'q4'}
      <ChipSelect
        options={['<50', '50-200', '200+']}
        allowFreeText={false}
        onselect={answerQ4}
      />

    {:else if step === 'proposal'}
      <div class="proposal-section">
        {#if mode === 'connect' && agentReasons.length > 0}
          <div class="agent-reasons">
            {#each agentReasons as reason}
              <p class="reason-text">• {reason}</p>
            {/each}
          </div>
        {/if}

        {#if mode === 'connect' && quickWins.length > 0}
          <div class="quick-wins">
            <h3 class="quick-wins-heading">Quick Wins</h3>
            {#each quickWins as win}
              <div class="quick-win-item">
                <span class="quick-win-agent">{win.agent}</span>
                <span class="quick-win-message">{win.message}</span>
              </div>
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

        <Button class="btn-summon" onclick={summonCrew}>
          SUMMON THE CREW
        </Button>
      </div>

    {:else if step === 'analysing'}
      <p class="status-text">Analysing your connected tools...</p>

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
    padding: 18px 24px;
    background: var(--fo-plum, #3D3560);
    color: #fff;
    border: 2px solid var(--fo-plum, #3D3560);
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .btn-connect-mode:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(61, 53, 96, 0.4);
  }

  .btn-start-mode {
    width: 100%;
    padding: 14px 24px;
    background: transparent;
    color: var(--muted, #7A766D);
    border: 1px dashed var(--fo-border, #D9CEBB);
    border-radius: 6px;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .btn-start-mode:hover {
    border-color: var(--fo-plum, #3D3560);
    color: var(--ink, #0E0D0B);
  }

  .btn-label {
    font-size: 14px;
    font-weight: 500;
  }

  .btn-sublabel {
    font-size: 12px;
    opacity: 0.8;
  }

  .tool-selection {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .tool-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }

  @media (min-width: 480px) {
    .tool-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .tool-item {
    position: relative;
  }

  .tool-item.selected :global(.tool-card) {
    border-color: var(--rose, #F472B6);
    background: rgba(244, 114, 182, 0.04);
  }

  .select-tool-btn,
  .deselect-tool-btn {
    width: 100%;
    margin-top: 8px;
    padding: 10px;
    border-radius: 6px;
    font-family: 'DM Sans', sans-serif;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .select-tool-btn {
    background: rgba(244, 114, 182, 0.08);
    border: 1px solid var(--rose, #F472B6);
    color: var(--rose, #F472B6);
  }

  .select-tool-btn:hover {
    background: rgba(244, 114, 182, 0.15);
  }

  .deselect-tool-btn {
    background: rgba(244, 114, 182, 0.12);
    border: 1px solid var(--rose, #F472B6);
    color: var(--rose, #F472B6);
  }

  .tool-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 8px;
  }

  .selected-summary {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: var(--muted, #7A766D);
    text-align: center;
  }

  .btn-continue {
    width: 100%;
    padding: 14px 24px;
    background: var(--fo-plum, #3D3560);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .btn-continue:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(61, 53, 96, 0.3);
  }

  .proposal-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .agent-reasons {
    background: var(--fo-bg2, #EDE9E0);
    border: 1px solid rgba(14, 13, 11, 0.08);
    border-radius: 6px;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .reason-text {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: var(--ink, #0E0D0B);
    line-height: 1.5;
    margin: 0;
  }

  .quick-wins {
    background: linear-gradient(135deg, rgba(244, 114, 182, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%);
    border: 1px solid rgba(244, 114, 182, 0.2);
    border-radius: 8px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .quick-wins-heading {
    font-family: 'Cormorant Garamond', serif;
    font-size: 16px;
    font-weight: 600;
    color: var(--fo-plum, #3D3560);
    margin: 0;
  }

  .quick-win-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .quick-win-agent {
    font-family: 'Press Start 2P', monospace;
    font-size: 5px;
    color: var(--rose, #F472B6);
    text-transform: uppercase;
    letter-spacing: 0.10em;
  }

  .quick-win-message {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: var(--ink, #0E0D0B);
    line-height: 1.4;
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
