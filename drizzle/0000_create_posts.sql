CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`slug` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`published_at` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`deleted_at` text,
	`revision` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "posts_title_nonempty" CHECK("posts"."title" <> ''),
	CONSTRAINT "posts_body_nonempty" CHECK("posts"."body" <> ''),
	CONSTRAINT "posts_status_valid" CHECK("posts"."status" IN ('draft', 'published', 'archived')),
	CONSTRAINT "posts_revision_valid" CHECK(typeof("posts"."revision") = 'integer' AND "posts"."revision" > 0),
	CONSTRAINT "posts_publication_history_valid" CHECK(("posts"."status" = 'draft' AND "posts"."slug" IS NULL AND "posts"."published_at" IS NULL)
        OR ("posts"."status" IN ('published', 'archived') AND "posts"."slug" IS NOT NULL AND "posts"."published_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE INDEX `posts_admin_updated_idx` ON `posts` ("updated_at" desc,"id" desc) WHERE "posts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `posts_admin_status_updated_idx` ON `posts` (`status`,"updated_at" desc,"id" desc) WHERE "posts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX `posts_trash_updated_idx` ON `posts` ("updated_at" desc,"id" desc) WHERE "posts"."deleted_at" IS NOT NULL;