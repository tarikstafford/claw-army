<script lang="ts">
  import type { Snippet } from 'svelte';

  let { variant, sender, text, typing = false, children }: {
    variant: 'user' | 'agent';
    sender?: string;
    text?: string;
    typing?: boolean;
    children?: Snippet;
  } = $props();
</script>

<div class="chat-bubble" class:user={variant === 'user'} class:agent={variant === 'agent'}>
  {#if variant === 'agent' && sender}
    <span class="chat-sender">{sender}</span>
  {/if}
  {#if typing}
    <div class="typing-indicator" aria-label="Agent is typing">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  {:else if text}
    <p class="chat-text">{text}</p>
  {:else if children}
    {@render children()}
  {/if}
</div>

<style>
  .chat-bubble {
    display: flex;
    flex-direction: column;
    width: fit-content;
    max-width: 76%;
    border-radius: var(--radius-md);
    padding: 9px 13px;
  }

  .chat-bubble.agent {
    background: var(--fo-bg2);
    border: 1px solid var(--fo-rule);
    align-self: flex-start;
  }

  .chat-bubble.user {
    background: var(--fo-plum);
    color: #fff;
    border: 1px solid transparent;
    align-self: flex-end;
  }

  .chat-bubble.agent .chat-text {
    font-family: var(--font-body);
    font-size: 13px;
    line-height: 1.65;
    color: var(--ink);
    margin: 0;
  }

  .chat-bubble.user .chat-text {
    font-family: var(--font-body);
    font-size: 13px;
    line-height: 1.65;
    color: #fff;
    margin: 0;
  }

  .chat-sender {
    font-family: var(--font-label);
    font-size: 5px;
    color: var(--muted);
    letter-spacing: 0.08em;
    display: block;
    margin-bottom: 4px;
  }

  .typing-indicator {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 4px 0;
  }

  .typing-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--fo-plum);
    animation: typing-bounce 1.1s infinite;
  }

  .typing-dot:nth-child(2) {
    animation-delay: 0.18s;
  }

  .typing-dot:nth-child(3) {
    animation-delay: 0.36s;
  }

  @keyframes typing-bounce {
    0%, 80%, 100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-5px);
    }
  }
</style>
