CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limit_buckets` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `report_flags` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`browser_hash` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_flags_once_idx` ON `report_flags` (`report_id`,`browser_hash`);--> statement-breakpoint
CREATE TABLE `report_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`browser_hash` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_signals_once_idx` ON `report_signals` (`report_id`,`browser_hash`);--> statement-breakpoint
CREATE TABLE `report_status_events` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`reason` text NOT NULL,
	`actor` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `report_status_events_report_idx` ON `report_status_events` (`report_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`severity` integer,
	`severity_detail` text,
	`water_depth_cm` integer,
	`note` text,
	`status` text DEFAULT 'open' NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`accuracy_m` real,
	`location_source` text NOT NULL,
	`h3_r8` text NOT NULL,
	`h3_r9` text NOT NULL,
	`address` text,
	`colonia` text,
	`photo_full_key` text NOT NULL,
	`photo_thumb_key` text NOT NULL,
	`photo_width` integer NOT NULL,
	`photo_height` integer NOT NULL,
	`photo_color` text,
	`still_there_count` integer DEFAULT 0 NOT NULL,
	`fixed_count` integer DEFAULT 0 NOT NULL,
	`flag_count` integer DEFAULT 0 NOT NULL,
	`last_confirmed_at` integer,
	`status_changed_at` integer NOT NULL,
	`expires_at` integer,
	`resolved_at` integer,
	`reporter_hash` text NOT NULL,
	`user_id` text,
	`client_request_id` text NOT NULL,
	`ai_suggestion_id` text,
	`source` text DEFAULT 'web' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reports_client_request_id_unique` ON `reports` (`client_request_id`);--> statement-breakpoint
CREATE INDEX `reports_lat_lng_idx` ON `reports` (`lat`,`lng`);--> statement-breakpoint
CREATE INDEX `reports_status_created_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `reports_h3_r8_idx` ON `reports` (`h3_r8`);--> statement-breakpoint
CREATE INDEX `reports_h3_r9_idx` ON `reports` (`h3_r9`);--> statement-breakpoint
CREATE INDEX `reports_expires_idx` ON `reports` (`expires_at`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`full_key` text NOT NULL,
	`thumb_key` text NOT NULL,
	`content_type` text NOT NULL,
	`declared_bytes` integer NOT NULL,
	`browser_hash` text NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uploads_full_key_unique` ON `uploads` (`full_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `uploads_thumb_key_unique` ON `uploads` (`thumb_key`);