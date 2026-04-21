-- "fly free" migration: this is the first migration in the filesystem after
-- the big refactor that nuked migrations/. Prod + local D1s may have tables
-- from the old 0000-0006 migrations still around. Drop them first so this
-- CREATE TABLE wave lands cleanly on any existing DB. All data is discarded.
--
-- Safe to re-run on empty DBs (IF EXISTS is a no-op there).
DROP TABLE IF EXISTS `agent_interruption`;
--> statement-breakpoint
DROP TABLE IF EXISTS `agent_message`;
--> statement-breakpoint
DROP TABLE IF EXISTS `agent_result`;
--> statement-breakpoint
DROP TABLE IF EXISTS `agent_task`;
--> statement-breakpoint
DROP TABLE IF EXISTS `agent`;
--> statement-breakpoint
DROP TABLE IF EXISTS `ai_connection`;
--> statement-breakpoint
DROP TABLE IF EXISTS `apikey`;
--> statement-breakpoint
DROP TABLE IF EXISTS `harness`;
--> statement-breakpoint
DROP TABLE IF EXISTS `passkey`;
--> statement-breakpoint
DROP TABLE IF EXISTS `session`;
--> statement-breakpoint
DROP TABLE IF EXISTS `verification`;
--> statement-breakpoint
DROP TABLE IF EXISTS `workspace`;
--> statement-breakpoint
DROP TABLE IF EXISTS `account`;
--> statement-breakpoint
DROP TABLE IF EXISTS `user`;
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `agent` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`harness_id` text NOT NULL,
	`ai_connection_id` text NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`allowed_paths` text DEFAULT '[]' NOT NULL,
	`forbidden_paths` text DEFAULT '[]' NOT NULL,
	`tool_permissions` text DEFAULT '[]' NOT NULL,
	`writable_root` text,
	`container_id` text,
	`active_process_id` text,
	`cancel_requested` integer DEFAULT false NOT NULL,
	`closed_at` integer,
	`tokens` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`harness_id`) REFERENCES `harness`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ai_connection_id`) REFERENCES `ai_connection`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_workspace_id_idx` ON `agent` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `agent_status_idx` ON `agent` (`status`);--> statement-breakpoint
CREATE TABLE `agent_interruption` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`run_id` text,
	`trace_id` text,
	`proof_run_id` text,
	`proof_iteration_id` text,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`requested_permission` text,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_interruption_agent_id_idx` ON `agent_interruption` (`agent_id`);--> statement-breakpoint
CREATE INDEX `agent_interruption_workspace_id_idx` ON `agent_interruption` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `agent_interruption_status_idx` ON `agent_interruption` (`status`);--> statement-breakpoint
CREATE TABLE `agent_message` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_message_agent_id_idx` ON `agent_message` (`agent_id`);--> statement-breakpoint
CREATE TABLE `agent_result` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`commands` text NOT NULL,
	`files_touched` text NOT NULL,
	`violations` text NOT NULL,
	`diff_summary` text,
	`patch` text,
	`commit_json` text,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_task` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`result_status` text,
	`summary` text DEFAULT '' NOT NULL,
	`commands` text DEFAULT '[]' NOT NULL,
	`files_touched` text DEFAULT '[]' NOT NULL,
	`violations` text DEFAULT '[]' NOT NULL,
	`diff_summary` text,
	`patch` text,
	`commit_json` text,
	`trace_id` text,
	`proof_run_id` text,
	`proof_iteration_id` text,
	`attempt` integer DEFAULT 0 NOT NULL,
	`request_id` text,
	`error_code` text,
	`error_detail` text,
	`accepted_at` integer,
	`started_at` integer NOT NULL,
	`heartbeat_at` integer,
	`finished_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_task_agent_id_idx` ON `agent_task` (`agent_id`);--> statement-breakpoint
CREATE INDEX `agent_task_finished_at_idx` ON `agent_task` (`finished_at`);--> statement-breakpoint
CREATE INDEX `agent_task_status_idx` ON `agent_task` (`status`);--> statement-breakpoint
CREATE TABLE `ai_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`provider` text NOT NULL,
	`endpoint` text NOT NULL,
	`model` text NOT NULL,
	`api_key_encrypted` text NOT NULL,
	`max_context_tokens` integer DEFAULT 128000 NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_connection_user_id_idx` ON `ai_connection` (`user_id`);--> statement-breakpoint
CREATE TABLE `apikey` (
	`id` text PRIMARY KEY NOT NULL,
	`config_id` text DEFAULT 'default' NOT NULL,
	`name` text,
	`start` text,
	`prefix` text,
	`key` text NOT NULL,
	`reference_id` text NOT NULL,
	`expires_at` integer,
	`enabled` integer DEFAULT true,
	`rate_limit_enabled` integer DEFAULT true,
	`rate_limit_time_window` integer,
	`rate_limit_max` integer,
	`request_count` integer DEFAULT 0,
	`remaining` integer,
	`refill_interval` integer,
	`refill_amount` integer,
	`last_refill_at` integer,
	`last_request` integer,
	`permissions` text,
	`total_usage_minutes` integer DEFAULT 0,
	`encrypted_secrets` text,
	`metadata` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`reference_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `apikey_config_id_idx` ON `apikey` (`config_id`);--> statement-breakpoint
CREATE INDEX `apikey_reference_id_idx` ON `apikey` (`reference_id`);--> statement-breakpoint
CREATE INDEX `apikey_key_idx` ON `apikey` (`key`);--> statement-breakpoint
CREATE TABLE `harness` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`adapter` text NOT NULL,
	`entry_command` text NOT NULL,
	`icon` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `harness_enabled_idx` ON `harness` (`enabled`);--> statement-breakpoint
CREATE TABLE `passkey` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`public_key` text NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`counter` integer NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`transports` text,
	`created_at` integer NOT NULL,
	`aaguid` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `passkey_credential_id_unique` ON `passkey` (`credential_id`);--> statement-breakpoint
CREATE INDEX `passkey_user_id_idx` ON `passkey` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`banned` integer DEFAULT false,
	`role` text,
	`default_ai_connection_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`initial_source_url` text,
	`memory_enabled` integer DEFAULT false NOT NULL,
	`memory_scope` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`started_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workspace_user_id_idx` ON `workspace` (`user_id`);--> statement-breakpoint
CREATE INDEX `workspace_status_idx` ON `workspace` (`status`);