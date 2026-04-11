<script lang="ts">
  import { onMount, tick } from 'svelte';
  import ChatBubble from '$lib/components/ChatBubble.svelte';
  import { subscribeWS, type LiveEvent } from '$lib/ws';
  import { getChatMessages, sendChatMessage, executeCommand } from '$lib/api';
  import type { ChatMessage, ChatThread } from '$lib/api';
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

  let showAutocomplete = $state(false);
  let autocompleteIndex = $state(0);
  let filteredCommands = $state<CommandDef[]>([]);
  let pendingCommand = $state<{ command: string; args: string[] } | null>(null);
  let showConfirmDialog = $state(false);
  let confirmDialogMessage = $state('');

  let textareaEl: HTMLTextAreaElement | undefined;

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

  function updateAutocomplete() {
    const filtered = filterCommands(messageText);
    filteredCommands = filtered;
    showAutocomplete = filtered.length > 0 && messageText.startsWith('/');
    autocompleteIndex = 0;
  }

  function selectCommand(cmd: CommandDef) {
    if (cmd.argsHint && cmd.argsHint.startsWith('<')) {
      messageText = `/${cmd.name} `;
    } else if (cmd.argsHint) {
      messageText = `/${cmd.name} `;
    } else {
      messageText = `/${cmd.name}`;
    }
    showAutocomplete = false;
    textareaEl?.focus();
  }

  function handleInput() {
    updateAutocomplete();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (showAutocomplete && filteredCommands.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        autocompleteIndex = (autocompleteIndex + 1) % filteredCommands.length;
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        autocompleteIndex = (autocompleteIndex - 1 + filteredCommands.length) % filteredCommands.length;
        return;
      }
      if (event.key === 'Escape') {
        showAutocomplete = false;
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        selectCommand(filteredCommands[autocompleteIndex]!);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();

      const parsed = parseCommand(messageText);
      if (parsed && parsed.command) {
        const cmd = COMMANDS.find(c => c.name === parsed.command);
        if (cmd?.modifiesState) {
          pendingCommand = parsed;
          confirmDialogMessage = `Execute /${cmd.name}?`;
          showConfirmDialog = true;
          return;
        }
        handleSend();
      } else {
        handleSend();
      }
    }
  }

  function cancelConfirm() {
    showConfirmDialog = false;
    pendingCommand = null;
  }

  async function confirmExecute() {
    showConfirmDialog = false;
    if (pendingCommand) {
      messageText = `/${pendingCommand.command} ${pendingCommand.args.join(' ')}`.trim();
      pendingCommand = null;
    }
    await handleSend();
  }

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
    showAutocomplete = false;

    const parsed = parseCommand(body);
    const isCommand = parsed && parsed.command && COMMANDS.some(c => c.name === parsed.command);

    if (isCommand && parsed) {
      sending = true;
      try {
        const companyId = data.companyId ?? '';
        const result = await executeCommand(companyId, parsed.command, parsed.args);

        const systemMessage: ChatMessage = {
          id: `system-${Date.now()}`,
          threadId: selectedThreadId,
          body: result.message,
          senderType: 'system',
          senderId: null,
          createdAt: new Date().toISOString(),
        };
        messages = [...messages, systemMessage];
        await scrollToBottom();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Command execution failed';
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          threadId: selectedThreadId,
          body: `Error: ${errorMessage}`,
          senderType: 'system',
          senderId: null,
          createdAt: new Date().toISOString(),
        };
        messages = [...messages, errorMsg];
        await scrollToBottom();
      } finally {
        sending = false;
      }
      return;
    }

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

  function getThreadLabel(thread: ChatThread): string {
    return thread.title ?? `Thread ${thread.id.slice(0, 8)}`;
  }

  function getLastPreview(thread: ChatThread): string {
    return (thread as unknown as Record<string, unknown>).lastMessagePreview as string | null ?? '';
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
      <div class="message-input-wrapper">
        {#if showAutocomplete && filteredCommands.length > 0}
          <div class="command-autocomplete" role="listbox" aria-label="Commands">
            {#each filteredCommands as cmd, i (cmd.name)}
              <button
                class="autocomplete-item"
                class:selected={i === autocompleteIndex}
                onclick={() => selectCommand(cmd)}
                onmouseenter={() => { autocompleteIndex = i; }}
                role="option"
                aria-selected={i === autocompleteIndex}
              >
                <span class="cmd-name">/{cmd.name}</span>
                <span class="cmd-hint">{cmd.argsHint}</span>
                <span class="cmd-desc">{cmd.description}</span>
              </button>
            {/each}
          </div>
        {/if}

        <div class="message-input">
          <textarea
            class="input-textarea"
            placeholder="Write a message or /command..."
            bind:value={messageText}
            oninput={handleInput}
            onkeydown={handleKeydown}
            bind:this={textareaEl}
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
      </div>

      {#if showConfirmDialog}
        <div class="confirm-overlay" onclick={cancelConfirm} role="presentation">
          <div class="confirm-dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <p class="confirm-message">{confirmDialogMessage}</p>
            <div class="confirm-actions">
              <button class="btn-cancel" onclick={cancelConfirm}>Cancel</button>
              <button class="btn-confirm" onclick={confirmExecute}>Execute</button>
            </div>
          </div>
        </div>
      {/if}
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

  /* ── Command autocomplete ─────────────────────────────── */
  .message-input-wrapper {
    position: relative;
  }

  .command-autocomplete {
    position: absolute;
    bottom: 100%;
    left: var(--space-md);
    right: var(--space-md);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    z-index: 100;
    margin-bottom: 4px;
  }

  :global(body.back-office) .command-autocomplete {
    background: var(--bo-card);
    border-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .autocomplete-item {
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

  .autocomplete-item:hover,
  .autocomplete-item.selected {
    background: var(--fo-bg2);
  }

  :global(body.back-office) .autocomplete-item:hover,
  :global(body.back-office) .autocomplete-item.selected {
    background: rgba(124, 58, 237, 0.10);
  }

  .cmd-name {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--fo-plum);
  }

  :global(body.back-office) .cmd-name {
    color: var(--bo-violet);
  }

  .cmd-hint {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
  }

  .cmd-desc {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--muted);
    margin-left: auto;
  }

  /* ── Confirm dialog ──────────────────────────────────── */
  .confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .confirm-dialog {
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    max-width: 360px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  :global(body.back-office) .confirm-dialog {
    background: var(--bo-card);
    border-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  .confirm-message {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink);
    margin: 0 0 var(--space-md) 0;
    line-height: 1.5;
  }

  :global(body.back-office) .confirm-message {
    color: var(--bo-text);
  }

  .confirm-actions {
    display: flex;
    gap: var(--space-sm);
    justify-content: flex-end;
  }

  .btn-cancel {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
    background: var(--fo-bg2);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    padding: 6px 14px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-cancel:hover {
    background: var(--fo-border);
  }

  :global(body.back-office) .btn-cancel {
    color: var(--bo-text);
    background: rgba(124, 58, 237, 0.08);
    border-color: var(--bo-border, rgba(124, 58, 237, 0.15));
  }

  :global(body.back-office) .btn-cancel:hover {
    background: rgba(124, 58, 237, 0.15);
  }

  .btn-confirm {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: var(--fo-plum);
    border: none;
    border-radius: var(--radius-md);
    padding: 6px 14px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-confirm:hover {
    background: var(--fo-plum-m);
  }

  :global(body.back-office) .btn-confirm {
    background: var(--bo-violet);
  }

  :global(body.back-office) .btn-confirm:hover {
    background: var(--bo-vb);
  }
</style>
