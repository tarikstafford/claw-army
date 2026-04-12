<script lang="ts">
  import { enhance } from '$app/forms';
  import Accordion from '$lib/components/Accordion.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let commentBody = $state('');
  let submitting = $state(false);
  let submitError = $state('');

  const OLDER_COMMENT_THRESHOLD = 5;

  const recentComments = $derived(
    data.comments.length > OLDER_COMMENT_THRESHOLD
      ? data.comments.slice(-OLDER_COMMENT_THRESHOLD)
      : data.comments
  );
  const olderComments = $derived(
    data.comments.length > OLDER_COMMENT_THRESHOLD
      ? data.comments.slice(0, -OLDER_COMMENT_THRESHOLD)
      : []
  );

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'open': return 'open';
      case 'in_progress': return 'in progress';
      case 'blocked': return 'blocked';
      case 'done': return 'done';
      default: return status.toLowerCase();
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'open': return 'var(--fo-plum-m)';
      case 'in_progress': return 'var(--fo-gold, #B8965A)';
      case 'blocked': return 'var(--error)';
      case 'done': return 'var(--bo-teal, #2DD4BF)';
      default: return 'var(--text-muted)';
    }
  }
</script>

<div class="issue-detail">
  <div class="back-row">
    <a href="/office/issues" class="back-link">&larr; Issues</a>
  </div>

  <div class="issue-header">
    <h1 class="issue-title">{data.issue.title}</h1>
    <div class="issue-badges">
      <span class="status-badge" style="color: {getStatusColor(data.issue.status)}">
        {getStatusLabel(data.issue.status)}
      </span>
    </div>
  </div>

  {#if data.issue.body}
    <div class="issue-body t-body">
      {data.issue.body}
    </div>
  {/if}

  <div class="issue-meta">
    <div class="meta-row">
      <span class="meta-label">Created</span>
      <span class="meta-value">{formatDate(data.issue.createdAt)}</span>
    </div>
    {#if data.issue.projectId}
      <div class="meta-row">
        <span class="meta-label">Project</span>
        <span class="meta-value">
          <a href="/office/projects/{data.issue.projectId}" class="meta-link">View project</a>
        </span>
      </div>
    {/if}
  </div>

  <!-- Comments section -->
  <div class="comments-section">
    <h2 class="comments-heading">Comments</h2>

    {#if olderComments.length > 0}
      <Accordion label="OLDER COMMENTS" color="var(--text-muted)" sublabel="{olderComments.length} comment{olderComments.length !== 1 ? 's' : ''}">
        <div class="comments-list">
          {#each olderComments as comment}
            <div class="comment">
              <div class="comment-meta">
                <span class="comment-author">{comment.senderType ?? 'User'}</span>
                <span class="comment-time">{formatDate(comment.createdAt)}</span>
              </div>
              <div class="comment-body"><Markdown content={comment.body} /></div>
            </div>
          {/each}
        </div>
      </Accordion>
    {/if}

    {#if recentComments.length === 0 && olderComments.length === 0}
      <p class="no-comments">No comments yet.</p>
    {:else}
      <div class="comments-list">
        {#each recentComments as comment}
          <div class="comment">
            <div class="comment-meta">
              <span class="comment-author">{comment.senderType ?? 'User'}</span>
              <span class="comment-time">{formatDate(comment.createdAt)}</span>
            </div>
            <div class="comment-body"><Markdown content={comment.body} /></div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Comment form -->
    <form
      method="POST"
      action="?/addComment"
      use:enhance={() => {
        submitting = true;
        submitError = '';
        return async ({ result, update }) => {
          submitting = false;
          if (result.type === 'failure') {
            submitError = (result.data?.error as string) ?? 'Failed to post comment';
          } else {
            commentBody = '';
            await update();
          }
        };
      }}
      class="comment-form"
    >
      <textarea
        name="body"
        bind:value={commentBody}
        placeholder="Add a comment..."
        class="comment-input"
        rows="3"
        disabled={submitting}
        aria-label="Add a comment"
      ></textarea>
      {#if submitError}
        <p class="form-error" role="alert">{submitError}</p>
      {/if}
      <div class="form-actions">
        <button type="submit" class="btn-primary" disabled={submitting || !commentBody.trim()}>
          {submitting ? 'Posting...' : 'Post comment'}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .issue-detail {
    max-width: 800px;
  }

  .back-row {
    margin-bottom: var(--space-xl);
  }

  .back-link {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.15s;
  }

  .back-link:hover {
    color: var(--fo-plum);
  }

  .issue-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-lg);
    margin-bottom: var(--space-xl);
    flex-wrap: wrap;
  }

  .issue-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--fo-plum);
    margin: 0;
    flex: 1;
  }

  .issue-badges {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .status-badge {
    font-family: var(--font-body);
    font-size: 13px;
  }

  .issue-body {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.8;
    margin-bottom: var(--space-xl);
    white-space: pre-wrap;
  }

  .issue-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding-bottom: var(--space-xl);
    border-bottom: 1px solid var(--fo-border);
    margin-bottom: var(--space-xl);
  }

  .meta-row {
    display: flex;
    gap: var(--space-xl);
  }

  .meta-label {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    width: 100px;
    flex-shrink: 0;
  }

  .meta-value {
    font-family: var(--font-body);
    font-size: 13px;
  }

  .meta-link {
    color: var(--fo-plum);
    text-decoration: none;
  }

  .meta-link:hover {
    text-decoration: underline;
  }

  .comments-section {
    margin-top: var(--space-xl);
  }

  .comments-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--fo-plum);
    margin: 0 0 var(--space-xl);
  }

  .comments-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    margin-bottom: var(--space-xl);
  }

  .comment {
    padding: var(--space-lg);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
  }

  .comment-meta {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-sm);
  }

  .comment-author {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
  }

  .comment-time {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
  }

  .comment-body {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.8;
    margin: 0;
    white-space: pre-wrap;
  }

  .no-comments {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: var(--space-xl);
  }

  .comment-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    margin-top: var(--space-xl);
  }

  .comment-input {
    font-family: var(--font-body);
    font-size: 14px;
    padding: 12px 14px;
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    color: inherit;
    resize: vertical;
    line-height: 1.65;
    width: 100%;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.15s;
  }

  .comment-input:focus {
    border-color: var(--fo-plum-m);
    outline: 2px solid var(--fo-plum-p);
    outline-offset: 1px;
  }

  .comment-input:disabled {
    opacity: 0.6;
  }

  .form-error {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--error);
    margin: 0;
  }

  .form-actions {
    display: flex;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 10px 18px;
    background: var(--accent);
    color: #fff;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-m);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

</style>
