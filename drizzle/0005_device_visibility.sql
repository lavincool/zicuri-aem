ALTER TABLE `devices` ADD `visibility` text DEFAULT 'public' NOT NULL;--> statement-breakpoint
CREATE INDEX `devices_org_idx` ON `devices` (`org_id`);