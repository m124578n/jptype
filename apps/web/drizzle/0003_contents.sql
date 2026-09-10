CREATE TABLE `content_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text NOT NULL,
	`order` integer NOT NULL,
	`start_time` real,
	`end_time` real,
	`original_text` text NOT NULL,
	`kana_text` text NOT NULL,
	`romaji_text` text DEFAULT '' NOT NULL,
	`metadata` text,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_lines_order` ON `content_lines` (`content_id`,`order`);--> statement-breakpoint
CREATE TABLE `contents` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`video_id` text,
	`jlpt_level` text DEFAULT 'unknown' NOT NULL,
	`difficulty` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source_type` text DEFAULT 'original' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`source_name` text DEFAULT '' NOT NULL,
	`license` text DEFAULT '' NOT NULL,
	`rights_status` text DEFAULT 'unknown' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `contents_list` ON `contents` (`status`,`type`,"updated_at" DESC);--> statement-breakpoint
CREATE INDEX `contents_jlpt` ON `contents` (`status`,`jlpt_level`);