ALTER TABLE bots ADD COLUMN IF NOT EXISTS paperclip_agent_id UUID;
CREATE INDEX IF NOT EXISTS bots_paperclip_agent_id_idx ON bots (paperclip_agent_id);
