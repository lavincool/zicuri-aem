CREATE TABLE `flood_history` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_url` text,
	`event_date` text NOT NULL,
	`colonia` text,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`h3_r8` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `flood_history_h3_r8_idx` ON `flood_history` (`h3_r8`);--> statement-breakpoint
CREATE TABLE `forecast_cells` (
	`snapshot_id` text NOT NULL,
	`h3_r7` text NOT NULL,
	`precip_24h_mm` real NOT NULL,
	`precip_48h_mm` real NOT NULL,
	`max_hourly_mm` real NOT NULL,
	`max_prob_pct` integer,
	`hourly` text NOT NULL,
	PRIMARY KEY(`snapshot_id`, `h3_r7`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `forecast_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `forecast_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`model` text,
	`fetched_at` integer NOT NULL,
	`valid_from` integer NOT NULL,
	`valid_to` integer NOT NULL,
	`summary` text NOT NULL,
	`raw` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `forecast_snapshots_provider_idx` ON `forecast_snapshots` (`provider`,`fetched_at`);--> statement-breakpoint
CREATE TABLE `h3_cells` (
	`h3_r8` text PRIMARY KEY NOT NULL,
	`centroid_lat` real NOT NULL,
	`centroid_lng` real NOT NULL,
	`elevation_m` real,
	`relative_elevation_m` real,
	`colonia` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `risk_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`h3_r8` text NOT NULL,
	`computed_at` integer NOT NULL,
	`model_version` text NOT NULL,
	`forecast_snapshot_id` text,
	`score` integer NOT NULL,
	`level` text NOT NULL,
	`baseline` integer NOT NULL,
	`factors` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `risk_scores_run_idx` ON `risk_scores` (`run_id`);--> statement-breakpoint
CREATE INDEX `risk_scores_cell_time_idx` ON `risk_scores` (`h3_r8`,`computed_at`);