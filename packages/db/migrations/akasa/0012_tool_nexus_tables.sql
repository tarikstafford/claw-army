CREATE TABLE IF NOT EXISTS tool_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  connection_type TEXT NOT NULL DEFAULT 'api_key',
  status TEXT NOT NULL DEFAULT 'connected',
  display_label TEXT,
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  token_iv TEXT,
  token_tag TEXT,
  refresh_iv TEXT,
  refresh_tag TEXT,
  encrypted_api_key TEXT,
  api_key_iv TEXT,
  api_key_tag TEXT,
  key_version INTEGER NOT NULL DEFAULT 1,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT,
  rate_limit_reset_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, tool_id)
);

CREATE TABLE IF NOT EXISTS tool_invocation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id TEXT NOT NULL,
  action TEXT NOT NULL,
  agent_id TEXT,
  user_id TEXT NOT NULL,
  connection_id UUID NOT NULL,
  latency_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  request_summary TEXT,
  response_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_connections_user ON tool_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_invocation_logs_connection ON tool_invocation_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_tool_invocation_logs_user ON tool_invocation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_invocation_logs_created ON tool_invocation_logs(created_at DESC);
