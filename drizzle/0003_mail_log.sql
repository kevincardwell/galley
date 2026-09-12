CREATE TABLE `mail_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`to` text NOT NULL,
	`subject` text NOT NULL,
	`provider` text NOT NULL,
	`ok` integer NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mail_log_created` ON `mail_log` (`created_at`);--> statement-breakpoint
ALTER TABLE `invites` ADD `emailed_at` integer;