PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`workspace_id` text,
	`workspace_role` text,
	`invited_by` text NOT NULL,
	`expires_at` integer,
	`accepted_at` integer,
	`revoked_at` integer,
	`emailed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_invites`("id", "token", "email", "name", "is_admin", "workspace_id", "workspace_role", "invited_by", "expires_at", "accepted_at", "revoked_at", "emailed_at", "created_at") SELECT "id", "token", "email", "name", "is_admin", "workspace_id", "workspace_role", "invited_by", "expires_at", "accepted_at", "revoked_at", "emailed_at", "created_at" FROM `invites`;--> statement-breakpoint
DROP TABLE `invites`;--> statement-breakpoint
ALTER TABLE `__new_invites` RENAME TO `invites`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_unique` ON `invites` (`token`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `pending_totp` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_secret` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_last_step` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_recovery` text;