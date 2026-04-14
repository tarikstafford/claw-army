<script lang="ts">
  import { onMount, tick } from 'svelte';
  import ChatBubble from '$lib/components/ChatBubble.svelte';
  import { subscribeWS, type LiveEvent } from '$lib/ws';
  import { getChatMessages, sendChatMessage, getFleetEvents, getAgents, executeCommand, createChatThread, createGoal } from '$lib/api';
  import type { ChatMessage, ChatThread, FleetEvent, Agent } from '$lib/api';
  import type { PageData } from './$types';

  interface CommandDef {
    name: string;
    description: string;
    argsHint: string;
    modifiesState: boolean;
  }

  const COMMANDS: CommandDef[] = [
    { name: 'status', description: 'Fleet status summary', argsHint: '', modifiesState: false },
    { name: 'pause', description: 'Pause agent or all agents', argsHint: '[agentName]', modifiesState: true },
    { name: 'resume', description: 'Resume paused agent(s)', argsHint: '[agentName]', modifiesState: true },
    { name: 'assign', description: 'Assign issue to agent', argsHint: '<agentName> <issueId>', modifiesState: true },
    { name: 'goal', description: 'Create a new goal', argsHint: '<name>', modifiesState: true },
  ];

  let { data }: { data: PageData } = $props();

  let threads = $state<ChatThread[]>(data.threads ?? []);
  let selectedThreadId = $state<string | null>(null);
  let messages = $state<ChatMessage[]>([]);
  let messageText = $state('');
  let sending = $state(false);
  let loadingMessages = $state(false);
  let messageListEl: HTMLElement | undefined;
  let isTyping = $state(false);

  let sidebarView = $state<'threads' | 'fleet'>('threads');
  let fleetEvents = $state<FleetEvent[]>([]);
  let loadingFleetEvents = $state(false);
  let agents = $state<Agent[]>([]);

  let mentionQuery = $state<string | null>(null);
  let mentionIndex = $state(0);
  let textareaEl: HTMLTextAreaElement | undefined;

  let showCommandAutocomplete = $state(false);
  let commandAutocompleteIndex = $state(0);
  let filteredCommands = $state<CommandDef[]>([]);
  let pendingCommand = $state<{ command: string; args: string[] } | null>(null);
  let showConfirmDialog = $state(false);
  let confirmDialogMessage = $state('');
  let showStartConversation = $state(false);

  let mobileSidebarOpen = $state(false);
  let isMobile = $state(false);

  const INDRA_THREAD_ID = '__indra__';
  let indraMessages = $state<ChatMessage[]>([]);
  let expandedAgentThreads = $state<Set<string>>(new Set());

  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
      if (!isMobile) mobileSidebarOpen = false;
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  });

  function openMobileSidebar() { mobileSidebarOpen = true; }
  function closeMobileSidebar() { mobileSidebarOpen = false; }

  function parseCommand(input: string): { command: string; args: string[] } | null {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return null;
    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0]?.toLowerCase() ?? '';
    const args = parts.slice(1);
    return { command, args };
  }

  function filterCommands(input: string): CommandDef[] {
    const parsed = parseCommand(input);
    if (!parsed) return [];
    const query = parsed.command.toLowerCase();
    if (!query) return COMMANDS;
    return COMMANDS.filter(c => c.name.startsWith(query));
  }

  async function handleCommandExecution(command: string, args: string[]) {
    const def = COMMANDS.find(c => c.name === command);
    if (!def) return;
    if (def.modifiesState) {
      pendingCommand = { command, args };
      confirmDialogMessage = `Run /${command} ${args.join(' ')}?`;
      showConfirmDialog = true;
      return;
    }
    await runCommand(command, args);
  }

  async function runCommand(command: string, args: string[]) {
    try {
      const result = await executeCommand(data.companyId, command, args);
      messages = [...messages, {
        id: crypto.randomUUID(),
        threadId: selectedThreadId ?? '',
        body: result.message,
        senderType: 'system',
        senderId: null,
        createdAt: new Date().toISOString(),
        commandData: result.data,
      } as ChatMessage];
      await scrollToBottom();
    } catch (err) {
      console.error('[chat] Command failed:', (err as Error).message);
    }
  }

  async function scrollToBottom() {
    await tick();
    if (messageListEl) messageListEl.scrollTop = messageListEl.scrollHeight;
  }

  async function selectThread(threadId: string) {
    selectedThreadId = threadId;
    sidebarView = 'threads';
    loadingMessages = true;
    messages = [];
    try {
      const result = await getChatMessages(threadId);
      messages = result.messages ?? [];
      await scrollToBottom();
    } catch {
      messages = [];
    } finally {
      loadingMessages = false;
    }
  }

  async function startConversation(agentId: string) {
    showStartConversation = false;
    try {
      const thread = await createChatThread(data.companyId, { agentId });
      threads = [thread, ...threads];
      await selectThread(thread.id);
    } catch {
      console.error('[chat] Failed to start conversation');
    }
  }

  async function loadFleetEvents() {
    loadingFleetEvents = true;
    try {
      const events = await getFleetEvents(data.companyId, { limit: 50 });
      fleetEvents = events;
    } catch {
      fleetEvents = [];
    } finally {
      loadingFleetEvents = false;
    }
  }

  async function loadAgents() {
    try { agents = await getAgents(data.companyId); }
    catch { agents = []; }
  }

  function switchToFleet() {
    sidebarView = 'fleet';
    selectedThreadId = null;
    messages = [];
    loadFleetEvents();
  }

  function switchToThreads() {
    sidebarView = 'threads';
    if (threads.length > 0 && threads[0]) selectThread(threads[0].id);
  }

  async function handleSend() {
    if (sidebarView === 'fleet') return;
    if (!selectedThreadId || !messageText.trim() || sending) return;

    const parsed = parseCommand(messageText.trim());
    if (parsed) {
      if (parsed.command === 'goal') {
        messageText = '';
        showCommandAutocomplete = false;
        await handleGoalCommand(parsed.args);
        return;
      }
      const def = COMMANDS.find(c => c.name === parsed.command);
      if (def) {
        messageText = '';
        showCommandAutocomplete = false;
        await handleCommandExecution(parsed.command, parsed.args);
        return;
      }
    }

    const body = messageText.trim();
    messageText = '';

    const optimisticId = `pending-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      threadId: selectedThreadId,
      body,
      senderType: 'user',
      senderId: null,
      createdAt: new Date().toISOString(),
    };
    messages = [...messages, optimistic];
    await scrollToBottom();

    sending = true;
    try {
      const confirmed = await sendChatMessage(selectedThreadId, { body, senderType: 'user' });
      messages = messages.map((m) => m.id === optimisticId ? confirmed : m);
    } catch {
      messages = messages.filter((m) => m.id !== optimisticId);
      messageText = body;
    } finally {
      sending = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      if (mentionQuery !== null) {
        event.preventDefault();
        applyMention(agents[mentionIndex]);
        return;
      }
      event.preventDefault();
      handleSend();
    }
    if (event.key === 'ArrowDown' && mentionQuery !== null) {
      event.preventDefault();
      mentionIndex = Math.min(mentionIndex + 1, filteredAgents.length - 1);
    }
    if (event.key === 'ArrowUp' && mentionQuery !== null) {
      event.preventDefault();
      mentionIndex = Math.max(mentionIndex - 1, 0);
    }
    if (event.key === 'Escape' && mentionQuery !== null) {
      event.preventDefault();
      mentionQuery = null;
    }
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    const value = target.value;
    const cursorPos = target.selectionStart ?? 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1 && (atIndex === 0 || /\s/.test(textBeforeCursor[atIndex - 1]!))) {
      const query = textBeforeCursor.slice(atIndex + 1);
      if (!query.includes(' ') && query.length < 20) {
        mentionQuery = query;
        mentionIndex = 0;
        return;
      }
    }
    mentionQuery = null;
  }

  function applyMention(agent: Agent | undefined) {
    if (!agent || mentionQuery === null || !textareaEl) return;
    const cursorPos = textareaEl.selectionStart ?? 0;
    const textBeforeCursor = messageText.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const beforeAt = messageText.slice(0, atIndex);
    const afterQuery = messageText.slice(cursorPos);
    messageText = `${beforeAt}@${agent.name} ${afterQuery}`;
    mentionQuery = null;
    setTimeout(() => {
      if (textareaEl) {
        const newPos = atIndex + agent.name.length + 2;
        textareaEl.setSelectionRange(newPos, newPos);
        textareaEl.focus();
      }
    }, 0);
  }

  let filteredAgents = $derived(
    mentionQuery !== null
      ? agents.filter((a) => a.name.toLowerCase().includes(mentionQuery!.toLowerCase())).slice(0, 5)
      : []
  );

  function getThreadLabel(thread: ChatThread): string {
    return thread.title ?? `Thread ${thread.id.slice(0, 8)}`;
  }

  function getAgentTier(adapter: string | null | undefined): { label: string; color: string } {
    if (!adapter) return { label: '', color: 'var(--muted)' };
    if (adapter.includes('haiku') || adapter.includes('junior')) return { label: 'JUNIOR', color: 'var(--tier-junior)' };
    if (adapter.includes('sonnet') || adapter.includes('mid')) return { label: 'MID', color: 'var(--tier-mid)' };
    if (adapter.includes('opus') || adapter.includes('senior')) return { label: 'SENIOR', color: 'var(--tier-senior)' };
    return { label: adapter.toUpperCase(), color: 'var(--muted)' };
  }

  function getLastPreview(thread: ChatThread): string {
    return thread.lastMessagePreview ?? '';
  }

  function formatEventTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  function renderCommandData(commandData: Record<string, unknown> | undefined): { label: string; value: string }[] {
    if (!commandData) return [];
    return Object.entries(commandData).map(([key, val]) => ({
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
      value: String(val ?? '—'),
    }));
  }

  function getEventIcon(type: string): string {
    switch (type) {
      case 'fleet.verdict.confirmed': return '✓';
      case 'fleet.class.transition': return '→';
      case 'fleet.dna.captured': return '◎';
      case 'fleet.pioneer.detected': return '★';
      case 'fleet.budget.alert': return '⚠';
      case 'fleet.execution.completed': return '●';
      default: return '•';
    }
  }

  function getEventColor(type: string): string {
    switch (type) {
      case 'fleet.verdict.confirmed': return 'var(--fo-plum)';
      case 'fleet.class.transition': return 'var(--karma)';
      case 'fleet.dna.captured': return 'var(--accent-teal)';
      case 'fleet.pioneer.detected': return 'var(--karma)';
      case 'fleet.budget.alert': return 'var(--fo-warn, #f97316)';
      case 'fleet.execution.completed': return 'var(--accent-teal)';
      default: return 'var(--muted)';
    }
  }

  function formatFleetEventAsIndraMessage(event: FleetEvent): string {
    switch (event.type) {
      case 'fleet.class.transition':
        return `${event.botId?.slice(0, 8) ?? 'An agent'} was ${event.transitionType === 'promotion' ? 'promoted' : 'demoted'} to ${event.toClass ?? 'a new class'}.`;
      case 'fleet.verdict.confirmed':
        return `Verdict confirmed: ${event.verdictType ?? 'unknown'} for ${event.botId?.slice(0, 8) ?? 'agent'}.`;
      case 'fleet.dna.captured':
        return `DNA captured from ${event.botId?.slice(0, 8) ?? 'agent'} in ${event.taskCategory ?? 'task'}.`;
      case 'fleet.pioneer.detected':
        return `Pioneer detected: ${event.botId?.slice(0, 8) ?? 'agent'} achieved a new benchmark in ${event.taskCategory ?? 'category'}.`;
      case 'fleet.budget.alert':
        return `Budget alert: ${event.description}`;
      case 'fleet.execution.completed':
        return `Execution completed for ${event.executionId?.slice(0, 8) ?? 'run'}.`;
      default:
        return event.description;
    }
  }

  function isAgentToAgentThread(thread: ChatThread): boolean {
    return thread.title?.startsWith('[a2a]') ?? false;
  }

  function getAgentToAgentLabel(thread: ChatThread): string {
    if (thread.title?.startsWith('[a2a]')) return thread.title.slice(5).trim();
    return thread.title ?? `Thread ${thread.id.slice(0, 8)}`;
  }

  function selectIndra() {
    selectedThreadId = INDRA_THREAD_ID;
    sidebarView = 'threads';
    messages = indraMessages;
    closeMobileSidebar();
  }

  function toggleAgentThread(threadId: string) {
    const next = new Set(expandedAgentThreads);
    if (next.has(threadId)) next.delete(threadId);
    else next.add(threadId);
    expandedAgentThreads = next;
  }

  async function handleGoalCommand(args: string[]) {
    const goalName = args.join(' ').trim();
    if (!goalName) {
      messages = [...messages, {
        id: crypto.randomUUID(), threadId: selectedThreadId ?? '',
        body: 'Usage: /goal <name>', senderType: 'system', senderId: null,
        createdAt: new Date().toISOString(),
      } as ChatMessage];
      return;
    }
    try {
      const goal = await createGoal(data.companyId, { title: goalName });
      messages = [...messages, {
        id: crypto.randomUUID(), threadId: selectedThreadId ?? '',
        body: `Goal "${goal.title}" created.`, senderType: 'system', senderId: null,
        createdAt: new Date().toISOString(),
        commandData: { id: goal.id, status: goal.status },
      } as ChatMessage];
      await scrollToBottom();
    } catch (err) {
      messages = [...messages, {
        id: crypto.randomUUID(), threadId: selectedThreadId ?? '',
        body: `Failed to create goal: ${(err as Error).message}`,
        senderType: 'system', senderId: null, createdAt: new Date().toISOString(),
      } as ChatMessage];
    }
  }

  let regularThreads = $derived(threads.filter(t => !isAgentToAgentThread(t)));
  let agentToAgentThreads = $derived(threads.filter(t => isAgentToAgentThread(t)));
  let pendingVerdicts = $derived(fleetEvents.filter(e => e.type === 'fleet.verdict.pending'));

  onMount(() => {
    if (threads.length > 0 && threads[0]) selectThread(threads[0].id);
    loadAgents();

    const unsub = subscribeWS((event: LiveEvent) => {
      if (event.type === 'chat.message.created') {
        const payload = event.payload as Record<string, unknown>;
        const threadId = payload.threadId as string | undefined;
        if (threadId === selectedThreadId) {
          getChatMessages(threadId, { after: messages.at(-1)?.id })
            .then(({ messages: newMsgs }) => {
              if (newMsgs.length > 0) { messages = [...messages, ...newMsgs]; scrollToBottom(); }
            })
            .catch(() => {});
        } else if (threadId) {
          threads = threads.map((t) => t.id === threadId ? { ...t, updatedAt: new Date().toISOString() } : t);
        }
        if (payload.senderType === 'agent') isTyping = false;
      }

      if (event.type === 'chat.agent.typing') {
        const payload = event.payload as Record<string, unknown>;
        if (payload.threadId === selectedThreadId) {
          isTyping = true;
          setTimeout(() => { isTyping = false; }, 3000);
        }
      }

      if (event.type?.startsWith('fleet.')) {
        const payload = event.payload as Record<string, unknown>;
        const newEvent: FleetEvent = {
          id: event.id?.toString() ?? Date.now().toString(),
          type: event.type,
          botId: payload.botId as string | undefined,
          executionId: payload.executionId as string | undefined,
          soulId: payload.soulId as string | undefined,
          taskCategory: payload.taskCategory as string | undefined,
          verdictType: payload.verdictType as string | undefined,
          fromClass: payload.fromClass as string | undefined,
          toClass: payload.toClass as string | undefined,
          transitionType: payload.transitionType as string | undefined,
          compositeScore: payload.compositeScore as string | undefined,
          isPioneer: payload.isPioneer as boolean | undefined,
          description: payload.description as string ?? event.type,
          timestamp: event.createdAt,
        };
        fleetEvents = [newEvent, ...fleetEvents].slice(0, 100);

        const indraMsg: ChatMessage = {
          id: `indra-${newEvent.id}`,
          threadId: INDRA_THREAD_ID,
          body: formatFleetEventAsIndraMessage(newEvent),
          senderType: 'system',
          senderId: 'indra',
          createdAt: event.createdAt,
        };
        indraMessages = [...indraMessages, indraMsg];
        if (selectedThreadId === INDRA_THREAD_ID) {
          messages = [...messages, indraMsg];
          scrollToBottom();
        }
      }
    });

    return unsub;
  });

  $effect(() => { if (messages.length > 0) scrollToBottom(); });
</script>

<div class="chat-layout">
  {#if isMobile}
    <div class="mobile-header">
      <button class="mobile-menu-btn" onclick={openMobileSidebar} aria-label="Open threads">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <span class="mobile-header-title">
        {#if sidebarView === 'fleet'}Fleet Activity
        {:else if selectedThreadId === INDRA_THREAD_ID}Indra
        {:else if selectedThreadId}{threads.find(t => t.id === selectedThreadId)?.title ?? 'Chat'}
        {:else}Chat{/if}
      </span>
      <div class="mobile-header-spacer"></div>
    </div>
  {/if}

  <aside class="thread-sidebar" class:mobile-drawer={isMobile} class:mobile-open={mobileSidebarOpen} aria-label="Conversation threads">
    {#if isMobile}
      <div class="mobile-drawer-header">
        <span class="mobile-drawer-title">Threads</span>
        <button class="mobile-drawer-close" onclick={closeMobileSidebar} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    {/if}

    <div class="sidebar-tabs">
      <button class="sidebar-tab" class:active={sidebarView === 'threads'} onclick={switchToThreads}>Threads</button>
      <button class="sidebar-tab" class:active={sidebarView === 'fleet'} onclick={switchToFleet}>Fleet</button>
    </div>

    {#if sidebarView === 'threads'}
      <!-- Indra channel pinned -->
      <button class="indra-channel" class:active={selectedThreadId === INDRA_THREAD_ID} onclick={selectIndra} aria-label="Indra channel">
        <span class="indra-avatar" aria-hidden="true">I</span>
        <span class="thread-info">
          <span class="indra-label">Indra</span>
          <span class="thread-preview">Fleet intelligence feed</span>
        </span>
        {#if indraMessages.length > 0}
          <span class="indra-badge">{indraMessages.length}</span>
        {/if}
      </button>

      {#if threads.length === 0}
        <div class="empty-threads">
          <p class="empty-threads-text">No threads yet.</p>
          {#if showStartConversation}
            <ul class="agent-pick-list">
              {#each agents as agent (agent.id)}
                {@const tier = getAgentTier(agent.adapter)}
                <li>
                  <button class="agent-pick-item" onclick={() => startConversation(agent.id)}>
                    <span class="agent-pick-avatar">{agent.name.slice(0, 1).toUpperCase()}</span>
                    <span class="agent-pick-info">
                      <span class="agent-pick-name">{agent.name}</span>
                      {#if tier.label}<span class="tier-badge" style="color: {tier.color}">{tier.label}</span>{/if}
                    </span>
                  </button>
                </li>
              {/each}
            </ul>
          {:else}
            <button class="btn-start-conversation" onclick={() => showStartConversation = true}>Start conversation</button>
          {/if}
        </div>
      {:else}
        <ul class="thread-list">
          {#each regularThreads as thread (thread.id)}
            <li>
              <button class="thread-item" class:active={selectedThreadId === thread.id}
                onclick={() => { selectThread(thread.id); closeMobileSidebar(); }}
                aria-current={selectedThreadId === thread.id ? 'page' : undefined}>
                <span class="thread-avatar" aria-hidden="true">{getThreadLabel(thread).slice(0, 1).toUpperCase()}</span>
                <span class="thread-info">
                  <span class="thread-title">{getThreadLabel(thread)}</span>
                  {#if getLastPreview(thread)}<span class="thread-preview">{getLastPreview(thread)}</span>{/if}
                </span>
              </button>
            </li>
          {/each}
        </ul>

        {#if agentToAgentThreads.length > 0}
          <div class="a2a-section-label">Agent Conversations</div>
          <ul class="thread-list">
            {#each agentToAgentThreads as thread (thread.id)}
              <li>
                <button class="thread-item a2a-thread" class:active={selectedThreadId === thread.id}
                  onclick={() => { selectThread(thread.id); closeMobileSidebar(); }}
                  aria-current={selectedThreadId === thread.id ? 'page' : undefined}>
                  <span class="a2a-avatar" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </span>
                  <span class="thread-info">
                    <span class="thread-title">{getAgentToAgentLabel(thread)}</span>
                    {#if getLastPreview(thread)}<span class="thread-preview">{getLastPreview(thread)}</span>{/if}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    {:else}
      <div class="fleet-feed">
        {#if loadingFleetEvents}
          <div class="fleet-loading">Loading fleet events...</div>
        {:else if fleetEvents.length === 0}
          <p class="empty-fleet">No fleet events yet. Events will appear as agents work.</p>
        {:else}
          <ul class="fleet-list">
            {#each fleetEvents as event (event.id)}
              <li class="fleet-event">
                <span class="event-icon" style="color: {getEventColor(event.type)}" aria-hidden="true">{getEventIcon(event.type)}</span>
                <div class="event-content">
                  <span class="event-description">{event.description}</span>
                  <span class="event-time">{formatEventTime(event.timestamp)}</span>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </aside>

  {#if isMobile && mobileSidebarOpen}
    <div class="mobile-overlay" onclick={closeMobileSidebar} aria-hidden="true"></div>
  {/if}

  <div class="message-panel" aria-label="Messages">
    {#if sidebarView === 'fleet'}
      <div class="fleet-panel">
        <div class="fleet-header">
          <h2 class="fleet-title">Fleet Activity</h2>
          <p class="fleet-subtitle">System events across your agent fleet</p>
        </div>
        <div class="fleet-event-list" bind:this={messageListEl} aria-live="polite">
          {#if loadingFleetEvents}
            <div class="loading-skeleton">
              {#each [0,1,2,3,4] as _}<div class="skeleton-event"></div>{/each}
            </div>
          {:else if fleetEvents.length === 0}
            <p class="empty-state">No events yet. Events appear when agents are promoted, demoted, or capture DNA.</p>
          {:else}
            {#each fleetEvents as event (event.id)}
              <div class="fleet-event-card">
                <span class="event-icon-large" style="color: {getEventColor(event.type)}" aria-hidden="true">{getEventIcon(event.type)}</span>
                <div class="event-card-content">
                  <p class="event-card-description">{event.description}</p>
                  <div class="event-card-meta">
                    {#if event.taskCategory}<span class="event-tag">{event.taskCategory}</span>{/if}
                    {#if event.verdictType}<span class="event-tag verdict-{event.verdictType.toLowerCase()}">{event.verdictType}</span>{/if}
                    {#if event.toClass}<span class="event-tag class-{event.toClass.toLowerCase()}">{event.toClass}</span>{/if}
                    <span class="event-card-time">{formatEventTime(event.timestamp)}</span>
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

    {:else if !selectedThreadId}
      <div class="message-empty">
        <div class="empty-hero">
          <div class="empty-hero-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--fo-gold)" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h3 class="empty-hero-title">Start a conversation with your team</h3>
          <p class="empty-hero-text">Indra is ready to help. Select a thread or start a new conversation with any agent in your fleet.</p>
          <button class="btn-start-conversation" onclick={() => showStartConversation = true}>Start conversation</button>
        </div>
      </div>

    {:else if selectedThreadId === INDRA_THREAD_ID}
      <div class="indra-panel">
        <div class="indra-header-bar">
          <h2 class="indra-panel-title">Indra</h2>
          <p class="indra-panel-subtitle">Fleet intelligence and evolution events</p>
        </div>
        <div class="message-list" bind:this={messageListEl} aria-live="polite">
          {#if indraMessages.length === 0}
            <div class="indra-empty">
              <p class="empty-state">No fleet events yet. Events will appear here as your agents work, evolve, and capture DNA.</p>
            </div>
          {:else}
            {#each indraMessages as message (message.id)}
              <div class="indra-message">
                <div class="indra-message-accent"></div>
                <div class="indra-message-content">
                  <p class="indra-message-text">{message.body}</p>
                  <span class="indra-message-time">{formatEventTime(message.createdAt)}</span>
                </div>
              </div>
            {/each}
          {/if}

          {#if pendingVerdicts.length > 0}
            <div class="verdict-section">
              <span class="verdict-section-label">Pending Confirmations</span>
              {#each pendingVerdicts as verdict (verdict.id)}
                <div class="verdict-card">
                  <div class="verdict-card-header">
                    <span class="verdict-type verdict-{verdict.verdictType?.toLowerCase()}">{verdict.verdictType ?? 'Verdict'}</span>
                    <span class="verdict-agent">{verdict.botId?.slice(0, 8) ?? 'Agent'}</span>
                  </div>
                  <p class="verdict-description">{verdict.description}</p>
                  {#if verdict.compositeScore}
                    <div class="verdict-score">
                      <span class="verdict-score-label">Score</span>
                      <span class="verdict-score-value">{verdict.compositeScore}</span>
                    </div>
                  {/if}
                  <div class="verdict-actions">
                    <button class="verdict-btn verdict-btn-confirm">Confirm</button>
                    <button class="verdict-btn verdict-btn-reject">Reject</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

    {:else}
      {@const isA2A = threads.find(t => t.id === selectedThreadId && isAgentToAgentThread(t))}
      {@const isExpanded = expandedAgentThreads.has(selectedThreadId)}
      {#if isA2A && !isExpanded}
        <div class="a2a-readonly-banner">
          <span class="a2a-readonly-text">This is a conversation between agents. Read-only view.</span>
          <button class="a2a-expand-btn" onclick={() => toggleAgentThread(selectedThreadId!)}>Expand</button>
        </div>
      {/if}
      <div class="message-list" bind:this={messageListEl} aria-live="polite" aria-busy={loadingMessages}>
        {#if loadingMessages}
          <div class="message-skeleton" aria-hidden="true">
            <div class="skeleton-bubble skeleton-agent"></div>
            <div class="skeleton-bubble skeleton-user"></div>
            <div class="skeleton-bubble skeleton-agent"></div>
          </div>
        {:else if messages.length === 0}
          <p class="empty-state">No messages yet. Send the first message.</p>
        {:else}
          {#each messages as message (message.id)}
            {#if (message.senderType === 'system' || message.senderId === 'indra') && message.commandData}
              <div class="command-output">
                <div class="command-output-header">
                  <span class="command-output-icon">*</span>
                  <span class="command-output-label">Command Result</span>
                </div>
                <p class="command-output-message">{message.body}</p>
                {#if renderCommandData(message.commandData).length > 0}
                  <div class="command-output-data">
                    {#each renderCommandData(message.commandData) as item}
                      <div class="command-data-row">
                        <span class="command-data-label">{item.label}</span>
                        <span class="command-data-value">{item.value}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else if message.senderType === 'system' || message.senderId === 'indra'}
              <div class="system-message">
                <div class="system-message-accent"></div>
                <p class="system-message-text">{message.body}</p>
              </div>
            {:else}
              <ChatBubble
                variant={message.senderType === 'user' ? 'user' : 'agent'}
                sender={message.senderType === 'agent' && message.senderId ? message.senderId.slice(0, 8) : undefined}
                text={message.body}
              />
            {/if}
          {/each}
          {#if isTyping}<ChatBubble variant="agent" typing />{/if}
        {/if}
      </div>

      {#if !(isA2A && !isExpanded)}
        <div class="message-input">
          {#if mentionQuery !== null && filteredAgents.length > 0}
            <div class="mention-dropdown" role="listbox">
              {#each filteredAgents as agent, i (agent.id)}
                {@const tier = getAgentTier(agent.adapter)}
                <button class="mention-item" class:highlighted={i === mentionIndex}
                  onclick={() => applyMention(agent)} role="option" aria-selected={i === mentionIndex}>
                  <span class="mention-agent-info">
                    <span class="mention-name">@{agent.name}</span>
                    {#if tier.label}<span class="tier-badge" style="color: {tier.color}">{tier.label}</span>{/if}
                  </span>
                  <span class="mention-id">{agent.id.slice(0, 8)}</span>
                </button>
              {/each}
            </div>
          {/if}
          <textarea class="input-textarea" placeholder="Write a message... (use @ to mention, / for commands)"
            bind:value={messageText} bind:this={textareaEl} onkeydown={handleKeydown} oninput={handleInput}
            rows={2} disabled={sending} aria-label="Message input"></textarea>
          <button class="btn-send" onclick={handleSend}
            disabled={sending || !messageText.trim()}
            aria-label="Send message">Send message</button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .chat-layout { display: flex; height: calc(100vh - 44px); overflow: hidden; }

  .thread-sidebar { width: 240px; flex-shrink: 0; border-right: 1px solid var(--fo-border); overflow-y: auto; padding: var(--space-md) 0; }
  .thread-list { list-style: none; margin: 0; padding: 0; }
  .thread-item { display: flex; align-items: center; gap: var(--space-sm); width: 100%; padding: 10px 14px; background: transparent; border: none; cursor: pointer; text-align: left; transition: background 0.15s; }
  .thread-item:hover { background: var(--fo-bg2); }
  .thread-item.active { background: var(--fo-bg2); }
  .thread-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--fo-plum-p); color: var(--fo-plum); font-family: var(--font-body); font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .thread-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .thread-title { font-family: var(--font-body); font-size: 13px; font-weight: 400; color: var(--ink); line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .thread-preview { font-family: var(--font-body); font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .empty-threads { padding: var(--space-md); display: flex; flex-direction: column; gap: var(--space-md); }
  .empty-threads-text { font-family: var(--font-body); font-size: 13px; color: var(--muted); margin: 0; line-height: 1.5; }
  .btn-start-conversation { font-family: var(--font-body); font-size: 12px; font-weight: 600; color: white; background: var(--fo-plum); border: none; border-radius: var(--radius-sm); padding: var(--space-sm) var(--space-md); cursor: pointer; transition: background 0.15s; text-align: center; }
  .btn-start-conversation:hover { background: var(--fo-plum-m); }

  .agent-pick-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-xs); }
  .agent-pick-item { display: flex; align-items: center; gap: var(--space-sm); width: 100%; padding: var(--space-sm); background: var(--fo-bg2); border: 1px solid var(--fo-border); border-radius: var(--radius-sm); cursor: pointer; transition: background 0.1s, border-color 0.1s; text-align: left; }
  .agent-pick-item:hover { background: var(--fo-bg3); border-color: var(--fo-plum-m); }
  .agent-pick-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--fo-plum-p); color: var(--fo-plum); font-family: var(--font-body); font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .agent-pick-info { display: flex; align-items: center; gap: var(--space-sm); min-width: 0; }
  .agent-pick-name { font-family: var(--font-body); font-size: 12px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .message-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
  .message-empty { flex: 1; display: flex; align-items: center; justify-content: center; }
  .message-list { flex: 1; overflow-y: auto; padding: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-sm); }
  .empty-state { font-family: var(--font-body); font-size: 13px; color: var(--muted); margin: 0; line-height: 1.5; }

  .message-skeleton { display: flex; flex-direction: column; gap: var(--space-sm); }
  .skeleton-bubble { height: 40px; background: var(--fo-bg2); border-radius: var(--radius-md); }
  .skeleton-agent { width: 60%; align-self: flex-start; }
  .skeleton-user { width: 45%; align-self: flex-end; }

  .message-input { padding: var(--space-md); border-top: 1px solid var(--fo-border); display: flex; gap: var(--space-sm); align-items: flex-end; flex-shrink: 0; position: relative; }
  .input-textarea { flex: 1; font-family: var(--font-body); font-size: 14px; color: var(--ink); background: var(--fo-card); border: 1px solid var(--fo-border); border-radius: var(--radius-md); padding: 8px 12px; resize: none; outline: none; line-height: 1.5; min-height: 40px; transition: border-color 0.15s; }
  .input-textarea:focus { border-color: var(--fo-plum-m); outline: 2px solid var(--fo-plum-p); outline-offset: 0; }
  .input-textarea::placeholder { color: var(--muted); }
  .input-textarea:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-send { font-family: var(--font-body); font-size: 13px; font-weight: 600; color: white; background: var(--fo-plum); border: none; border-radius: var(--radius-md); padding: 8px 16px; cursor: pointer; transition: background 0.15s; white-space: nowrap; flex-shrink: 0; align-self: flex-end; }
  .btn-send:hover:not(:disabled) { background: var(--fo-plum-m); }
  .btn-send:disabled { opacity: 0.5; cursor: not-allowed; }

  .sidebar-tabs { display: flex; gap: 2px; padding: 0 var(--space-sm); margin-bottom: var(--space-sm); }
  .sidebar-tab { flex: 1; font-family: var(--font-label); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; padding: 8px 12px; background: transparent; border: 1px solid var(--fo-border); border-radius: var(--radius-sm); cursor: pointer; color: var(--muted); transition: all 0.15s; }
  .sidebar-tab:hover { background: var(--fo-bg2); color: var(--ink); }
  .sidebar-tab.active { background: var(--fo-plum-p); border-color: var(--fo-plum-m); color: var(--fo-plum); }

  .fleet-feed { padding: 0 var(--space-sm); }
  .fleet-loading { font-family: var(--font-body); font-size: 13px; color: var(--muted); padding: var(--space-lg); text-align: center; }
  .empty-fleet { font-family: var(--font-body); font-size: 12px; color: var(--muted); padding: var(--space-md); line-height: 1.5; margin: 0; }
  .fleet-list { list-style: none; margin: 0; padding: 0; }
  .fleet-event { display: flex; align-items: flex-start; gap: var(--space-sm); padding: 8px 0; border-bottom: 1px solid var(--fo-border); }
  .fleet-event:last-child { border-bottom: none; }
  .event-icon { font-size: 14px; flex-shrink: 0; width: 20px; text-align: center; margin-top: 2px; }
  .event-content { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .event-description { font-family: var(--font-body); font-size: 12px; color: var(--ink); line-height: 1.4; }
  .event-time { font-family: var(--font-body); font-size: 10px; color: var(--muted); }

  .fleet-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .fleet-header { padding: var(--space-lg); border-bottom: 1px solid var(--fo-border); flex-shrink: 0; }
  .fleet-title { font-family: var(--font-display); font-size: 18px; font-weight: 600; color: var(--ink); margin: 0 0 4px; }
  .fleet-subtitle { font-family: var(--font-body); font-size: 13px; color: var(--muted); margin: 0; }
  .fleet-event-list { flex: 1; overflow-y: auto; padding: var(--space-md); display: flex; flex-direction: column; gap: var(--space-sm); }
  .loading-skeleton { display: flex; flex-direction: column; gap: var(--space-sm); }
  .skeleton-event { height: 60px; background: var(--fo-bg2); border-radius: var(--radius-md); animation: pulse-skeleton 1.2s ease-in-out infinite; }
  @keyframes pulse-skeleton { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
  .fleet-event-card { display: flex; align-items: flex-start; gap: var(--space-md); padding: var(--space-md); background: var(--fo-card); border: 1px solid var(--fo-border); border-radius: var(--radius-md); transition: border-color 0.15s; }
  .fleet-event-card:hover { border-color: var(--fo-plum-m); }
  .event-icon-large { font-size: 20px; flex-shrink: 0; width: 28px; text-align: center; margin-top: 2px; }
  .event-card-content { display: flex; flex-direction: column; gap: var(--space-xs); min-width: 0; }
  .event-card-description { font-family: var(--font-body); font-size: 13px; color: var(--ink); line-height: 1.5; margin: 0; }
  .event-card-meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-xs); }
  .event-tag { font-family: var(--font-label); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 7px; border-radius: 3px; background: var(--fo-bg2); color: var(--muted); }
  .event-tag.verdict-promote { background: rgba(34, 197, 94, 0.12); color: #16a34a; }
  .event-tag.verdict-maintain { background: rgba(59, 130, 246, 0.12); color: #2563eb; }
  .event-tag.verdict-demote { background: rgba(249, 115, 22, 0.12); color: #ea580c; }
  .event-tag.verdict-retire { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
  .event-tag.class-novice { background: rgba(156, 163, 175, 0.12); color: #6b7280; }
  .event-tag.class-understudy { background: rgba(124, 58, 237, 0.12); color: var(--fo-plum); }
  .event-tag.class-artisan { background: rgba(251, 191, 36, 0.12); color: #d97706; }
  .event-card-time { font-family: var(--font-body); font-size: 11px; color: var(--muted); margin-left: auto; }

  .mention-dropdown { position: absolute; bottom: 100%; left: var(--space-md); right: var(--space-md); background: var(--fo-card); border: 1px solid var(--fo-border); border-radius: var(--radius-md); box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08); overflow: hidden; margin-bottom: 4px; z-index: 100; }
  .mention-item { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: var(--space-sm) var(--space-md); background: transparent; border: none; cursor: pointer; text-align: left; transition: background 0.1s; gap: var(--space-sm); }
  .mention-item:hover, .mention-item.highlighted { background: var(--fo-bg2); }
  .mention-agent-info { display: flex; align-items: center; gap: var(--space-sm); min-width: 0; }
  .mention-name { font-family: var(--font-body); font-size: 13px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mention-id { font-family: var(--font-label); font-size: 10px; color: var(--muted); letter-spacing: 0.04em; flex-shrink: 0; }
  .tier-badge { font-family: var(--font-label); font-size: 6px; letter-spacing: 0.06em; padding: 2px 5px; border-radius: 2px; background: var(--fo-bg2); border: 1px solid currentColor; opacity: 0.85; flex-shrink: 0; }

  .command-output { align-self: flex-start; max-width: 76%; background: var(--fo-card); border: 1px solid var(--fo-border); border-radius: var(--radius-md); padding: var(--space-md); display: flex; flex-direction: column; gap: var(--space-sm); }
  .command-output-header { display: flex; align-items: center; gap: var(--space-sm); }
  .command-output-icon { font-size: 14px; }
  .command-output-label { font-family: var(--font-label); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--karma); }
  .command-output-message { font-family: var(--font-body); font-size: 13px; color: var(--ink); line-height: 1.5; margin: 0; }
  .command-output-data { display: flex; flex-direction: column; gap: var(--space-xs); padding-top: var(--space-sm); border-top: 1px solid var(--fo-border); }
  .command-data-row { display: flex; justify-content: space-between; align-items: center; gap: var(--space-md); }
  .command-data-label { font-family: var(--font-label); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
  .command-data-value { font-family: var(--font-body); font-size: 12px; color: var(--ink); font-weight: 500; }

  /* Indra channel (pinned sidebar item) */
  .indra-channel { display: flex; align-items: center; gap: var(--space-sm); width: 100%; padding: 10px 14px; background: transparent; border: none; border-left: 3px solid var(--fo-gold); cursor: pointer; text-align: left; transition: background 0.15s; margin-bottom: var(--space-xs); }
  .indra-channel:hover { background: var(--fo-gold-p); }
  .indra-channel.active { background: var(--fo-gold-p); border-left-color: var(--fo-gold); }
  .indra-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--fo-gold-p); color: var(--fo-gold); font-family: var(--font-display); font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .indra-label { font-family: var(--font-display); font-size: 13px; font-weight: 600; color: var(--fo-gold); line-height: 1.4; }
  .indra-badge { font-family: var(--font-label); font-size: 9px; background: var(--fo-gold); color: white; border-radius: 10px; padding: 1px 6px; margin-left: auto; flex-shrink: 0; }

  /* Agent-to-agent threads */
  .a2a-section-label { font-family: var(--font-label); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); padding: var(--space-md) 14px var(--space-xs); border-top: 1px solid var(--fo-border); margin-top: var(--space-sm); }
  .a2a-thread { opacity: 0.85; }
  .a2a-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--fo-bg3); color: var(--muted); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .a2a-readonly-banner { display: flex; align-items: center; justify-content: space-between; padding: var(--space-sm) var(--space-md); background: var(--fo-gold-p); border-bottom: 1px solid var(--fo-border); flex-shrink: 0; }
  .a2a-readonly-text { font-family: var(--font-body); font-size: 12px; color: var(--fo-gold); }
  .a2a-expand-btn { font-family: var(--font-label); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fo-plum); background: white; border: 1px solid var(--fo-plum-p); border-radius: var(--radius-sm); padding: 4px 10px; cursor: pointer; transition: background 0.15s; }
  .a2a-expand-btn:hover { background: var(--fo-plum-p); }

  /* Empty hero */
  .empty-hero { display: flex; flex-direction: column; align-items: center; gap: var(--space-md); max-width: 340px; text-align: center; }
  .empty-hero-icon { width: 64px; height: 64px; border-radius: 50%; background: var(--fo-gold-p); display: flex; align-items: center; justify-content: center; }
  .empty-hero-title { font-family: var(--font-display); font-size: 18px; font-weight: 600; color: var(--ink); margin: 0; line-height: 1.4; }
  .empty-hero-text { font-family: var(--font-body); font-size: 13px; color: var(--muted); margin: 0; line-height: 1.6; }

  /* Indra panel */
  .indra-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .indra-header-bar { padding: var(--space-lg); border-bottom: 1px solid var(--fo-border); border-left: 3px solid var(--fo-gold); flex-shrink: 0; }
  .indra-panel-title { font-family: var(--font-display); font-size: 18px; font-weight: 600; color: var(--fo-gold); margin: 0 0 4px; }
  .indra-panel-subtitle { font-family: var(--font-body); font-size: 13px; color: var(--muted); margin: 0; }
  .indra-empty { padding: var(--space-lg); text-align: center; }

  /* Indra messages */
  .indra-message { display: flex; gap: 0; align-self: flex-start; max-width: 80%; }
  .indra-message-accent { width: 3px; background: var(--fo-gold); border-radius: 2px 0 0 2px; flex-shrink: 0; }
  .indra-message-content { padding: 8px 12px; background: var(--fo-card); border: 1px solid var(--fo-border); border-left: none; border-radius: 0 var(--radius-md) var(--radius-md) 0; display: flex; flex-direction: column; gap: 4px; }
  .indra-message-text { font-family: var(--font-body); font-size: 13px; color: var(--ink); line-height: 1.5; margin: 0; }
  .indra-message-time { font-family: var(--font-body); font-size: 10px; color: var(--muted); }

  /* System messages */
  .system-message { display: flex; gap: 0; align-self: flex-start; max-width: 80%; }
  .system-message-accent { width: 3px; background: var(--fo-gold); border-radius: 2px 0 0 2px; flex-shrink: 0; }
  .system-message-text { padding: 8px 12px; background: var(--fo-card); border: 1px solid var(--fo-border); border-left: none; border-radius: 0 var(--radius-md) var(--radius-md) 0; font-family: var(--font-body); font-size: 13px; color: var(--ink); line-height: 1.5; margin: 0; }

  /* Verdict cards */
  .verdict-section { display: flex; flex-direction: column; gap: var(--space-sm); padding-top: var(--space-md); border-top: 1px solid var(--fo-border); margin-top: var(--space-md); }
  .verdict-section-label { font-family: var(--font-label); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fo-gold); }
  .verdict-card { background: var(--fo-card); border: 1px solid var(--fo-border); border-radius: var(--radius-md); padding: var(--space-md); display: flex; flex-direction: column; gap: var(--space-sm); max-width: 360px; }
  .verdict-card-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); }
  .verdict-type { font-family: var(--font-label); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; background: var(--fo-bg2); color: var(--muted); }
  .verdict-type.verdict-promote { background: rgba(34, 197, 94, 0.12); color: #16a34a; }
  .verdict-type.verdict-demote { background: rgba(249, 115, 22, 0.12); color: #ea580c; }
  .verdict-type.verdict-retire { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
  .verdict-agent { font-family: var(--font-body); font-size: 12px; color: var(--ink); font-weight: 500; }
  .verdict-description { font-family: var(--font-body); font-size: 13px; color: var(--ink); line-height: 1.5; margin: 0; }
  .verdict-score { display: flex; align-items: center; gap: var(--space-sm); }
  .verdict-score-label { font-family: var(--font-label); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
  .verdict-score-value { font-family: var(--font-body); font-size: 13px; font-weight: 600; color: var(--fo-gold); }
  .verdict-actions { display: flex; gap: var(--space-sm); padding-top: var(--space-xs); }
  .verdict-btn { font-family: var(--font-body); font-size: 12px; font-weight: 600; border: none; border-radius: var(--radius-sm); padding: 6px 14px; cursor: pointer; transition: background 0.15s; }
  .verdict-btn-confirm { background: var(--fo-plum); color: white; }
  .verdict-btn-confirm:hover { background: var(--fo-plum-m); }
  .verdict-btn-reject { background: var(--fo-bg2); color: var(--ink); border: 1px solid var(--fo-border); }
  .verdict-btn-reject:hover { background: var(--fo-bg3); }

  /* Mobile */
  @media (max-width: 768px) {
    .chat-layout { flex-direction: column; height: 100vh; }
    .mobile-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--fo-border); flex-shrink: 0; }
    .mobile-menu-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: transparent; border: 1px solid var(--fo-border); border-radius: 8px; color: var(--muted); cursor: pointer; }
    .mobile-header-title { font-family: var(--font-body); font-size: 14px; font-weight: 500; color: var(--ink); flex: 1; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mobile-header-spacer { width: 36px; }
    .thread-sidebar { position: fixed; top: 0; left: 0; bottom: 0; width: 280px; max-width: 85vw; background: var(--fo-bg); border-right: 1px solid var(--fo-border); transform: translateX(-100%); transition: transform 0.25s ease; z-index: 200; padding-top: 0; }
    .thread-sidebar.mobile-drawer.mobile-open { transform: translateX(0); }
    .mobile-drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--fo-border); }
    .mobile-drawer-title { font-family: var(--font-body); font-size: 16px; font-weight: 600; color: var(--ink); }
    .mobile-drawer-close { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: transparent; border: none; color: var(--muted); cursor: pointer; }
    .mobile-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); z-index: 199; }
    .message-panel { flex: 1; min-height: 0; }
    .message-list { padding: 16px; }
    .message-input { padding: 12px; }
  }
  @media (min-width: 769px) {
    .mobile-header { display: none; }
    .thread-sidebar:not(.mobile-drawer) { transform: none; }
  }
  @media (max-width: 480px) {
    .message-list { padding: 12px; }
    .message-input { padding: 10px; }
    .input-textarea { font-size: 16px; }
  }
</style>
