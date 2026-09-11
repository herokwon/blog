CREATE TABLE `content` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`slug` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`published_at` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`deleted_at` text,
	CONSTRAINT "content_id_uuidv7_check" CHECK(
        length("content"."id") = 36
        AND "content"."id" NOT GLOB '*[^0-9A-Fa-f-]*'
        AND substr("content"."id", 9, 1) = '-'
        AND substr("content"."id", 14, 1) = '-'
        AND substr("content"."id", 19, 1) = '-'
        AND substr("content"."id", 24, 1) = '-'
        AND substr("content"."id", 15, 1) = '7'
        AND substr("content"."id", 20, 1) GLOB '[89ABab]'
      ),
	CONSTRAINT "content_status_check" CHECK("content"."status" IN ('draft', 'published', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_slug_unique` ON `content` (`slug`);--> statement-breakpoint
CREATE INDEX `content_admin_order_idx` ON `content` (`deleted_at`,`updated_at`,`id`);