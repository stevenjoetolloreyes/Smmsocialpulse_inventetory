CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`category` text DEFAULT 'General' NOT NULL,
	`unit` text DEFAULT 'pcs' NOT NULL,
	`cost_price` real DEFAULT 0 NOT NULL,
	`selling_price` real DEFAULT 0 NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`reorder_level` integer DEFAULT 5 NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`supplier_id` integer,
	`barcode` text DEFAULT '' NOT NULL,
	`product_status` text DEFAULT 'active' NOT NULL,
	`area` text DEFAULT '' NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `items_code_unique` ON `items` (`code`);
--> statement-breakpoint
CREATE TABLE `movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`item_name` text NOT NULL,
	`item_code` text NOT NULL,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`batch_id` integer,
	`reference` text DEFAULT '' NOT NULL,
	`actor` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`name` text NOT NULL,
	`conversion_factor` real DEFAULT 1 NOT NULL,
	`selling_price` real DEFAULT 0 NOT NULL,
	`barcode` text DEFAULT '' NOT NULL,
	`is_base` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`batch_no` text NOT NULL,
	`qty_received` integer DEFAULT 0 NOT NULL,
	`qty_remaining` integer DEFAULT 0 NOT NULL,
	`cost_price` real DEFAULT 0 NOT NULL,
	`expiry_date` text,
	`received_date` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`supplier_id` integer,
	`invoice_no` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`area` text DEFAULT '' NOT NULL,
	`placed` integer DEFAULT 0 NOT NULL,
	`defective_qty` integer DEFAULT 0 NOT NULL,
	`box_status` text DEFAULT 'Full' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`contact_person` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `receivings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`batch_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`supplier_id` integer,
	`invoice_no` text DEFAULT '' NOT NULL,
	`qty` integer DEFAULT 0 NOT NULL,
	`total_cost` real DEFAULT 0 NOT NULL,
	`received_as` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Released' NOT NULL,
	`pending_qty` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`or_number` text NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`discount_rate` real DEFAULT 0 NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`payment_method` text DEFAULT 'Cash' NOT NULL,
	`customer_type` text DEFAULT 'Regular' NOT NULL,
	`cashier` text DEFAULT '' NOT NULL,
	`amount_tendered` real DEFAULT 0 NOT NULL,
	`change_due` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Completed' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_or_number_unique` ON `sales` (`or_number`);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`product_name` text NOT NULL,
	`sku` text NOT NULL,
	`unit_name` text NOT NULL,
	`conversion_factor` real DEFAULT 1 NOT NULL,
	`qty_units` integer DEFAULT 0 NOT NULL,
	`qty_base` integer DEFAULT 0 NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`line_total` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sale_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_item_id` integer NOT NULL,
	`batch_id` integer NOT NULL,
	`qty` integer DEFAULT 0 NOT NULL,
	`returned_qty` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`sale_item_id` integer NOT NULL,
	`batch_id` integer NOT NULL,
	`qty` integer DEFAULT 0 NOT NULL,
	`actor` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`entity_type` text DEFAULT '' NOT NULL,
	`entity_id` integer,
	`description` text DEFAULT '' NOT NULL,
	`actor` text DEFAULT '' NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);
--> statement-breakpoint
CREATE TABLE `areas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `areas_name_unique` ON `areas` (`name`);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`store_name` text DEFAULT 'My Store' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`logo_text` text DEFAULT 'MS' NOT NULL,
	`primary_color` text DEFAULT '#14532d' NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`date_format` text DEFAULT 'mdy' NOT NULL,
	`security_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`password_hash` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'Cashier' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`last_login` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
