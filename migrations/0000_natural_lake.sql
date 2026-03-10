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
CREATE TABLE `agent_harness` (
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
CREATE INDEX `agent_harness_enabled_idx` ON `agent_harness` (`enabled`);--> statement-breakpoint
CREATE TABLE `agent_node` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`harness_id` text NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`container_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`tokens` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `agent_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`harness_id`) REFERENCES `agent_harness`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agent_node_session_id_idx` ON `agent_node` (`session_id`);--> statement-breakpoint
CREATE INDEX `agent_node_parent_id_idx` ON `agent_node` (`parent_id`);--> statement-breakpoint
CREATE INDEX `agent_node_status_idx` ON `agent_node` (`status`);--> statement-breakpoint
CREATE TABLE `agent_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`git_repo_url` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`root_node_id` text,
	`api_key` text,
	`started_at` integer,
	`last_billed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_session_user_id_idx` ON `agent_session` (`user_id`);--> statement-breakpoint
CREATE INDEX `agent_session_status_idx` ON `agent_session` (`status`);--> statement-breakpoint
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
	`openrouter_api_key` text,
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
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);
--> statement-breakpoint
INSERT OR IGNORE INTO `agent_harness` (`id`, `name`, `description`, `adapter`, `entry_command`, `default_model`, `icon`, `enabled`, `config`) VALUES
	('shelley', 'Shelley', 'Full-stack engineering agent. filepath-native reference implementation.', 'shelley', 'node /opt/filepath/adapters/shelley/index.mjs', 'anthropic/claude-sonnet-4', 'shell', 1, '{}'),
	('pi', 'Pi', 'Research and analysis. Deep dives into docs, APIs, codebases.', 'pi', 'node /opt/filepath/adapters/pi/index.mjs', 'anthropic/claude-sonnet-4', 'search', 1, '{}'),
	('claude-code', 'Claude Code', 'Anthropic''s agentic coding tool. Complex multi-file changes.', 'claude-code', 'node /opt/filepath/adapters/claude-code/index.mjs', 'anthropic/claude-sonnet-4', 'bot', 1, '{}'),
	('codex', 'Codex', 'OpenAI''s coding agent. Strong at Python, scripting, data.', 'codex', 'node /opt/filepath/adapters/codex/index.mjs', 'openai/gpt-5', 'scroll', 1, '{}'),
	('cursor', 'Cursor', 'Cursor''s agent mode via CLI. IDE-grade code intelligence.', 'cursor', 'node /opt/filepath/adapters/cursor/index.mjs', 'anthropic/claude-sonnet-4', 'mouse-pointer', 1, '{}'),
	('amp', 'Amp', 'Sourcegraph''s agent. Large codebase navigation, cross-repo changes.', 'amp', 'node /opt/filepath/adapters/amp/index.mjs', 'anthropic/claude-sonnet-4', 'zap', 1, '{}'),
	('custom', 'Custom', 'Bring your own agent. Register a harness that speaks the filepath protocol.', 'custom', '', 'anthropic/claude-sonnet-4', 'box', 1, '{}');
