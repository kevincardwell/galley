CREATE TABLE `backups` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`bytes` integer NOT NULL,
	`kind` text DEFAULT 'manual' NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `collab_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`section_id` text NOT NULL,
	`update` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collab_updates_section` ON `collab_updates` (`section_id`,`id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`href` text,
	`read_at` integer,
	`emailed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user` ON `notifications` (`user_id`,`read_at`);--> statement-breakpoint
ALTER TABLE `comments` ADD `guest_name` text;--> statement-breakpoint
ALTER TABLE `sections` ADD `ydoc` blob;--> statement-breakpoint
ALTER TABLE `sections` ADD `client_approved_at` integer;--> statement-breakpoint
ALTER TABLE `sections` ADD `client_approved_by` text;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `share_review` integer DEFAULT false NOT NULL;