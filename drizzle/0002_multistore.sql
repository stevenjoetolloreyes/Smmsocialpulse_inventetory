-- Multi-store SaaS: tenancy core, plans, email tokens, feedback.
-- Converts the single-store schema into a multi-tenant one and backfills
-- all existing data into ONE legacy store (id 1, slug 'main') owned by the
-- seeded admin, who becomes the platform admin.

CREATE TABLE `stores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text DEFAULT 'My Store' NOT NULL,
	`slug` text NOT NULL,
	`owner_staff_id` integer,
	`plan_id` text DEFAULT 'free' NOT NULL,
	`plan_expires_at` integer,
	`setup_completed` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stores_slug_unique` ON `stores` (`slug`);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price_monthly` real DEFAULT 0 NOT NULL,
	`max_users` integer DEFAULT 2 NOT NULL,
	`product_image_upload` integer DEFAULT 0 NOT NULL,
	`report_export` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `plans` (`id`, `name`, `price_monthly`, `max_users`, `product_image_upload`, `report_export`) VALUES ('free', 'Free', 0, 2, 0, 0);
--> statement-breakpoint
INSERT INTO `plans` (`id`, `name`, `price_monthly`, `max_users`, `product_image_upload`, `report_export`) VALUES ('pro', 'Pro', 499, 10, 1, 1);
--> statement-breakpoint
INSERT INTO `plans` (`id`, `name`, `price_monthly`, `max_users`, `product_image_upload`, `report_export`) VALUES ('business', 'Business', 1999, 0, 1, 1);
--> statement-breakpoint
CREATE TABLE `email_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_id` integer NOT NULL,
	`type` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store_id` integer,
	`staff_id` integer,
	`type` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `items` ADD COLUMN `store_id` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `movements` ADD COLUMN `store_id` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `product_units` ADD COLUMN `store_id` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `batches` ADD COLUMN `store_id` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `suppliers` ADD COLUMN `store_id` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `receivings` ADD COLUMN `store_id` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `sales` ADD COLUMN `store_id` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `sale_items` ADD COLUMN `store_id` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `sale_allocations` ADD COLUMN `store_id` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `returns` ADD COLUMN `store_id` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `history` ADD COLUMN `store_id` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `categories` ADD COLUMN `store_id` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `areas` ADD COLUMN `store_id` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `staff` ADD COLUMN `store_id` integer;
--> statement-breakpoint
ALTER TABLE `staff` ADD COLUMN `email_verified` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `staff` ADD COLUMN `is_platform_admin` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `store_id` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `city` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `province` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `zip` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `settings` ADD COLUMN `logo_data` text DEFAULT '' NOT NULL;
--> statement-breakpoint
INSERT INTO `stores` (`name`, `slug`, `owner_staff_id`, `plan_id`, `plan_expires_at`, `setup_completed`, `status`, `created_at`)
SELECT COALESCE(NULLIF((SELECT `store_name` FROM `settings` ORDER BY `id` LIMIT 1), ''), 'My Store'), 'main', NULL, 'free', NULL, 1, 'active', CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE NOT EXISTS (SELECT 1 FROM `stores`);
--> statement-breakpoint
UPDATE `items` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `movements` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `product_units` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `batches` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `suppliers` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `receivings` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `sales` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `sale_items` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `sale_allocations` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `returns` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `history` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `categories` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `areas` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `settings` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `staff` SET `store_id` = 1;
--> statement-breakpoint
UPDATE `staff` SET `email_verified` = 1;
--> statement-breakpoint
UPDATE `stores` SET `owner_staff_id` = (SELECT `id` FROM `staff` WHERE `username` = 'admin' LIMIT 1) WHERE `id` = 1 AND `owner_staff_id` IS NULL;
--> statement-breakpoint
UPDATE `staff` SET `is_platform_admin` = 1, `store_id` = NULL WHERE `username` = 'admin';
--> statement-breakpoint
DROP INDEX IF EXISTS `items_code_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `items_store_code_unique` ON `items` (`store_id`, `code`);
--> statement-breakpoint
DROP INDEX IF EXISTS `sales_or_number_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_store_or_unique` ON `sales` (`store_id`, `or_number`);
--> statement-breakpoint
DROP INDEX IF EXISTS `categories_name_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_store_name_unique` ON `categories` (`store_id`, `name`);
--> statement-breakpoint
DROP INDEX IF EXISTS `areas_name_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `areas_store_name_unique` ON `areas` (`store_id`, `name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_store_unique` ON `settings` (`store_id`);
--> statement-breakpoint
CREATE INDEX `items_store_idx` ON `items` (`store_id`);
--> statement-breakpoint
CREATE INDEX `movements_store_idx` ON `movements` (`store_id`);
--> statement-breakpoint
CREATE INDEX `product_units_store_idx` ON `product_units` (`store_id`);
--> statement-breakpoint
CREATE INDEX `batches_store_idx` ON `batches` (`store_id`);
--> statement-breakpoint
CREATE INDEX `suppliers_store_idx` ON `suppliers` (`store_id`);
--> statement-breakpoint
CREATE INDEX `receivings_store_idx` ON `receivings` (`store_id`);
--> statement-breakpoint
CREATE INDEX `sales_store_idx` ON `sales` (`store_id`);
--> statement-breakpoint
CREATE INDEX `sale_items_store_idx` ON `sale_items` (`store_id`);
--> statement-breakpoint
CREATE INDEX `sale_allocations_store_idx` ON `sale_allocations` (`store_id`);
--> statement-breakpoint
CREATE INDEX `returns_store_idx` ON `returns` (`store_id`);
--> statement-breakpoint
CREATE INDEX `history_store_idx` ON `history` (`store_id`);
--> statement-breakpoint
CREATE INDEX `staff_store_idx` ON `staff` (`store_id`);
