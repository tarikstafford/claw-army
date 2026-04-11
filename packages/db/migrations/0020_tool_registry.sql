-- Migration: 0020_tool_registry
-- Creates the tool_registry table for OpenAPI/Swagger imported tool endpoints.
-- Each row represents a single operation from an imported spec.

CREATE TABLE IF NOT EXISTS "tool_registry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "spec_id" uuid NOT NULL,
  "spec_title" text NOT NULL,
  "spec_version" text,
  "spec_url" text,
  "base_url" text NOT NULL,
  "operation_id" text,
  "method" text NOT NULL,
  "path" text NOT NULL,
  "summary" text,
  "description" text,
  "parameters" jsonb,
  "request_body" jsonb,
  "response_schema" jsonb,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tool_registry_user_id_idx" ON "tool_registry" ("user_id");
CREATE INDEX IF NOT EXISTS "tool_registry_spec_id_idx" ON "tool_registry" ("spec_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tool_registry_spec_method_path_uniq" ON "tool_registry" ("spec_id", "method", "path");
