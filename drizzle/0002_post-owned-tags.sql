CREATE TABLE `post_owned_tags` (
	`post_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`post_id`, `name`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "post_owned_tags_name" CHECK(length("post_owned_tags"."name") BETWEEN 1 AND 40 AND "post_owned_tags"."name" = trim("post_owned_tags"."name", char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279)) AND instr("post_owned_tags"."name", char(0)) = 0),
	CONSTRAINT "post_owned_tags_position" CHECK("post_owned_tags"."position" >= 0)
);
--> statement-breakpoint
INSERT INTO post_owned_tags(post_id, name, position)
SELECT p.post_id, t.name, row_number() OVER (PARTITION BY p.post_id ORDER BY t.name) - 1
FROM post_tags p INNER JOIN tags t ON t.id = p.tag_id;
--> statement-breakpoint
-- The previous Worker may still write until the new version is activated.
CREATE TRIGGER legacy_post_tag_insert AFTER INSERT ON post_tags BEGIN
  INSERT INTO post_owned_tags(post_id, name, position)
  SELECT NEW.post_id, t.name,
    coalesce((SELECT max(position) + 1 FROM post_owned_tags WHERE post_id = NEW.post_id), 0)
  FROM tags t WHERE t.id = NEW.tag_id
  ON CONFLICT(post_id, name) DO NOTHING;
END;
--> statement-breakpoint
CREATE TRIGGER legacy_post_tag_delete AFTER DELETE ON post_tags BEGIN
  DELETE FROM post_owned_tags WHERE post_id = OLD.post_id
    AND name = (SELECT name FROM tags WHERE id = OLD.tag_id);
END;
