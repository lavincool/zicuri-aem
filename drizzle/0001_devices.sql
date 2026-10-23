CREATE TABLE `device_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`level` text NOT NULL,
	`level_cm` real,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `device_alerts_device_idx` ON `device_alerts` (`device_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`site_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`lat` real,
	`lng` real,
	`h3_r8` text,
	`h3_r9` text,
	`mount_height_cm` real,
	`warning_cm` real NOT NULL,
	`critical_cm` real NOT NULL,
	`reporting_interval_s` integer DEFAULT 300 NOT NULL,
	`api_key_hash` text NOT NULL,
	`api_key_prefix` text NOT NULL,
	`claim_code_hash` text,
	`last_seen_at` integer,
	`last_measured_at` integer,
	`last_level_cm` real,
	`last_battery_pct` integer,
	`last_rssi_dbm` integer,
	`firmware` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_api_key_hash_unique` ON `devices` (`api_key_hash`);--> statement-breakpoint
CREATE INDEX `devices_lat_lng_idx` ON `devices` (`lat`,`lng`);--> statement-breakpoint
CREATE INDEX `devices_h3_r8_idx` ON `devices` (`h3_r8`);--> statement-breakpoint
CREATE TABLE `sensor_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`device_reading_id` text,
	`measured_at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`level_cm` real NOT NULL,
	`distance_cm` real,
	`battery_pct` integer,
	`battery_mv` integer,
	`rssi_dbm` integer,
	`firmware` text,
	`transport` text NOT NULL,
	`raw` text NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sensor_readings_device_time_idx` ON `sensor_readings` (`device_id`,`measured_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `sensor_readings_device_rid_idx` ON `sensor_readings` (`device_id`,`device_reading_id`);