CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "attachments_type" CHECK("attachments"."content_type" IN ('image/jpeg', 'image/png', 'image/gif', 'image/webp')),
	CONSTRAINT "attachments_size" CHECK("attachments"."size" BETWEEN 1 AND 10485760)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attachments_object_key_unique` ON `attachments` (`object_key`);--> statement-breakpoint
CREATE TABLE `post_attachments` (
	`post_id` text NOT NULL,
	`attachment_id` text NOT NULL,
	PRIMARY KEY(`post_id`, `attachment_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `post_attachments_attachment` ON `post_attachments` (`attachment_id`);