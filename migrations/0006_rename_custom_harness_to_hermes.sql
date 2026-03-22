--> statement-breakpoint
-- One harness id per product: Hermes is `hermes`, not `custom`.
INSERT INTO `harness` (`id`, `name`, `description`, `adapter`, `entry_command`, `default_model`, `icon`, `enabled`, `config`, `created_at`, `updated_at`)
SELECT 'hermes', `name`, `description`, 'hermes', 'node /opt/filepath/adapters/hermes/index.mjs', `default_model`, `icon`, `enabled`, `config`, `created_at`, `updated_at`
FROM `harness` WHERE `id` = 'custom' AND NOT EXISTS (SELECT 1 FROM `harness` WHERE `id` = 'hermes');
--> statement-breakpoint
UPDATE `agent` SET `harness_id` = 'hermes' WHERE `harness_id` = 'custom';
--> statement-breakpoint
DELETE FROM `harness` WHERE `id` = 'custom';
