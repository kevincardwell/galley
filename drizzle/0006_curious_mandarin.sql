ALTER TABLE `assets` ADD `guest_name` text;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `share_uploads` integer DEFAULT false NOT NULL;