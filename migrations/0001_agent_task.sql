CREATE TABLE `agent_task` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
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
CREATE INDEX `agent_task_agent_id_idx` ON `agent_task` (`agent_id`);
--> statement-breakpoint
CREATE INDEX `agent_task_finished_at_idx` ON `agent_task` (`finished_at`);
