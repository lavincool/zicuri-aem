CREATE TABLE `ai_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`category` text,
	`description` text,
	`confidence` real,
	`is_relevant` integer,
	`privacy_concerns` text,
	`latency_ms` integer,
	`accepted` integer,
	`raw` text,
	`created_at` integer NOT NULL
);
