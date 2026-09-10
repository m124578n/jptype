CREATE TABLE `notices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notices_user` ON `notices` (`user_id`,"created_at" DESC);--> statement-breakpoint
CREATE TABLE `song_timings` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`line_count` integer NOT NULL,
	`line_hashes` text NOT NULL,
	`starts` text NOT NULL,
	`created_by` text,
	`use_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `song_timings_video` ON `song_timings` (`video_id`);--> statement-breakpoint
CREATE TABLE `songs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`video_id` text NOT NULL,
	`title` text NOT NULL,
	`lines` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`public_consent_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`removed_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `songs_owner` ON `songs` (`owner_id`,"updated_at" DESC);--> statement-breakpoint
CREATE INDEX `songs_public` ON `songs` (`visibility`,`status`,"updated_at" DESC);--> statement-breakpoint
CREATE TABLE `takedown_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text,
	`video_id` text DEFAULT '' NOT NULL,
	`reporter_contact` text NOT NULL,
	`claim` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`admin_note` text,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `user_strikes` (
	`user_id` text PRIMARY KEY NOT NULL,
	`strikes` integer DEFAULT 0 NOT NULL,
	`suspended_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
