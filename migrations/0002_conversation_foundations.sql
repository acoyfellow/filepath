ALTER TABLE `workspace` ADD COLUMN `memory_enabled` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `workspace` ADD COLUMN `memory_scope` text;
--> statement-breakpoint
ALTER TABLE `agent` ADD COLUMN `closed_at` integer;
--> statement-breakpoint
ALTER TABLE `agent_task` ADD COLUMN `trace_id` text;
--> statement-breakpoint
ALTER TABLE `agent_task` ADD COLUMN `proof_run_id` text;
--> statement-breakpoint
ALTER TABLE `agent_task` ADD COLUMN `proof_iteration_id` text;
--> statement-breakpoint
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
  `created_at` integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  `updated_at` integer NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  `resolved_at` integer,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_interruption_agent_id_idx` ON `agent_interruption` (`agent_id`);
--> statement-breakpoint
CREATE INDEX `agent_interruption_workspace_id_idx` ON `agent_interruption` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `agent_interruption_status_idx` ON `agent_interruption` (`status`);
