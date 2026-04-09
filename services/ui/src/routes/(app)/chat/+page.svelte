<script lang="ts">
  import { onMount, tick } from 'svelte';
  import ChatBubble from '$lib/components/ChatBubble.svelte';
  import { subscribeWS, type LiveEvent, isFleetLifecycleEvent, type FleetLifecycleEvent } from '$lib/ws';
  import { getChatMessages, sendChatMessage, getFleetEvents, type FleetEvent } from '$lib/api';
  import type { ChatMessage, ChatThread } from '$lib/api';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let viewMode = $state<'threads' | 'fleet'>('threads');
  let threads = $state<ChatThread[]>(data.threads ?? []);
  let selectedThreadId = $state<string | null>(null);
  let messages = $state<ChatMessage[]>([]);
  let messageText = $state('');
  let sending = $state(false);
  let loadingMessages = $state(false);
  let messageListEl: HTMLElement | undefined;
  let isTyping = $state(false);

  let fleetEvents = $state<FleetEvent[]>([]);
  let loadingFleetEvents = $state(false);
  let fleetListEl: HTMLElement | undefined;

  let mentionQuery = $state<string | null>(null);
  let mentionSuggestions = $state<Array<{ id: string; name: string }>>([]);
  let showMentionSuggestions = $state(false);
  let agents = $state<Array<{ id: string; name: string }>>([]);

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
    viewMode = 'threads';
    selectedThreadId = threadId;
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

  async function loadFleetEvents() {
    loadingFleetEvents = true;
    try {
      const events = await getFleetEvents(data.companyId);
      fleetEvents = events;
      await scrollFleetToBottom();
    } catch {
      fleetEvents = [];
    } finally {
      loadingFleetEvents = false;
    }
  }

  function switchToFleet() {
    viewMode = 'fleet';
    selectedThreadId = null;
    loadFleetEvents();
  }

  async function handleSend() {
    if (!selectedThreadId || !messageText.trim() || sending) return;

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
      if (showMentionSuggestions && mentionSuggestions.length > 0) {
        event.preventDefault();
        insertMention(mentionSuggestions[0]);
        return;
      }
      event.preventDefault();
      handleSend();
    }

    if (event.key === 'Escape' && showMentionSuggestions) {
      showMentionSuggestions = false;
      mentionQuery = null;
    }
  }

  function handleTextInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    const text = target.value;
    const cursorPos = target.selectionStart ?? text.length;

    const textBeforeCursor = text.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      mentionQuery = atMatch[1].toLowerCase();
      mentionSuggestions = agents.filter(a =>
        a.name.toLowerCase().startsWith(mentionQuery!)
      ).slice(0, 5);
      showMentionSuggestions = mentionSuggestions.length > 0;
    } else {
      showMentionSuggestions = false;
      mentionQuery = null;
    }
  }

  function insertMention(agent: { id: string; name: string }) {
    const textarea = document.querySelector('.input-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart ?? messageText.length;
    const textBeforeCursor = messageText.slice(0, cursorPos);
    const textAfterCursor = messageText.slice(cursorPos);

    const atIndex = textBeforeCursor.lastIndexOf('@');
    const newTextBefore = textBeforeCursor.slice(0, atIndex);

    messageText = `${newTextBefore}@${agent.name} ${textAfterCursor}`;
    showMentionSuggestions = false;
    mentionQuery = null;

    setTimeout(() => {
      const newCursorPos = newTextBefore.length + agent.name.length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  }

  function getThreadLabel(thread: ChatThread): string {
    return thread.title ?? `Thread ${thread.id.slice(0, 8)}`;
  }

  function getLastPreview(thread: ChatThread): string {
    return (thread as unknown as Record<string, unknown>).lastMessagePreview as string | null ?? '';
  }

  function formatEventType(type: FleetEvent['type']): string {
    switch (type) {
      case 'fleet.verdict.confirmed': return 'Verdict';
      case 'fleet.class.transition': return 'Class Change';
      case 'fleet.dna.captured': return 'DNA Captured';
      case 'fleet.pioneer.detected': return 'Pioneer';
      default: return 'Event';
    }
  }

  function formatEventIcon(type: FleetEvent['type']): string {
    switch (type) {
      case 'fleet.verdict.confirmed': return '⬆';
      case 'fleet.class.transition': return '🔄';
      case 'fleet.dna.captured': return '🧬';
      case 'fleet.pioneer.detected': return '⭐';
      default: return '•';
    }
  }

  onMount(() => {
    if (threads.length > 0 && threads[0]) {
      selectThread(threads[0].id);
    }

    agents = threads.map(t => ({
      id: t.agentId,
      name: getThreadLabel(t),
    })).filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i);

    const unsub = subscribeWS((event: LiveEvent) => {
      if (event.type === 'chat.message.created') {
        const payload = event.payload as Record<string, unknown>;
        const threadId = payload.threadId as string | undefined;

        if (viewMode === 'threads' && threadId === selectedThreadId) {
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
        if (viewMode === 'threads' && payload.threadId === selectedThreadId) {
          isTyping = true;
          setTimeout(() => { isTyping = false; }, 3000);
        }
      }

      if (isFleetLifecycleEvent(event)) {
        const payload = event.payload as FleetLifecycleEvent;
        if (viewMode === 'fleet') {
          const newEvent: FleetEvent = {
            id: `ws-${event.id}`,
            type: `fleet.${payload.type.replace('_', '.')}` as FleetEvent['type'],
            timestamp: payload.timestamp,
            botId: payload.botId,
            summary: payload.description,
            executionId: payload.executionId,
            taskCategory: payload.taskCategory,
          };
          if ('toClass' in payload) {
            newEvent.newClass = payload.toClass;
          }
          fleetEvents = [newEvent, ...fleetEvents];
          scrollFleetToBottom();
        }
      }
    });

    return unsub;
  });

  $effect(() => {
    if (viewMode === 'threads' && messages.length > 0) {
      scrollToBottom();
    }
  });
</script>

<div class="chat-layout">
  <!-- Thread sidebar -->
  <aside class="thread-sidebar" aria-label="Conversation threads">
    <div class="sidebar-header">
      <button
        class="fleet-tab"
        class:active={viewMode === 'fleet'}
        onclick={switchToFleet}
      >
        <span class="fleet-icon" aria-hidden="true">⚡</span>
        Fleet
      </button>
    </div>

    {#if viewMode === 'threads'}
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
      <div class="fleet-header">
        <h2 class="fleet-title">Fleet Activity</h2>
        <span class="fleet-subtitle">System events across your fleet</span>
      </div>
    {/if}
  </aside>

  <!-- Message panel -->
  <div class="message-panel" aria-label="Messages">
    {#if viewMode === 'fleet'}
      <div
        class="fleet-list"
        bind:this={fleetListEl}
        aria-live="polite"
        aria-busy={loadingFleetEvents}
      >
        {#if loadingFleetEvents}
          <div class="fleet-skeleton" aria-hidden="true">
            <div class="skeleton-event"></div>
            <div class="skeleton-event"></div>
            <div class="skeleton-event"></div>
          </div>
        {:else if fleetEvents.length === 0}
          <p class="empty-state">No fleet events yet. Events will appear here as your agents work.</p>
        {:else}
          {#each fleetEvents as event (event.id)}
            <div class="fleet-event">
              <span class="event-icon" aria-hidden="true">{formatEventIcon(event.type)}</span>
              <div class="event-content">
                <span class="event-type">{formatEventType(event.type)}</span>
                <span class="event-summary">{event.summary}</span>
                <span class="event-time">
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

      <!-- Message input -->
      <div class="message-input">
        {#if showMentionSuggestions && mentionSuggestions.length > 0}
          <div class="mention-dropdown" role="listbox">
            {#each mentionSuggestions as suggestion (suggestion.id)}
              <button
                class="mention-item"
                onclick={() => insertMention(suggestion)}
                role="option"
              >
                <span class="mention-avatar" aria-hidden="true">
                  {suggestion.name.slice(0, 1).toUpperCase()}
                </span>
                <span class="mention-name">{suggestion.name}</span>
              </button>
            {/each}
          </div>
        {/if}

        <textarea
          class="input-textarea"
          placeholder="Write a message... (use @ to mention agents)"
          bind:value={messageText}
          onkeydown={handleKeydown}
          oninput={handleTextInput}
          rows={2}
          disabled={sending}
          aria-label="Message input"
        ></textarea>
        <button
          class="btn-send"
          onclick={handleSend}
          disabled={sending || !messageText.trim()}
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

  /* ── Sidebar header / Fleet tab ──────────────────────── */
  .sidebar-header {
    padding: 0 var(--space-sm) var(--space-sm);
    border-bottom: 1px solid var(--fo-border);
    margin-bottom: var(--space-sm);
  }

  :global(body.back-office) .sidebar-header {
    border-bottom-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .fleet-tab {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: var(--ink);
    transition: background 0.15s, border-color 0.15s;
  }

  .fleet-tab:hover {
    background: var(--fo-bg2);
  }

  .fleet-tab.active {
    background: var(--fo-plum-p);
    border-color: var(--fo-plum-m);
    color: var(--fo-plum);
  }

  :global(body.back-office) .fleet-tab {
    color: var(--bo-text);
    border-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  :global(body.back-office) .fleet-tab:hover {
    background: rgba(124, 58, 237, 0.08);
  }

  :global(body.back-office) .fleet-tab.active {
    background: rgba(124, 58, 237, 0.15);
    border-color: var(--bo-violet);
    color: var(--bo-vb);
  }

  .fleet-icon {
    font-size: 14px;
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

  /* ── Fleet header ───────────────────────────────────── */
  .fleet-header {
    padding: 0 var(--space-md);
    margin-bottom: var(--space-md);
  }

  .fleet-title {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
    margin: 0 0 4px;
  }

  :global(body.back-office) .fleet-title {
    color: var(--bo-text);
  }

  .fleet-subtitle {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
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

  /* ── Fleet events list ──────────────────────────────── */
  .fleet-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .fleet-event {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--fo-bg2);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--fo-plum);
  }

  :global(body.back-office) .fleet-event {
    background: rgba(124, 58, 237, 0.06);
    border-left-color: var(--bo-violet);
  }

  .event-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .event-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .event-type {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    color: var(--fo-plum);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  :global(body.back-office) .event-type {
    color: var(--bo-vb);
  }

  .event-summary {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink);
    line-height: 1.4;
  }

  :global(body.back-office) .event-summary {
    color: var(--bo-text);
  }

  .event-time {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
  }

  .fleet-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .skeleton-event {
    height: 60px;
    background: var(--fo-bg2);
    border-radius: var(--radius-md);
  }

  :global(body.back-office) .skeleton-event {
    background: rgba(124, 58, 237, 0.08);
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
    position: relative;
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

  /* ── Mention dropdown ───────────────────────────────── */
  .mention-dropdown {
    position: absolute;
    bottom: 100%;
    left: var(--space-md);
    right: var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
  }

  :global(body.back-office) .mention-dropdown {
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
    transition: background 0.15s;
  }

  .mention-item:hover {
    background: var(--fo-bg2);
  }

  :global(body.back-office) .mention-item:hover {
    background: rgba(124, 58, 237, 0.08);
  }

  .mention-avatar {
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
