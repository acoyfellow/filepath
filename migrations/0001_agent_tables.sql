-- Additive migration: agent_session + agent_node tables
-- Run against production D1:
--   wrangler d1 execute filepath-db --file=migrations/0001_agent_tables.sql --remote

CREATE TABLE IF NOT EXISTS `agent_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`git_repo_url` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`root_node_id` text,
	`started_at` integer,
	`last_billed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `agent_session_user_id_idx` ON `agent_session` (`user_id`);
CREATE INDEX IF NOT EXISTS `agent_session_status_idx` ON `agent_session` (`status`);

CREATE TABLE IF NOT EXISTS `agent_node` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`agent_type` text NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`container_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`tokens` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `agent_session`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `agent_node_session_id_idx` ON `agent_node` (`session_id`);
CREATE INDEX IF NOT EXISTS `agent_node_parent_id_idx` ON `agent_node` (`parent_id`);
CREATE INDEX IF NOT EXISTS `agent_node_status_idx` ON `agent_node` (`status`);
