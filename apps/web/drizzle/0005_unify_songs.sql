-- M4-1c: the `songs` table folds into `contents` + `content_lines` (sourceType 'user_provided').
-- Hand-written (drizzle-kit generate prompts for the takedown_requests column rename); the
-- snapshot in meta/ was produced by scripts/gen-migration.mjs from the schema.
ALTER TABLE `contents` ADD `owner_id` text REFERENCES user(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `contents` ADD `public_consent_at` integer;--> statement-breakpoint
ALTER TABLE `contents` ADD `removed_reason` text;--> statement-breakpoint
CREATE INDEX `contents_owner` ON `contents` (`owner_id`,`updated_at` DESC);--> statement-breakpoint
INSERT INTO `contents` (`id`, `type`, `title`, `description`, `video_id`, `jlpt_level`, `difficulty`, `status`, `source_type`, `source_url`, `source_name`, `license`, `rights_status`, `created_by`, `owner_id`, `public_consent_at`, `removed_reason`, `created_at`, `updated_at`)
SELECT `id`, 'song', `title`, '', `video_id`, 'unknown', 'normal',
	CASE WHEN `status` = 'removed' THEN 'removed' WHEN `visibility` = 'public' THEN 'published' ELSE 'draft' END,
	'user_provided', '', '', '', 'unknown', `owner_id`, `owner_id`, `public_consent_at`, `removed_reason`, `created_at`, `updated_at`
FROM `songs`;--> statement-breakpoint
INSERT INTO `content_lines` (`id`, `content_id`, `order`, `start_time`, `end_time`, `original_text`, `kana_text`, `romaji_text`, `metadata`)
SELECT s.`id` || '-' || printf('%04d', j.`key`), s.`id`, j.`key`,
	json_extract(j.`value`, '$.start'), NULL,
	json_extract(j.`value`, '$.text'), json_extract(j.`value`, '$.text'), '', NULL
FROM `songs` s, json_each(s.`lines`) j
WHERE json_type(j.`value`, '$.text') = 'text';--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_takedown_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text,
	`video_id` text DEFAULT '' NOT NULL,
	`reporter_contact` text NOT NULL,
	`claim` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`admin_note` text,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_takedown_requests`(`id`, `content_id`, `video_id`, `reporter_contact`, `claim`, `status`, `admin_note`, `created_at`, `resolved_at`)
SELECT `id`, `song_id`, `video_id`, `reporter_contact`, `claim`, `status`, `admin_note`, `created_at`, `resolved_at` FROM `takedown_requests`;--> statement-breakpoint
DROP TABLE `takedown_requests`;--> statement-breakpoint
ALTER TABLE `__new_takedown_requests` RENAME TO `takedown_requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP TABLE `songs`;
