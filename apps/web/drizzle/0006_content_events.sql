CREATE TABLE `content_events_daily` (
	`day` text NOT NULL,
	`content_id` text NOT NULL,
	`kind` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `content_id`, `kind`),
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE cascade
);
