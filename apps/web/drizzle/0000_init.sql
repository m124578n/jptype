CREATE TABLE `kana_stats` (
	`user_id` text NOT NULL,
	`kana` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`errors` integer DEFAULT 0 NOT NULL,
	`last_seen_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `kana`)
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`mode` text NOT NULL,
	`kpm` integer NOT NULL,
	`accuracy` real NOT NULL,
	`score` integer NOT NULL,
	`correct_keys` integer NOT NULL,
	`wrong_keys` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`week` text NOT NULL,
	`flagged` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runs_lb` ON `runs` (`mode`,`week`,"score" DESC);--> statement-breakpoint
CREATE INDEX `runs_user` ON `runs` (`user_id`,"created_at" DESC);