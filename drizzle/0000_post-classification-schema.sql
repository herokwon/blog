CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	CONSTRAINT "categories_name" CHECK(length("categories"."name") BETWEEN 1 AND 20 AND "categories"."name" = trim("categories"."name", char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279)) AND instr("categories"."name", char(0)) = 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `post_tags` (
	`post_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`post_id`, `tag_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `post_tags_tag` ON `post_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`slug` text,
	`category_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`published_at` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`deleted_at` text,
	`revision` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "posts_status" CHECK("posts"."status" IN ('draft', 'published', 'archived')),
	CONSTRAINT "posts_title_length" CHECK(length("posts"."title") <= 200 AND instr("posts"."title", char(0)) = 0),
	CONSTRAINT "posts_body_size" CHECK(length(cast("posts"."body" AS blob)) <= 1048576 AND instr("posts"."body", char(0)) = 0),
	CONSTRAINT "posts_slug_format" CHECK("posts"."slug" IS NULL OR (length("posts"."slug") BETWEEN 1 AND 120 AND "posts"."slug" NOT GLOB '*[^a-z0-9-]*' AND "posts"."slug" NOT LIKE '-%' AND "posts"."slug" NOT LIKE '%-' AND instr("posts"."slug", '--') = 0 AND instr("posts"."slug", char(0)) = 0)),
	CONSTRAINT "posts_publication" CHECK(("posts"."status" = 'draft' AND "posts"."published_at" IS NULL) OR ("posts"."status" IN ('published', 'archived') AND "posts"."published_at" IS NOT NULL AND "posts"."slug" IS NOT NULL AND "posts"."category_id" IS NOT NULL AND length(trim("posts"."title", char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) > 0 AND length(trim("posts"."body", char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) > 0)),
	CONSTRAINT "posts_trash" CHECK("posts"."deleted_at" IS NULL OR "posts"."status" <> 'published')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE INDEX `posts_category` ON `posts` (`category_id`);--> statement-breakpoint
CREATE INDEX `posts_admin_list` ON `posts` (`deleted_at`,`status`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `posts_public_list` ON `posts` (`published_at`,`id`) WHERE "posts"."status" = 'published' AND "posts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	CONSTRAINT "tags_name" CHECK(length("tags"."name") BETWEEN 1 AND 40 AND "tags"."name" = trim("tags"."name", char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279)) AND instr("tags"."name", char(0)) = 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);