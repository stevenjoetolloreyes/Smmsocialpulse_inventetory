CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store_id` integer NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`dedupe_key` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_store_idx` ON `notifications` (`store_id`);
--> statement-breakpoint
CREATE TABLE `notification_reads` (
	`notification_id` integer NOT NULL,
	`staff_id` integer NOT NULL,
	`read_at` integer NOT NULL,
	PRIMARY KEY (`notification_id`, `staff_id`)
);
