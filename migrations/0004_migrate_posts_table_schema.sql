-- Migration number: 0004 	 2026-03-19T18:50:05.252Z
-- Migrate posts table to use snake_case column naming and DATETIME type

-- Step 1: Create new table with correct schema
CREATE TABLE posts_new (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Step 2: Copy existing data from old table
INSERT INTO posts_new (id, title, content, created_at, updated_at)
SELECT id, title, content, createdAt, updatedAt FROM posts;

-- Step 3: Drop old table
DROP TABLE posts;

-- Step 4: Rename new table to original name
ALTER TABLE posts_new RENAME TO posts;