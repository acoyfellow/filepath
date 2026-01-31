ALTER TABLE `apikey` ADD `credit_balance` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `apikey` ADD `budget_cap` integer;--> statement-breakpoint
ALTER TABLE `apikey` ADD `total_usage_minutes` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `apikey` ADD `last_billed_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `user` ADD `credit_balance` integer DEFAULT 0;