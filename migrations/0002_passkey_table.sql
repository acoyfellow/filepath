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
CREATE UNIQUE INDEX `passkey_credential_id_unique` ON `passkey` (`credential_id`);
--> statement-breakpoint
CREATE INDEX `passkey_user_id_idx` ON `passkey` (`user_id`);
