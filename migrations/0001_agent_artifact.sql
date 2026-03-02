CREATE TABLE `agent_artifact` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL REFERENCES `agent_session`(`id`) ON DELETE cascade,
  `source_node_id` text NOT NULL REFERENCES `agent_node`(`id`) ON DELETE cascade,
  `target_node_id` text NOT NULL REFERENCES `agent_node`(`id`) ON DELETE cascade,
  `source_path` text NOT NULL,
  `target_path` text NOT NULL,
  `bucket_key` text NOT NULL,
  `status` text NOT NULL,
  `error_message` text,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

CREATE INDEX `agent_artifact_session_id_idx` ON `agent_artifact` (`session_id`);
CREATE INDEX `agent_artifact_source_node_id_idx` ON `agent_artifact` (`source_node_id`);
CREATE INDEX `agent_artifact_target_node_id_idx` ON `agent_artifact` (`target_node_id`);
CREATE INDEX `agent_artifact_status_idx` ON `agent_artifact` (`status`);
