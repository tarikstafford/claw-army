<script lang="ts">
  import type { PageData } from './$types';
  import StarRating from '$lib/components/StarRating.svelte';

  interface ReviewSummary {
    targetId: string;
    avgRating: number;
    count: number;
  }

  interface Review {
    id: string;
    userId: string;
    targetId: string;
    targetType: string;
    rating: number;
    reviewText: string | null;
    createdAt: string;
    updatedAt: string;
  }

  let { data }: { data: PageData } = $props();

  let selectedEntry = $state<Record<string, unknown> | null>(null);
  let acquiringId = $state<string | null>(null);
  let filterTaskCategory = $state(data.filters.taskCategory ?? '');
  let filterMinScore = $state(data.filters.minScore ?? '');
  let filterSortBy = $state(data.filters.sortBy ?? 'score');

  // Reviews state
  let reviewSummaries = $state<Record<string, ReviewSummary>>({});
  let selectedReviews = $state<Review[]>([]);
  let loadingReviews = $state(false);
  let reviewFormRating = $state(0);
  let reviewFormText = $state('');
  let submittingReview = $state(false);
  let reviewError = $state('');

  function buildUrl(page: number): string {
    const params = new URLSearchParams();
    if (filterTaskCategory) params.set('taskCategory', filterTaskCategory);
    if (filterMinScore) params.set('minScore', filterMinScore);
    if (filterSortBy) params.set('sortBy', filterSortBy);
    params.set('page', String(page));
    return `/akashic?${params.toString()}`;
  }

  async function handleAcquire(entryId: string) {
    acquiringId = entryId;
    try {
      const res = await fetch(`/api/akasa/akashic/${entryId}/acquire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: '', companyId: '' }),
      });
      if (res.ok) {
        window.location.href = '/office/agents';
      }
    } catch {
      acquiringId = null;
    }
  }

  async function loadReviewSummary(targetId: string) {
    try {
      const res = await fetch(`/api/akasa/reviews/summary?targetId=${targetId}`);
      if (res.ok) {
        const summary: ReviewSummary = await res.json();
        reviewSummaries = { ...reviewSummaries, [targetId]: summary };
      }
    } catch {
      // Non-critical — fail silently
    }
  }

  async function loadReviews(targetId: string) {
    loadingReviews = true;
    selectedReviews = [];
    try {
      const res = await fetch(`/api/akasa/reviews?targetId=${targetId}&targetType=soul`);
      if (res.ok) {
        selectedReviews = await res.json();
      }
    } catch {
      selectedReviews = [];
    } finally {
      loadingReviews = false;
    }
  }

  async function handleSelectEntry(entry: Record<string, unknown>) {
    if (selectedEntry?.id === entry.id) {
      selectedEntry = null;
      selectedReviews = [];
      return;
    }
    selectedEntry = entry;
    reviewFormRating = 0;
    reviewFormText = '';
    reviewError = '';
    await Promise.allSettled([
      loadReviewSummary(entry.id as string),
      loadReviews(entry.id as string),
    ]);
  }

  async function handleSubmitReview() {
    if (!selectedEntry || reviewFormRating < 1) {
      reviewError = 'Please select a rating';
      return;
    }

    submittingReview = true;
    reviewError = '';
    try {
      const res = await fetch('/api/akasa/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.session?.user?.email ?? 'anonymous',
          targetId: selectedEntry.id,
          targetType: 'soul',
          rating: reviewFormRating,
          reviewText: reviewFormText || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to submit review' }));
        reviewError = body.error ?? 'Failed to submit review';
        return;
      }
      // Refresh reviews and summary
      const targetId = selectedEntry.id as string;
      reviewFormRating = 0;
      reviewFormText = '';
      await Promise.allSettled([
        loadReviewSummary(targetId),
        loadReviews(targetId),
      ]);
    } catch {
      reviewError = 'Network error — please try again';
    } finally {
      submittingReview = false;
    }
  }

  async function handleDeleteReview(reviewId: string) {
    const userId = data.session?.user?.email ?? 'anonymous';
    try {
      const res = await fetch(`/api/akasa/reviews/${reviewId}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      if (res.ok && selectedEntry) {
        const targetId = selectedEntry.id as string;
        await Promise.allSettled([
          loadReviewSummary(targetId),
          loadReviews(targetId),
        ]);
      }
    } catch {
      // Non-critical
    }
  }

  // Load summaries for visible entries on mount
  $effect(() => {
    for (const entry of data.browse.entries) {
      if (!reviewSummaries[entry.id]) {
        loadReviewSummary(entry.id);
      }
    }
  });
</script>

<div class="akashic-page">
  <header class="page-header">
    <h1 class="page-title">Akashic Library</h1>
    <p class="page-subtitle">Acquire pre-evolved agent souls from the marketplace</p>
  </header>

  <div class="akashic-layout">
    <aside class="filter-sidebar">
      <div class="filter-section">
        <label class="filter-label" for="taskCategory">Task Category</label>
        <select id="taskCategory" class="filter-select" bind:value={filterTaskCategory}>
          <option value="">All categories</option>
          <option value="coding">Coding</option>
          <option value="research">Research</option>
          <option value="write">Writing</option>
          <option value="analysis">Analysis</option>
        </select>
      </div>

      <div class="filter-section">
        <label class="filter-label" for="minScore">Min Score</label>
        <input
          id="minScore"
          type="number"
          class="filter-input"
          placeholder="0.00"
          min="0"
          max="100"
          step="0.01"
          bind:value={filterMinScore}
        />
      </div>

      <div class="filter-section">
        <label class="filter-label" for="sortBy">Sort By</label>
        <select id="sortBy" class="filter-select" bind:value={filterSortBy}>
          <option value="score">Score</option>
          <option value="generation">Generation</option>
          <option value="acquiredCount">Most Acquired</option>
        </select>
      </div>

      <a href={buildUrl(1)} class="filter-apply-btn">Apply Filters</a>
    </aside>

    <main class="soul-grid-wrap">
      {#if data.browse.entries.length === 0}
        <div class="empty-state">
          <p class="empty-heading">No souls found</p>
          <p class="empty-body">Try adjusting your filters or check back later.</p>
        </div>
      {:else}
        <div class="soul-grid">
          {#each data.browse.entries as entry (entry.id)}
            <button
              class="soul-card"
              onclick={() => handleSelectEntry(entry)}
              aria-expanded={selectedEntry?.id === entry.id}
            >
              <div class="soul-card-header">
                <h3 class="soul-title">{entry.title ?? 'Untitled Soul'}</h3>
                <span class="soul-score">{Number(entry.compositeScore).toFixed(2)}</span>
              </div>

              <p class="soul-desc">{entry.description ?? ''}</p>

              <div class="soul-meta">
                <span class="meta-chip">Gen {entry.generation}</span>
                <span class="meta-chip">Depth {entry.mutationLineageDepth}</span>
                <span class="meta-chip acquired">{entry.acquiredCount} acquired</span>
              </div>

              {#if reviewSummaries[entry.id] && reviewSummaries[entry.id].count > 0}
                <div class="soul-rating-summary">
                  <StarRating rating={Math.round(reviewSummaries[entry.id].avgRating)} size="sm" />
                  <span class="rating-count">({reviewSummaries[entry.id].count})</span>
                </div>
              {/if}

              {#if entry.taskCategory}
                <span class="soul-category">{entry.taskCategory}</span>
              {/if}
            </button>
          {/each}
        </div>

        {#if selectedEntry}
          <section class="reviews-panel">
            <h2 class="reviews-heading">Reviews for {selectedEntry.title ?? 'Untitled Soul'}</h2>

            {#if reviewSummaries[selectedEntry.id as string]}
              {@const summary = reviewSummaries[selectedEntry.id as string]}
              <div class="reviews-summary-bar">
                <StarRating rating={Math.round(summary.avgRating)} size="md" />
                <span class="reviews-avg">{summary.avgRating.toFixed(1)}</span>
                <span class="reviews-count">{summary.count} review{summary.count !== 1 ? 's' : ''}</span>
              </div>
            {/if}

            <form class="review-form" onsubmit={(e) => { e.preventDefault(); handleSubmitReview(); }}>
              <div class="review-form-rating">
                <span class="review-form-label">Your rating</span>
                <StarRating rating={reviewFormRating} interactive={true} size="lg" onrate={(r) => { reviewFormRating = r; }} />
              </div>
              <textarea
                class="review-textarea"
                placeholder="Write a review (optional)"
                rows={3}
                bind:value={reviewFormText}
              ></textarea>
              {#if reviewError}
                <p class="review-error">{reviewError}</p>
              {/if}
              <button type="submit" class="review-submit-btn" disabled={submittingReview || reviewFormRating < 1}>
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>

            <div class="reviews-list">
              {#if loadingReviews}
                <p class="reviews-loading">Loading reviews...</p>
              {:else if selectedReviews.length === 0}
                <p class="reviews-empty">No reviews yet. Be the first to review this soul.</p>
              {:else}
                {#each selectedReviews as review (review.id)}
                  <div class="review-item">
                    <div class="review-item-header">
                      <StarRating rating={review.rating} size="sm" />
                      <span class="review-author">{review.userId}</span>
                      <span class="review-date">{new Date(review.createdAt).toLocaleDateString()}</span>
                      {#if review.userId === (data.session?.user?.email ?? 'anonymous')}
                        <button class="review-delete-btn" onclick={() => handleDeleteReview(review.id)}>Delete</button>
                      {/if}
                    </div>
                    {#if review.reviewText}
                      <p class="review-text">{review.reviewText}</p>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>
          </section>
        {/if}

        <nav class="pagination" aria-label="Browse pagination">
          {#if data.browse.page > 1}
            <a href={buildUrl(data.browse.page - 1)} class="page-btn prev">Previous</a>
          {/if}
          <span class="page-indicator">
            Page {data.browse.page} of {data.browse.totalPages}
          </span>
          {#if data.browse.page < data.browse.totalPages}
            <a href={buildUrl(data.browse.page + 1)} class="page-btn next">Next</a>
          {/if}
        </nav>
      {/if}
    </main>
  </div>
</div>

<style>
  .akashic-page {
    max-width: 1200px;
    padding: var(--space-2xl) var(--space-xl) var(--space-xl);
  }

  .page-header {
    margin-bottom: var(--space-xl);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 var(--space-xs);
    line-height: 1.1;
  }

  .page-subtitle {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text-muted);
    margin: 0;
  }

  .akashic-layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: var(--space-xl);
    align-items: start;
  }

  /* ── Filter sidebar ──────────────────────────── */
  .filter-sidebar {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .filter-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .filter-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
  }

  .filter-select,
  .filter-input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 13px;
    padding: var(--space-sm) var(--space-md);
    width: 100%;
    outline: none;
    transition: border-color 0.15s;
  }

  .filter-select:focus,
  .filter-input:focus {
    border-color: var(--accent-m);
  }

  .filter-apply-btn {
    display: block;
    text-align: center;
    background: var(--accent);
    color: white;
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-sm);
    text-decoration: none;
    transition: background 0.15s;
  }

  .filter-apply-btn:hover {
    background: var(--accent-m);
  }

  /* ── Soul grid ───────────────────────────────── */
  .soul-grid-wrap {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .soul-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-md);
  }

  .soul-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: border-color 0.15s, box-shadow 0.15s;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .soul-card:hover {
    border-color: var(--accent-m);
    box-shadow: 0 0 0 1px var(--accent-m);
  }

  .soul-card[aria-expanded="true"] {
    border-color: var(--accent);
  }

  .soul-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .soul-title {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
    line-height: 1.3;
  }

  .soul-score {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--karma);
    flex-shrink: 0;
  }

  .soul-desc {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .soul-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
    margin-top: var(--space-xs);
  }

  .meta-chip {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    background: var(--fo-rule);
    padding: 3px 6px;
    border-radius: 3px;
  }

  .meta-chip.acquired {
    color: var(--accent-teal);
  }

  .soul-category {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.08em;
    color: var(--accent);
    align-self: flex-start;
  }

  /* ── Empty state ─────────────────────────────── */
  .empty-state {
    padding: var(--space-3xl);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    text-align: center;
  }

  .empty-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 var(--space-sm);
  }

  .empty-body {
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }

  /* ── Pagination ──────────────────────────────── */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
  }

  .page-btn {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
    color: var(--accent-m);
    text-decoration: none;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    transition: border-color 0.15s;
  }

  .page-btn:hover {
    border-color: var(--accent-m);
  }

  .page-indicator {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text-muted);
  }

  /* ── Soul rating summary (on card) ─────────── */
  .soul-rating-summary {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    margin-top: var(--space-xs);
  }

  .rating-count {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
  }

  /* ── Reviews panel ─────────────────────────── */
  .reviews-panel {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .reviews-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .reviews-summary-bar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .reviews-avg {
    font-family: var(--font-mono);
    font-size: 16px;
    color: var(--karma);
    font-weight: 600;
  }

  .reviews-count {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
  }

  /* ── Review form ───────────────────────────── */
  .review-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    border-top: 1px solid var(--border);
    padding-top: var(--space-lg);
  }

  .review-form-rating {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .review-form-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
  }

  .review-textarea {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 13px;
    padding: var(--space-sm) var(--space-md);
    resize: vertical;
    outline: none;
    transition: border-color 0.15s;
  }

  .review-textarea:focus {
    border-color: var(--accent-m);
  }

  .review-error {
    font-family: var(--font-body);
    font-size: 12px;
    color: #e74c3c;
    margin: 0;
  }

  .review-submit-btn {
    align-self: flex-start;
    background: var(--accent);
    color: white;
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    padding: var(--space-sm) var(--space-lg);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }

  .review-submit-btn:hover:not(:disabled) {
    background: var(--accent-m);
  }

  .review-submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Reviews list ──────────────────────────── */
  .reviews-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .reviews-loading,
  .reviews-empty {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }

  .review-item {
    border-top: 1px solid var(--border);
    padding-top: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .review-item-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .review-author {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--text);
    font-weight: 500;
  }

  .review-date {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
  }

  .review-delete-btn {
    background: none;
    border: none;
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.08em;
    color: #e74c3c;
    cursor: pointer;
    padding: 2px 4px;
    margin-left: auto;
    transition: opacity 0.15s;
  }

  .review-delete-btn:hover {
    opacity: 0.7;
  }

  .review-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.6;
  }
</style>
