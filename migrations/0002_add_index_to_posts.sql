-- Migration number: 0002 	 2026-03-13T14:54:01.932Z

CREATE INDEX IF NOT EXISTS idx_posts_createdAt ON posts (createdAt DESC);