-- NEXUS — Reviewer AI & Partial Regeneration
-- Adds regeneration_history table to track partial regeneration runs
-- and links them to reviews/revisions for full audit trail.

-- ── Regeneration History ─────────────────────────────────────
-- Tracks each partial regeneration: what was regenerated, why, and result.
CREATE TABLE IF NOT EXISTS regeneration_history (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  revision_id     TEXT REFERENCES revisions(id) ON DELETE SET NULL,
  review_id       TEXT REFERENCES reviews(id) ON DELETE SET NULL,
  version         INTEGER NOT NULL,
  target_type     TEXT NOT NULL,
  target_ref      TEXT,
  previous_json   TEXT,
  regenerated_json TEXT,
  provider_used   TEXT,
  model_used      TEXT,
  prompt_template_id TEXT,
  boss_notes      TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_regen_product ON regeneration_history(product_id);
CREATE INDEX IF NOT EXISTS idx_regen_revision ON regeneration_history(revision_id);
CREATE INDEX IF NOT EXISTS idx_regen_review ON regeneration_history(review_id);
CREATE INDEX IF NOT EXISTS idx_regen_target ON regeneration_history(target_type);
CREATE INDEX IF NOT EXISTS idx_regen_status ON regeneration_history(status);
