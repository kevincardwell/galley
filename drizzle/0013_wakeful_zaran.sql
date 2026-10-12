CREATE TABLE `sites` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`repo_url` text NOT NULL,
	`base_branch` text DEFAULT 'main' NOT NULL,
	`work_branch` text DEFAULT 'galley' NOT NULL,
	`root` text DEFAULT '' NOT NULL,
	`token` text,
	`preview_token` text NOT NULL,
	`pr_number` integer,
	`pr_head_sha` text,
	`fetched_at` integer,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sites_preview_token_unique` ON `sites` (`preview_token`);--> statement-breakpoint
ALTER TABLE `users` ADD `git_email` text;