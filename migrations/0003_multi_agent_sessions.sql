-- Multi-agent session management

CREATE TABLE IF NOT EXISTS "multi_agent_session" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "git_repo_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "orchestrator_slot_id" TEXT,
  "created_at" INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  "updated_at" INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

CREATE INDEX "multi_agent_session_user_id_idx" ON "multi_agent_session" ("user_id");
CREATE INDEX "multi_agent_session_status_idx" ON "multi_agent_session" ("status");

CREATE TABLE IF NOT EXISTS "agent_slot" (
  "id" TEXT PRIMARY KEY,
  "session_id" TEXT NOT NULL REFERENCES "multi_agent_session"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL CHECK ("role" IN ('orchestrator', 'worker')),
  "agent_type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "config" TEXT NOT NULL DEFAULT '{}',
  "container_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  "updated_at" INTEGER DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

CREATE INDEX "agent_slot_session_id_idx" ON "agent_slot" ("session_id");
CREATE INDEX "agent_slot_status_idx" ON "agent_slot" ("status");
