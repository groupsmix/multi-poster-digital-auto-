-- Migration 0011: Risk/Policy Layer
-- Architecture §28 — policy rules and policy check results.

CREATE TABLE IF NOT EXISTS policy_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,           -- e.g. 'trademark', 'copyright', 'platform_policy', 'misleading_claims', 'unsafe_content'
  severity TEXT NOT NULL DEFAULT 'warn', -- 'block', 'warn', 'info'
  pattern TEXT NOT NULL,             -- regex or substring pattern to match
  description TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS policy_checks (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  violations_json TEXT,              -- JSON array of violations, warnings, info
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_policy_checks_product ON policy_checks(product_id);
CREATE INDEX IF NOT EXISTS idx_policy_rules_active ON policy_rules(is_active);

-- Seed some default policy rules (config-driven, can be managed from dashboard)
INSERT INTO policy_rules (id, name, rule_type, severity, pattern, description, is_active, created_at, updated_at) VALUES
  ('pr_default_01', 'No guaranteed income claims', 'misleading_claims', 'block', 'guaranteed income|guaranteed profit|guaranteed earnings|make money fast', 'Avoid misleading income claims that could violate FTC guidelines.', 1, datetime('now'), datetime('now')),
  ('pr_default_02', 'No trademark symbols without permission', 'trademark', 'warn', '™|®', 'Trademark symbols should only be used with proper authorization.', 1, datetime('now'), datetime('now')),
  ('pr_default_03', 'No health cure claims', 'misleading_claims', 'block', 'cure for|cures all|miracle cure|guaranteed cure', 'Health cure claims are regulated and potentially dangerous.', 1, datetime('now'), datetime('now')),
  ('pr_default_04', 'Platform policy: no adult content keywords', 'platform_policy', 'block', 'xxx|nsfw|adult only|explicit content', 'Most platforms prohibit adult content.', 1, datetime('now'), datetime('now')),
  ('pr_default_05', 'Copyright notice reminder', 'copyright', 'info', 'all rights reserved|copyrighted material', 'Ensure proper copyright attribution when referencing copyrighted material.', 1, datetime('now'), datetime('now'));
