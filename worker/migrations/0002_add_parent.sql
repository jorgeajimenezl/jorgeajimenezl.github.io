-- Migration number: 0002	2025-09-07

ALTER TABLE comments ADD COLUMN parent_id INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_comments_slug_parent_created 
  ON comments (slug, parent_id, created_at DESC);

