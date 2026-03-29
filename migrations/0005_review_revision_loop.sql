-- NEXUS — Review & Revision Loop
-- Adds review_comments table and enhances reviews/revisions tables
-- to support the full Boss approval loop with comments, notes,
-- per-variant approval, and selective regeneration targeting.

-- ── Review Comments ───────────────────────────────────────
-- Stores threaded comments on a review (Boss notes, AI notes, etc.)
CREATE TABLE IF NOT EXISTS review_comments (
  id          TEXT PRIMARY KEY,
  review_id   TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL DEFAULT 'boss',
  comment     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_review_comments_review ON review_comments(review_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_created ON review_comments(created_at);

-- ── Reviews enhancements ──────────────────────────────────
-- updated_at: track when a review was last modified (approve/reject/revision)
ALTER TABLE reviews ADD COLUMN updated_at TEXT;

-- variant_ids_json: allow per-variant approval (approve only some variants)
ALTER TABLE reviews ADD COLUMN variant_ids_json TEXT;

-- ── Revisions enhancements ────────────────────────────────
-- regenerate_targets_json: stores which specific parts to regenerate
-- e.g. ["title", "price", "etsy_variant", "instagram_caption"]
-- The actual regeneration engine is a future task; this just stores the targets.
ALTER TABLE revisions ADD COLUMN regenerate_targets_json TEXT;

-- review_id: link revision back to the review that triggered it
ALTER TABLE revisions ADD COLUMN review_id TEXT REFERENCES reviews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_revisions_review ON revisions(review_id);
CREATE INDEX IF NOT EXISTS idx_revisions_product_version ON revisions(product_id, version_to);
