-- Migration number: 0001 	 2026-03-13T14:53:24.615Z

CREATE TABLE IF NOT EXISTS posts (
  id        TEXT NOT NULL PRIMARY KEY,
  title     TEXT NOT NULL,
  content   TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);