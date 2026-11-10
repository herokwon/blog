CREATE TABLE `__new_post_tags` (
	`post_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`post_id`, `name`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "post_tags_name" CHECK(length("__new_post_tags"."name") BETWEEN 1 AND 40 AND "__new_post_tags"."name" = trim("__new_post_tags"."name", char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279)) AND instr("__new_post_tags"."name", char(0)) = 0),
	CONSTRAINT "post_tags_position" CHECK("__new_post_tags"."position" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_post_tags`("post_id", "name", "position")
SELECT p.post_id, t.name, row_number() OVER (PARTITION BY p.post_id ORDER BY t.name) - 1
FROM post_tags p INNER JOIN tags t ON t.id = p.tag_id;--> statement-breakpoint
DROP TABLE `post_tags`;--> statement-breakpoint
ALTER TABLE `__new_post_tags` RENAME TO `post_tags`;--> statement-breakpoint
DROP TABLE `tags`;
