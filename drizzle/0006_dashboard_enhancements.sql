ALTER TABLE `staff` ADD COLUMN `theme_mode` text DEFAULT 'system' NOT NULL;
--> statement-breakpoint
CREATE TABLE `login_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `store_id` integer,
  `user_id` integer,
  `username` text DEFAULT '' NOT NULL,
  `kind` text DEFAULT 'owner' NOT NULL,
  `success` integer DEFAULT 0 NOT NULL,
  `ip` text DEFAULT '' NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_events_store_idx` ON `login_events` (`store_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `login_events_user_idx` ON `login_events` (`user_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `notification_prefs` (
  `user_id` integer NOT NULL,
  `category` text NOT NULL,
  `muted` integer DEFAULT 0 NOT NULL,
  PRIMARY KEY (`user_id`, `category`)
);
