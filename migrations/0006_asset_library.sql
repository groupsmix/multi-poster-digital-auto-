-- NEXUS — Asset Library enhancements
-- Adds columns to the existing assets table to support the full asset library:
--   filename, file_size, mime_type, is_active (soft delete), updated_at

ALTER TABLE assets ADD COLUMN filename TEXT;
ALTER TABLE assets ADD COLUMN file_size INTEGER;
ALTER TABLE assets ADD COLUMN mime_type TEXT;
ALTER TABLE assets ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE assets ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));

CREATE INDEX IF NOT EXISTS idx_assets_active ON assets(is_active);
CREATE INDEX IF NOT EXISTS idx_assets_mime ON assets(mime_type);
