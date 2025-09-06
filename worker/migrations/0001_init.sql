-- Migration number: 0001 	 2025-09-06T11:32:19.972Z

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,
  ua TEXT
);

CREATE INDEX IF NOT EXISTS idx_comments_slug_created ON comments (slug, created_at DESC);
