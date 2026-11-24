CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`category_id` integer NOT NULL,
	`status` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`updated_at` integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
	`published_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "posts_status" CHECK("posts"."status" IN ('draft', 'published', 'archived')),
	CONSTRAINT "posts_publication_time" CHECK(("posts"."status" = 'draft') = ("posts"."published_at" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `posts_category_id` ON `posts` (`category_id`);--> statement-breakpoint
CREATE INDEX `posts_list_order` ON `posts` (`deleted_at`,`updated_at`,`id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`post_id` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`post_id`, `name`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
