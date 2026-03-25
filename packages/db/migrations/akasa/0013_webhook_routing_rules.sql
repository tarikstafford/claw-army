CREATE TABLE IF NOT EXISTS webhook_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  connection_id UUID NOT NULL,
  tool_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  condition TEXT,
  assign_to_agent_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS webhook_routing_rules_user_id_idx ON webhook_routing_rules (user_id);
CREATE INDEX IF NOT EXISTS webhook_routing_rules_connection_id_idx ON webhook_routing_rules (connection_id);
