CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`banned` integer DEFAULT false,
	`role` text,
	`openrouter_api_key` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);
--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);
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
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);
--> statement-breakpoint
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
CREATE INDEX `passkey_user_id_idx` ON `passkey` (`user_id`);
--> statement-breakpoint
CREATE INDEX `passkey_credential_id_unique` ON `passkey` (`credential_id`);
--> statement-breakpoint
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
CREATE INDEX `apikey_config_id_idx` ON `apikey` (`config_id`);
--> statement-breakpoint
CREATE INDEX `apikey_reference_id_idx` ON `apikey` (`reference_id`);
--> statement-breakpoint
CREATE INDEX `apikey_key_idx` ON `apikey` (`key`);
--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`git_repo_url` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`started_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workspace_user_id_idx` ON `workspace` (`user_id`);
--> statement-breakpoint
CREATE INDEX `workspace_status_idx` ON `workspace` (`status`);
--> statement-breakpoint
CREATE TABLE `harness` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`adapter` text NOT NULL,
	`entry_command` text NOT NULL,
	`default_model` text NOT NULL,
	`icon` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `harness_enabled_idx` ON `harness` (`enabled`);
--> statement-breakpoint
CREATE TABLE `agent` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`harness_id` text NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`allowed_paths` text DEFAULT '[]' NOT NULL,
	`forbidden_paths` text DEFAULT '[]' NOT NULL,
	`tool_permissions` text DEFAULT '[]' NOT NULL,
	`writable_root` text,
	`container_id` text,
	`active_process_id` text,
	`cancel_requested` integer DEFAULT false NOT NULL,
	`tokens` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`harness_id`) REFERENCES `harness`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_workspace_id_idx` ON `agent` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `agent_status_idx` ON `agent` (`status`);
--> statement-breakpoint
CREATE TABLE `agent_message` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_message_agent_id_idx` ON `agent_message` (`agent_id`);
--> statement-breakpoint
CREATE TABLE `agent_result` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`commands` text NOT NULL,
	`files_touched` text NOT NULL,
	`violations` text NOT NULL,
	`diff_summary` text,
	`commit_json` text,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT OR IGNORE INTO `harness` (`id`, `name`, `description`, `adapter`, `entry_command`, `default_model`, `icon`, `enabled`, `config`) VALUES
	('shelley', 'Shelley', 'Full-stack engineering agent. filepath-native reference implementation.', 'shelley', 'node /opt/filepath/adapters/shelley/index.mjs', 'anthropic/claude-sonnet-4', 'shell', 1, '{}'),
	('pi', 'Pi', 'Research and analysis agent.', 'pi', 'node /opt/filepath/adapters/pi/index.mjs', 'anthropic/claude-sonnet-4', 'search', 1, '{}'),
	('claude-code', 'Claude Code', 'Anthropic''s coding harness.', 'claude-code', 'node /opt/filepath/adapters/claude-code/index.mjs', 'anthropic/claude-sonnet-4', 'bot', 1, '{}'),
	('codex', 'Codex', 'OpenAI''s coding harness.', 'codex', 'node /opt/filepath/adapters/codex/index.mjs', 'openai/gpt-5', 'scroll', 1, '{}'),
	('cursor', 'Cursor', 'Cursor agent mode via CLI.', 'cursor', 'node /opt/filepath/adapters/cursor/index.mjs', 'anthropic/claude-sonnet-4', 'mouse-pointer', 1, '{}'),
	('amp', 'Amp', 'Sourcegraph''s large-codebase harness.', 'amp', 'node /opt/filepath/adapters/amp/index.mjs', 'anthropic/claude-sonnet-4', 'zap', 1, '{}'),
	('custom', 'Custom', 'Bring your own harness.', 'custom', '', 'anthropic/claude-sonnet-4', 'box', 1, '{}');
