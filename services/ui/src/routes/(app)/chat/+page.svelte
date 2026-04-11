<script lang="ts">
  import { onMount, tick } from 'svelte';
  import ChatBubble from '$lib/components/ChatBubble.svelte';
  import { subscribeWS, type LiveEvent } from '$lib/ws';
  import { getChatMessages, sendChatMessage } from '$lib/api';
  import type { ChatMessage, ChatThread, Agent } from '$lib/api';
  import type { PageData } from './$types';

  interface FleetEvent {
    id: string;
    type: string;
    description: string;
    timestamp: string;
    payload: Record<string, unknown>;
  }

  let { data }: { data: PageData } = $props();

  let threads = $state<ChatThread[]>(data.threads ?? []);
  let agents = $state<Agent[]>(data.agents ?? []);
  let selectedThreadId = $state<string | null>(null);
  let selectedTab = $state<'threads' | 'fleet'>('threads');
  let messages = $state<ChatMessage[]>([]);
  let messageText = $state('');
  let sending = $state(false);
  let loadingMessages = $state(false);
  let messageListEl: HTMLElement | undefined;
  let fleetListEl: HTMLElement | undefined;
  let isTyping = $state(false);
  let fleetEvents = $state<FleetEvent[]>([]);

  let mentionQuery = $state<string | null>(null);
  let mentionPopupEl: HTMLElement | undefined;
  let textareaEl: HTMLTextAreaElement | undefined;

  async function scrollToBottom() {
    await tick();
    if (messageListEl) {
      messageListEl.scrollTop = messageListEl.scrollHeight;
    }
  }

  async function scrollFleetToBottom() {
    await tick();
    if (fleetListEl) {
      fleetListEl.scrollTop = fleetListEl.scrollHeight;
    }
  }

  async function selectThread(threadId: string) {
    selectedThreadId = threadId;
    selectedTab = 'threads';
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

  function selectFleet() {
    selectedTab = 'fleet';
    selectedThreadId = null;
    scrollFleetToBottom();
  }

  async function handleSend() {
    if (!selectedThreadId || !messageText.trim() || sending) return;

    const body = messageText.trim();
    messageText = '';
    mentionQuery = null;

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
        insertMention(mentionQuery);
        return;
      }
      event.preventDefault();
      handleSend();
    }
    if (event.key === 'Escape' && mentionQuery !== null) {
      mentionQuery = null;
    }
  }

  function handleInput() {
    if (!textareaEl) return;
    const cursorPos = textareaEl.selectionStart;
    const textBeforeCursor = messageText.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      mentionQuery = atMatch[1].toLowerCase();
    } else {
      mentionQuery = null;
    }
  }

  function insertMention(agentName: string) {
    if (!textareaEl) return;
    const cursorPos = textareaEl.selectionStart;
    const textBeforeCursor = messageText.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      const start = cursorPos - atMatch[0].length;
      messageText = messageText.slice(0, start) + `@${agentName} ` + messageText.slice(cursorPos);
      mentionQuery = null;
      setTimeout(() => {
        if (textareaEl) {
          const newPos = start + agentName.length + 2;
          textareaEl.setSelectionRange(newPos, newPos);
          textareaEl.focus();
        }
      }, 0);
    }
  }

  function getFilteredAgents(): Agent[] {
    if (mentionQuery === null) return [];
    return agents.filter(a => 
      a.name.toLowerCase().startsWith(mentionQuery) ||
      a.name.toLowerCase().includes(mentionQuery)
    ).slice(0, 5);
  }

  function getThreadLabel(thread: ChatThread): string {
    return thread.title ?? `Thread ${thread.id.slice(0, 8)}`;
  }

  function getLastPreview(thread: ChatThread): string {
    return (thread as unknown as Record<string, unknown>).lastMessagePreview as string | null ?? '';
  }

  function formatFleetEventType(type: string): string {
    const map: Record<string, string> = {
      'fleet.verdict.confirmed': 'Verdict',
      'fleet.class.transition': 'Class Transition',
      'fleet.dna.captured': 'DNA Captured',
      'fleet.pioneer.detected': 'Pioneer',
      'soul_promoted': 'Promoted',
      'soul_demoted': 'Demoted',
      'soul_retired': 'Retired',
    };
    return map[type] ?? type;
  }

  function getFleetEventIcon(type: string): string {
    if (type.includes('promoted') || type.includes('pioneer')) return '▲';
    if (type.includes('demoted') || type.includes('retired')) return '▼';
    if (type.includes('dna') || type.includes('captured')) return '◆';
    return '●';
  }

  onMount(() => {
    if (threads.length > 0 && threads[0]) {
      selectThread(threads[0].id);
    }

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

      if (
        event.type.startsWith('fleet.') ||
        event.type === 'soul_promoted' ||
        event.type === 'soul_demoted' ||
        event.type === 'soul_retired' ||
        event.type === 'pioneer_detected'
      ) {
        const payload = event.payload as Record<string, unknown>;
        const fleetEvent: FleetEvent = {
          id: String(event.id),
          type: event.type,
          description: (payload.description as string) ?? formatFleetEventType(event.type),
          timestamp: event.createdAt,
          payload: payload,
        };
        fleetEvents = [...fleetEvents, fleetEvent];
        if (selectedTab === 'fleet') {
          scrollFleetToBottom();
        }
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
    <!-- Tab switcher -->
    <div class="tab-switcher">
      <button
        class="tab-btn"
        class:active={selectedTab === 'threads'}
        onclick={() => selectedTab = 'threads'}
      >
        Threads
      </button>
      <button
        class="tab-btn"
        class:active={selectedTab === 'fleet'}
        onclick={() => selectFleet()}
      >
        Fleet
      </button>
    </div>

    {#if selectedTab === 'threads'}
      {#if threads.length === 0}
        <p class="empty-threads">No threads yet. Start a conversation with Indra or a crew member.</p>
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
      <div class="fleet-indicator">
        <span class="fleet-dot" aria-hidden="true"></span>
        <span class="fleet-label">Live fleet events</span>
      </div>
    {/if}
  </aside>

  <!-- Message panel -->
  <div class="message-panel" aria-label="Messages">
    {#if selectedTab === 'fleet'}
      <!-- Fleet event feed -->
      <div
        class="fleet-list"
        bind:this={fleetListEl}
        aria-live="polite"
      >
        {#if fleetEvents.length === 0}
          <div class="fleet-empty">
            <p class="empty-state">No fleet events yet. Events will appear here as they occur.</p>
          </div>
        {:else}
          {#each fleetEvents as event (event.id)}
            <div class="fleet-event">
              <span class="fleet-icon" aria-hidden="true">{getFleetEventIcon(event.type)}</span>
              <div class="fleet-event-content">
                <span class="fleet-event-type">{formatFleetEventType(event.type)}</span>
                <span class="fleet-event-desc">{event.description}</span>
                <span class="fleet-event-time">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          {/each}
        {/if}
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
            <ChatBubble
              variant={message.senderType === 'user' ? 'user' : 'agent'}
              sender={message.senderType === 'agent' && message.senderId ? message.senderId.slice(0, 8) : undefined}
              text={message.body}
            />
          {/each}

          {#if isTyping}
            <ChatBubble variant="agent" typing />
          {/if}
        {/if}
      </div>

      <!-- Message input with @-mention support -->
      <div class="message-input">
        <div class="textarea-wrapper">
          <textarea
            class="input-textarea"
            placeholder="Write a message... (use @ to mention agents)"
            bind:value={messageText}
            bind:this={textareaEl}
            onkeydown={handleKeydown}
            oninput={handleInput}
            rows={2}
            disabled={sending}
            aria-label="Message input"
          ></textarea>
          {#if mentionQuery !== null && getFilteredAgents().length > 0}
            <div class="mention-popup" bind:this={mentionPopupEl}>
              {#each getFilteredAgents() as agent (agent.id)}
                <button
                  class="mention-item"
                  onclick={() => insertMention(agent.name)}
                >
                  <span class="mention-avatar" aria-hidden="true">
                    {agent.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span class="mention-name">{agent.name}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <button
          class="btn-send"
          onclick={handleSend}
          disabled={sending || !messageText.trim()}
          aria-label="Send message"
        >Send</button>
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
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    padding: var(--space-lg) var(--space-md);
    margin: 0;
    line-height: 1.5;
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

  /* ── Tab switcher ─────────────────────────────────────── */
  .tab-switcher {
    display: flex;
    padding: var(--space-sm) var(--space-md);
    gap: var(--space-xs);
    border-bottom: 1px solid var(--fo-border);
  }

  :global(body.back-office) .tab-switcher {
    border-bottom-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .tab-btn {
    flex: 1;
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    padding: 6px 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tab-btn:hover {
    color: var(--ink);
    background: var(--fo-bg2);
  }

  .tab-btn.active {
    color: var(--fo-plum);
    background: var(--fo-plum-p);
    border-color: var(--fo-plum);
  }

  :global(body.back-office) .tab-btn:hover {
    color: var(--bo-text);
    background: rgba(124, 58, 237, 0.08);
  }

  :global(body.back-office) .tab-btn.active {
    color: var(--bo-vb);
    background: rgba(124, 58, 237, 0.15);
    border-color: var(--bo-violet);
  }

  /* ── Fleet indicator ─────────────────────────────────── */
  .fleet-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
  }

  .fleet-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--fo-plum);
    animation: pulse 2s infinite;
  }

  :global(body.back-office) .fleet-dot {
    background: var(--bo-violet);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* ── Fleet event feed ────────────────────────────────── */
  .fleet-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .fleet-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-xl);
  }

  .fleet-event {
    display: flex;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--fo-bg2);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--fo-plum);
  }

  :global(body.back-office) .fleet-event {
    background: rgba(124, 58, 237, 0.08);
    border-left-color: var(--bo-violet);
  }

  .fleet-icon {
    font-size: 12px;
    color: var(--fo-plum);
    flex-shrink: 0;
    padding-top: 2px;
  }

  :global(body.back-office) .fleet-icon {
    color: var(--bo-violet);
  }

  .fleet-event-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .fleet-event-type {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    color: var(--fo-plum);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  :global(body.back-office) .fleet-event-type {
    color: var(--bo-violet);
  }

  .fleet-event-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink);
    line-height: 1.4;
  }

  :global(body.back-office) .fleet-event-desc {
    color: var(--bo-text);
  }

  .fleet-event-time {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--muted);
    margin-top: 2px;
  }

  /* ── Mention autocomplete ────────────────────────────── */
  .textarea-wrapper {
    flex: 1;
    position: relative;
  }

  .mention-popup {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    z-index: 100;
  }

  :global(body.back-office) .mention-popup {
    background: var(--bo-card);
    border-color: var(--bo-border, rgba(124, 58, 237, 0.15));
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.15);
  }

  .mention-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }

  .mention-item:hover {
    background: var(--fo-bg2);
  }

  :global(body.back-office) .mention-item:hover {
    background: rgba(124, 58, 237, 0.08);
  }

  .mention-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--fo-plum-p);
    color: var(--fo-plum);
    font-family: var(--font-body);
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  :global(body.back-office) .mention-avatar {
    background: rgba(124, 58, 237, 0.15);
    color: var(--bo-vb);
  }

  .mention-name {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink);
  }

  :global(body.back-office) .mention-name {
    color: var(--bo-text);
  }
</style>
