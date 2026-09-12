CREATE TABLE `schedule_items` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`all_day` integer DEFAULT false NOT NULL,
	`location` text,
	`supplier_id` text,
	`owner_id` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `schedule_items_ws` ON `schedule_items` (`workspace_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `supplier_tags` (
	`supplier_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`supplier_id`, `tag`),
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`contact_name` text,
	`email` text,
	`phone` text,
	`website` text,
	`address` text,
	`notes` text,
	`rating` integer,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `suppliers_name` ON `suppliers` (`name`);--> statement-breakpoint
CREATE TABLE `workspace_suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`status` text DEFAULT 'shortlisted' NOT NULL,
	`cost` integer,
	`note` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `workspace_suppliers_ws` ON `workspace_suppliers` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_suppliers_supplier` ON `workspace_suppliers` (`supplier_id`);