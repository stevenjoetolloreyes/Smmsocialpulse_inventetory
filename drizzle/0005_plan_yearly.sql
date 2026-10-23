ALTER TABLE `plans` ADD COLUMN `price_yearly` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `plans` SET `price_yearly` = 0 WHERE `id` = 'free';
--> statement-breakpoint
UPDATE `plans` SET `price_yearly` = 4990 WHERE `id` = 'pro';
--> statement-breakpoint
UPDATE `plans` SET `price_yearly` = 19990 WHERE `id` = 'business';
