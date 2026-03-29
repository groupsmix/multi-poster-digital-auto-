-- NEXUS — Product workflow extensions
-- Adds workflow configuration columns to the products table
-- for tracking target platforms, social channels, and workflow template.

ALTER TABLE products ADD COLUMN workflow_template_id TEXT REFERENCES workflow_templates(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN target_platforms_json TEXT;
ALTER TABLE products ADD COLUMN social_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN target_social_json TEXT;

CREATE INDEX IF NOT EXISTS idx_products_workflow_template ON products(workflow_template_id);
