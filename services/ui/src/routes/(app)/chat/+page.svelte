<script lang="ts">
  import { onMount, tick } from 'svelte';
  import ChatBubble from '$lib/components/ChatBubble.svelte';
  import { subscribeWS, type LiveEvent } from '$lib/ws';
  import { getChatMessages, sendChatMessage, getFleetEvents, getAgents, executeCommand, createChatThread } from '$lib/api';
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
        role: 'system',
        body: result.message,
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
    if (messageListEl) {
      messageListEl.scrollTop = messageListEl.scrollHeight;
    }
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
    try {
      agents = await getAgents(data.companyId);
    } catch {
      agents = [];
    }
  }

  function switchToFleet() {
    sidebarView = 'fleet';
    selectedThreadId = null;
    messages = [];
    document.body.classList.add('back-office');
    loadFleetEvents();
  }

  function switchToThreads() {
    sidebarView = 'threads';
    document.body.classList.remove('back-office');
    if (threads.length > 0 && threads[0]) {
      selectThread(threads[0].id);
    }
  }

  async function handleSend() {
    if (sidebarView === 'fleet') return;
    if (!selectedThreadId || !messageText.trim() || sending) return;

    // Handle slash commands
    const parsed = parseCommand(messageText.trim());
    if (parsed) {
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
    if (adapter.includes('haiku') || adapter.includes('junior')) {
      return { label: 'JUNIOR', color: 'var(--tier-junior)' };
    }
    if (adapter.includes('sonnet') || adapter.includes('mid')) {
      return { label: 'MID', color: 'var(--tier-mid)' };
    }
    if (adapter.includes('opus') || adapter.includes('senior')) {
      return { label: 'SENIOR', color: 'var(--tier-senior)' };
    }
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

  function renderCommandData(data: Record<string, unknown> | undefined): { label: string; value: string }[] {
    if (!data) return [];
    return Object.entries(data).map(([key, val]) => ({
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
      case 'fleet.class.transition': return 'var(--bo-amber, #fbbf24)';
      case 'fleet.dna.captured': return 'var(--bo-teal, #14b8a6)';
      case 'fleet.pioneer.detected': return 'var(--bo-amber, #fbbf24)';
      case 'fleet.budget.alert': return 'var(--fo-warn, #f97316)';
      case 'fleet.execution.completed': return 'var(--bo-teal, #14b8a6)';
      default: return 'var(--muted)';
    }
  }

  onMount(() => {
    if (threads.length > 0 && threads[0]) {
      selectThread(threads[0].id);
    }
    loadAgents();

    const unsub = subscribeWS((event: LiveEvent) => {
      if (event.type === 'chat.message.created') {
        const payload = event.payload as Record<string, unknown>;
        const threadId = payload.threadId as string | undefined;

        if (threadId === selectedThreadId) {
          getChatMessages(threadId, { after: messages.at(-1)?.id })
            .then(({ messages: newMsgs }) => {
              if (newMsgs.length > 0) {
                messages = [...messages, ...newMsgs];
                scrollToBottom();
              }
            })
            .catch(() => { /* ignore */ });
        } else if (threadId) {
          threads = threads.map((t) =>
            t.id === threadId
              ? { ...t, updatedAt: new Date().toISOString() }
              : t
          );
        }

        if (payload.senderType === 'agent') {
          isTyping = false;
        }
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
      }
    });

    return unsub;
  });

  $effect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  });
</script>

<div class="chat-layout">
  <!-- Thread sidebar -->
  <aside class="thread-sidebar" aria-label="Conversation threads">
    <!-- Sidebar tabs -->
    <div class="sidebar-tabs">
      <button
        class="sidebar-tab"
        class:active={sidebarView === 'threads'}
        onclick={switchToThreads}
      >Threads</button>
      <button
        class="sidebar-tab"
        class:active={sidebarView === 'fleet'}
        onclick={switchToFleet}
      >Fleet</button>
    </div>

    {#if sidebarView === 'threads'}
      {#if threads.length === 0}
        <div class="empty-threads">
          <p class="empty-threads-text">No threads yet.</p>
          {#if showStartConversation}
            <ul class="agent-pick-list">
              {#each agents as agent (agent.id)}
                {@const tier = getAgentTier(agent.adapter)}
                <li>
                  <button
                    class="agent-pick-item"
                    onclick={() => startConversation(agent.id)}
                  >
                    <span class="agent-pick-avatar">{agent.name.slice(0, 1).toUpperCase()}</span>
                    <span class="agent-pick-info">
                      <span class="agent-pick-name">{agent.name}</span>
                      {#if tier.label}
                        <span class="tier-badge" style="color: {tier.color}">{tier.label}</span>
                      {/if}
                    </span>
                  </button>
                </li>
              {/each}
            </ul>
          {:else}
            <button class="btn-start-conversation" onclick={() => showStartConversation = true}>
              Start conversation
            </button>
          {/if}
        </div>
      {:else}
        <ul class="thread-list">
          {#each threads as thread (thread.id)}
            <li>
              <button
                class="thread-item"
                class:active={selectedThreadId === thread.id}
                onclick={() => selectThread(thread.id)}
                aria-current={selectedThreadId === thread.id ? 'page' : undefined}
              >
                <span class="thread-avatar" aria-hidden="true">
                  {getThreadLabel(thread).slice(0, 1).toUpperCase()}
                </span>
                <span class="thread-info">
                  <span class="thread-title">{getThreadLabel(thread)}</span>
                  {#if getLastPreview(thread)}
                    <span class="thread-preview">{getLastPreview(thread)}</span>
                  {/if}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {:else}
      <!-- Fleet events feed -->
      <div class="fleet-feed">
        {#if loadingFleetEvents}
          <div class="fleet-loading">Loading fleet events...</div>
        {:else if fleetEvents.length === 0}
          <p class="empty-fleet">No fleet events yet. Events will appear as agents work.</p>
        {:else}
          <ul class="fleet-list">
            {#each fleetEvents as event (event.id)}
              <li class="fleet-event">
                <span
                  class="event-icon"
                  style="color: {getEventColor(event.type)}"
                  aria-hidden="true"
                >{getEventIcon(event.type)}</span>
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

  <!-- Message panel -->
  <div class="message-panel" aria-label="Messages">
    {#if sidebarView === 'fleet'}
      <div class="fleet-panel">
        <div class="fleet-header">
          <h2 class="fleet-title">Fleet Activity</h2>
          <p class="fleet-subtitle">System events across your agent fleet</p>
        </div>
        <div
          class="fleet-event-list"
          bind:this={messageListEl}
          aria-live="polite"
        >
          {#if loadingFleetEvents}
            <div class="loading-skeleton">
              {#each [0, 1, 2, 3, 4] as _}
                <div class="skeleton-event"></div>
              {/each}
            </div>
          {:else if fleetEvents.length === 0}
            <p class="empty-state">No events yet. Events appear when agents are promoted, demoted, or capture DNA.</p>
          {:else}
            {#each fleetEvents as event (event.id)}
              <div class="fleet-event-card">
                <span
                  class="event-icon-large"
                  style="color: {getEventColor(event.type)}"
                  aria-hidden="true"
                >{getEventIcon(event.type)}</span>
                <div class="event-card-content">
                  <p class="event-card-description">{event.description}</p>
                  <div class="event-card-meta">
                    {#if event.taskCategory}
                      <span class="event-tag">{event.taskCategory}</span>
                    {/if}
                    {#if event.verdictType}
                      <span class="event-tag verdict-{event.verdictType.toLowerCase()}">{event.verdictType}</span>
                    {/if}
                    {#if event.toClass}
                      <span class="event-tag class-{event.toClass.toLowerCase()}">{event.toClass}</span>
                    {/if}
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
        <p class="empty-state">Select a thread to view messages.</p>
      </div>
    {:else}
      <div
        class="message-list"
        bind:this={messageListEl}
        aria-live="polite"
        aria-busy={loadingMessages}
      >
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
            {#if message.role === 'system' && message.commandData}
              <div class="command-output">
                <div class="command-output-header">
                  <span class="command-output-icon">⚡</span>
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
            {:else}
              <ChatBubble
                variant={message.senderType === 'user' ? 'user' : 'agent'}
                sender={message.senderType === 'agent' && message.senderId ? message.senderId.slice(0, 8) : undefined}
                text={message.body}
              />
            {/if}
          {/each}

          {#if isTyping}
            <ChatBubble variant="agent" typing />
          {/if}
        {/if}
      </div>

      <!-- Message input -->
      <div class="message-input">
        {#if mentionQuery !== null && filteredAgents.length > 0}
          <div class="mention-dropdown" role="listbox">
            {#each filteredAgents as agent, i (agent.id)}
              {@const tier = getAgentTier(agent.adapter)}
              <button
                class="mention-item"
                class:highlighted={i === mentionIndex}
                onclick={() => applyMention(agent)}
                role="option"
                aria-selected={i === mentionIndex}
              >
                <span class="mention-agent-info">
                  <span class="mention-name">@{agent.name}</span>
                  {#if tier.label}
                    <span class="tier-badge" style="color: {tier.color}">{tier.label}</span>
                  {/if}
                </span>
                <span class="mention-id">{agent.id.slice(0, 8)}</span>
              </button>
            {/each}
          </div>
        {/if}
        <textarea
          class="input-textarea"
          placeholder="Write a message... (use @ to mention an agent)"
          bind:value={messageText}
          bind:this={textareaEl}
          onkeydown={handleKeydown}
          oninput={handleInput}
          rows={2}
          disabled={sending}
          aria-label="Message input"
        ></textarea>
        <button
          class="btn-send"
          onclick={handleSend}
          disabled={sending || !messageText.trim() || sidebarView === 'fleet'}
          aria-label="Send message"
        >Send message</button>
      </div>
    {/if}
  </div>
</div>

<style>
  /* ── Layout ──────────────────────────────────────────── */
  .chat-layout {
    display: flex;
    height: calc(100vh - 44px);
    overflow: hidden;
  }

  /* ── Thread sidebar ─────────────────────────────────── */
  .thread-sidebar {
    width: 240px;
    flex-shrink: 0;
    border-right: 1px solid var(--fo-border);
    overflow-y: auto;
    padding: var(--space-md) 0;
  }

  :global(body.back-office) .thread-sidebar {
    border-right-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .thread-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .thread-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: 10px 14px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .thread-item:hover {
    background: var(--fo-bg2);
  }

  .thread-item.active {
    background: var(--fo-bg2);
  }

  :global(body.back-office) .thread-item:hover,
  :global(body.back-office) .thread-item.active {
    background: rgba(124, 58, 237, 0.10);
  }

  .thread-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--fo-plum-p);
    color: var(--fo-plum);
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  :global(body.back-office) .thread-avatar {
    background: rgba(124, 58, 237, 0.15);
    color: var(--bo-vb);
  }

  .thread-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .thread-title {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    color: var(--ink);
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(body.back-office) .thread-title {
    color: var(--bo-text);
  }

  .thread-preview {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .empty-threads {
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .empty-threads-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0;
    line-height: 1.5;
  }

  :global(body.back-office) .empty-threads-text {
    color: var(--bo-muted);
  }

  .btn-start-conversation {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    background: var(--fo-plum);
    border: none;
    border-radius: var(--radius-sm);
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    transition: background 0.15s;
    text-align: center;
  }

  .btn-start-conversation:hover {
    background: var(--fo-plum-m);
  }

  :global(body.back-office) .btn-start-conversation {
    background: var(--bo-violet);
  }

  :global(body.back-office) .btn-start-conversation:hover {
    background: var(--bo-vb);
  }

  .agent-pick-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .agent-pick-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm);
    background: var(--fo-bg2);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
    text-align: left;
  }

  .agent-pick-item:hover {
    background: var(--fo-bg3);
    border-color: var(--fo-plum-m);
  }

  :global(body.back-office) .agent-pick-item {
    background: var(--bo-card);
    border-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  :global(body.back-office) .agent-pick-item:hover {
    background: rgba(124, 58, 237, 0.10);
    border-color: var(--bo-violet);
  }

  .agent-pick-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--fo-plum-p);
    color: var(--fo-plum);
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  :global(body.back-office) .agent-pick-avatar {
    background: rgba(124, 58, 237, 0.15);
    color: var(--bo-vb);
  }

  .agent-pick-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
  }

  .agent-pick-name {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(body.back-office) .agent-pick-name {
    color: var(--bo-text);
  }

  /* ── Message panel ──────────────────────────────────── */
  .message-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .message-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .message-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .empty-state {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ── Skeleton loaders ───────────────────────────────── */
  .message-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .skeleton-bubble {
    height: 40px;
    background: var(--fo-bg2);
    border-radius: var(--radius-md);
  }

  .skeleton-agent {
    width: 60%;
    align-self: flex-start;
  }

  .skeleton-user {
    width: 45%;
    align-self: flex-end;
  }

  :global(body.back-office) .skeleton-bubble {
    background: rgba(124, 58, 237, 0.08);
  }

  /* ── Message input ──────────────────────────────────── */
  .message-input {
    padding: var(--space-md);
    border-top: 1px solid var(--fo-border);
    display: flex;
    gap: var(--space-sm);
    align-items: flex-end;
    flex-shrink: 0;
  }

  :global(body.back-office) .message-input {
    border-top-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .input-textarea {
    flex: 1;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    padding: 8px 12px;
    resize: none;
    outline: none;
    line-height: 1.5;
    min-height: 40px;
    transition: border-color 0.15s;
  }

  .input-textarea:focus {
    border-color: var(--fo-plum-m);
    outline: 2px solid var(--fo-plum-p);
    outline-offset: 0;
  }

  .input-textarea::placeholder {
    color: var(--muted);
  }

  .input-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global(body.back-office) .input-textarea {
    color: var(--bo-text);
    background: var(--bo-card);
    border-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  :global(body.back-office) .input-textarea:focus {
    border-color: var(--bo-violet);
    outline-color: rgba(124, 58, 237, 0.20);
  }

  .btn-send {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: var(--fo-plum);
    border: none;
    border-radius: var(--radius-md);
    padding: 8px 16px;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
    align-self: flex-end;
  }

  .btn-send:hover:not(:disabled) {
    background: var(--fo-plum-m);
  }

  .btn-send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(body.back-office) .btn-send {
    background: var(--bo-violet);
  }

  :global(body.back-office) .btn-send:hover:not(:disabled) {
    background: var(--bo-vb);
  }

  /* ── Sidebar tabs ────────────────────────────────────── */
  .sidebar-tabs {
    display: flex;
    gap: 2px;
    padding: 0 var(--space-sm);
    margin-bottom: var(--space-sm);
  }

  .sidebar-tab {
    flex: 1;
    font-family: var(--font-label);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 8px 12px;
    background: transparent;
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--muted);
    transition: all 0.15s;
  }

  .sidebar-tab:hover {
    background: var(--fo-bg2);
    color: var(--ink);
  }

  .sidebar-tab.active {
    background: var(--fo-plum-p);
    border-color: var(--fo-plum-m);
    color: var(--fo-plum);
  }

  :global(body.back-office) .sidebar-tab {
    border-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  :global(body.back-office) .sidebar-tab:hover {
    background: rgba(124, 58, 237, 0.08);
    color: var(--bo-text);
  }

  :global(body.back-office) .sidebar-tab.active {
    background: rgba(124, 58, 237, 0.15);
    border-color: var(--bo-violet);
    color: var(--bo-violet);
  }

  /* ── Fleet sidebar feed ──────────────────────────────── */
  .fleet-feed {
    padding: 0 var(--space-sm);
  }

  .fleet-loading {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    padding: var(--space-lg);
    text-align: center;
  }

  .empty-fleet {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--muted);
    padding: var(--space-md);
    line-height: 1.5;
    margin: 0;
  }

  .fleet-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .fleet-event {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    padding: 8px 0;
    border-bottom: 1px solid var(--fo-border);
  }

  .fleet-event:last-child {
    border-bottom: none;
  }

  :global(body.back-office) .fleet-event {
    border-bottom-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .event-icon {
    font-size: 14px;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
    margin-top: 2px;
  }

  .event-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .event-description {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--ink);
    line-height: 1.4;
  }

  :global(body.back-office) .event-description {
    color: var(--bo-text);
  }

  .event-time {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--muted);
  }

  /* ── Fleet panel ────────────────────────────────────── */
  .fleet-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .fleet-header {
    padding: var(--space-lg);
    border-bottom: 1px solid var(--fo-border);
    flex-shrink: 0;
  }

  :global(body.back-office) .fleet-header {
    border-bottom-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .fleet-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--ink);
    margin: 0 0 4px;
  }

  :global(body.back-office) .fleet-title {
    color: var(--bo-text);
  }

  .fleet-subtitle {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }

  .fleet-event-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .loading-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .skeleton-event {
    height: 60px;
    background: var(--fo-bg2);
    border-radius: var(--radius-md);
    animation: pulse-skeleton 1.2s ease-in-out infinite;
  }

  :global(body.back-office) .skeleton-event {
    background: rgba(124, 58, 237, 0.08);
  }

  @keyframes pulse-skeleton {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
  }

  .fleet-event-card {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    padding: var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    transition: border-color 0.15s;
  }

  .fleet-event-card:hover {
    border-color: var(--fo-plum-m);
  }

  :global(body.back-office) .fleet-event-card {
    background: var(--bo-card);
    border-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  :global(body.back-office) .fleet-event-card:hover {
    border-color: var(--bo-violet);
  }

  .event-icon-large {
    font-size: 20px;
    flex-shrink: 0;
    width: 28px;
    text-align: center;
    margin-top: 2px;
  }

  .event-card-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    min-width: 0;
  }

  .event-card-description {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink);
    line-height: 1.5;
    margin: 0;
  }

  :global(body.back-office) .event-card-description {
    color: var(--bo-text);
  }

  .event-card-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs);
  }

  .event-tag {
    font-family: var(--font-label);
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 3px 7px;
    border-radius: 3px;
    background: var(--fo-bg2);
    color: var(--muted);
  }

  .event-tag.verdict-promote {
    background: rgba(34, 197, 94, 0.12);
    color: #16a34a;
  }

  .event-tag.verdict-maintain {
    background: rgba(59, 130, 246, 0.12);
    color: #2563eb;
  }

  .event-tag.verdict-demote {
    background: rgba(249, 115, 22, 0.12);
    color: #ea580c;
  }

  .event-tag.verdict-retire {
    background: rgba(239, 68, 68, 0.12);
    color: #dc2626;
  }

  .event-tag.class-novice {
    background: rgba(156, 163, 175, 0.12);
    color: #6b7280;
  }

  .event-tag.class-understudy {
    background: rgba(124, 58, 237, 0.12);
    color: var(--bo-violet, #7c3aed);
  }

  .event-tag.class-artisan {
    background: rgba(251, 191, 36, 0.12);
    color: #d97706;
  }

  :global(body.back-office) .event-tag {
    background: rgba(124, 58, 237, 0.08);
    color: var(--bo-muted);
  }

  .event-card-time {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
    margin-left: auto;
  }

  /* ── Mention autocomplete ─────────────────────────────── */
  .mention-dropdown {
    position: absolute;
    bottom: 100%;
    left: var(--space-md);
    right: var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    margin-bottom: 4px;
    z-index: 100;
  }

  :global(body.back-office) .mention-dropdown {
    background: var(--bo-card);
    border-color: var(--bo-border, rgba(124, 58, 237, 0.15));
    box-shadow: 0 -4px 12px rgba(124, 58, 237, 0.12);
  }

  .mention-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
    gap: var(--space-sm);
  }

  .mention-item:hover,
  .mention-item.highlighted {
    background: var(--fo-bg2);
  }

  :global(body.back-office) .mention-item:hover,
  :global(body.back-office) .mention-item.highlighted {
    background: rgba(124, 58, 237, 0.08);
  }

  .mention-agent-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
  }

  .mention-name {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(body.back-office) .mention-name {
    color: var(--bo-text);
  }

  .mention-id {
    font-family: var(--font-label);
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  :global(body.back-office) .mention-id {
    color: var(--bo-muted);
  }

  .tier-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.06em;
    padding: 2px 5px;
    border-radius: 2px;
    background: var(--fo-bg2);
    border: 1px solid currentColor;
    opacity: 0.85;
    flex-shrink: 0;
  }

  :global(body.back-office) .tier-badge {
    background: rgba(124, 58, 237, 0.10);
  }

  .message-input {
    position: relative;
  }

  /* ── Command output ──────────────────────────────────────── */
  .command-output {
    align-self: flex-start;
    max-width: 76%;
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  :global(body.back-office) .command-output {
    background: var(--bo-card);
    border-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .command-output-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .command-output-icon {
    font-size: 14px;
  }

  .command-output-label {
    font-family: var(--font-label);
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--bo-amber, var(--fo-plum));
  }

  :global(body.back-office) .command-output-label {
    color: var(--bo-amber);
  }

  .command-output-message {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink);
    line-height: 1.5;
    margin: 0;
  }

  :global(body.back-office) .command-output-message {
    color: var(--bo-text);
  }

  .command-output-data {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--fo-border);
  }

  :global(body.back-office) .command-output-data {
    border-top-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .command-data-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
  }

  .command-data-label {
    font-family: var(--font-label);
    font-size: 9px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }

  :global(body.back-office) .command-data-label {
    color: var(--bo-muted);
  }

  .command-data-value {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--ink);
    font-weight: 500;
  }

  :global(body.back-office) .command-data-value {
    color: var(--bo-text);
  }
</style>
