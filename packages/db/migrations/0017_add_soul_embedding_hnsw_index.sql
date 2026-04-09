CREATE INDEX IF NOT EXISTS "bot_souls_embedding_hnsw_idx" ON "bot_souls" USING hnsw ("embedding" vector_cosine_ops);
