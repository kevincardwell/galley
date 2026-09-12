ALTER TABLE `workspaces` ADD `calendar_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_calendar_token_unique` ON `workspaces` (`calendar_token`);