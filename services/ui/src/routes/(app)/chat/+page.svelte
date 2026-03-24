<script lang="ts">
  import { onMount, tick } from 'svelte';
  import ChatBubble from '$lib/components/ChatBubble.svelte';
  import { subscribeWS, type LiveEvent } from '$lib/ws';
  import { getChatMessages, sendChatMessage } from '$lib/api';
  import type { ChatMessage, ChatThread } from '$lib/api';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let threads = $state<ChatThread[]>(data.threads ?? []);
  let selectedThreadId = $state<string | null>(null);
  let messages = $state<ChatMessage[]>([]);
  let messageText = $state('');
  let sending = $state(false);
  let loadingMessages = $state(false);
  let messageListEl: HTMLElement | undefined;
  let isTyping = $state(false);

  async function scrollToBottom() {
    await tick();
    if (messageListEl) {
      messageListEl.scrollTop = messageListEl.scrollHeight;
    }
  }

  async function selectThread(threadId: string) {
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

  async function handleSend() {
    if (!selectedThreadId || !messageText.trim() || sending) return;

    const body = messageText.trim();
    messageText = '';

    // Optimistic UI — append immediately as pending
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
      // Replace optimistic message with confirmed
      messages = messages.map((m) => m.id === optimisticId ? confirmed : m);
    } catch {
      // Remove optimistic on failure, restore input
      messages = messages.filter((m) => m.id !== optimisticId);
      messageText = body;
    } finally {
      sending = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function getThreadLabel(thread: ChatThread): string {
    return thread.title ?? `Thread ${thread.id.slice(0, 8)}`;
  }

  function getLastPreview(thread: ChatThread): string {
    return (thread as unknown as Record<string, unknown>).lastMessagePreview as string | null ?? '';
  }

  onMount(() => {
    // Auto-select first thread if available
    if (threads.length > 0 && threads[0]) {
      selectThread(threads[0].id);
    }

    const unsub = subscribeWS((event: LiveEvent) => {
      if (event.type === 'chat.message.created') {
        const payload = event.payload as Record<string, unknown>;
        const threadId = payload.threadId as string | undefined;

        if (threadId === selectedThreadId) {
          // Fetch and append new message for active thread
          getChatMessages(threadId, { after: messages.at(-1)?.id })
            .then(({ messages: newMsgs }) => {
              if (newMsgs.length > 0) {
                messages = [...messages, ...newMsgs];
                scrollToBottom();
              }
            })
            .catch(() => { /* ignore */ });
        } else if (threadId) {
          // Update thread list preview for inactive thread
          threads = threads.map((t) =>
            t.id === threadId
              ? { ...t, updatedAt: new Date().toISOString() }
              : t
          );
        }

        // Show typing indicator briefly for agent messages
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
    });

    return unsub;
  });

  $effect(() => {
    // Auto-scroll when messages change
    if (messages.length > 0) {
      scrollToBottom();
    }
  });
</script>

<div class="chat-layout">
  <!-- Thread sidebar -->
  <aside class="thread-sidebar" aria-label="Conversation threads">
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
  </aside>

  <!-- Message panel -->
  <div class="message-panel" aria-label="Messages">
    {#if !selectedThreadId}
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
        <textarea
          class="input-textarea"
          placeholder="Write a message..."
          bind:value={messageText}
          onkeydown={handleKeydown}
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
</style>
