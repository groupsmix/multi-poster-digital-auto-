-- NEXUS — Initial D1 schema
-- Matches Section 12 of NEXUS_Final_Architecture.md
-- This migration creates the base tables. Business logic columns
-- will be added in later tasks.

-- ── Domains ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS domains (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  icon       TEXT,
  description TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Categories ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  domain_id   TEXT NOT NULL REFERENCES domains(id),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  config_json TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(domain_id, slug)
);

-- ── Platforms ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platforms (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  type             TEXT,
  title_limit      INTEGER,
  description_rules TEXT,
  tag_rules        TEXT,
  seo_rules        TEXT,
  audience_profile TEXT,
  tone_profile     TEXT,
  cta_style        TEXT,
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Social Channels ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_channels (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  caption_rules   TEXT,
  hashtag_rules   TEXT,
  length_rules    TEXT,
  audience_style  TEXT,
  tone_profile    TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Products ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY,
  domain_id        TEXT NOT NULL REFERENCES domains(id),
  category_id      TEXT REFERENCES categories(id),
  idea             TEXT NOT NULL,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'draft',
  current_version  INTEGER NOT NULL DEFAULT 1,
  approved_version INTEGER,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Product Variants ────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id                TEXT PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES products(id),
  version           INTEGER NOT NULL DEFAULT 1,
  platform_id       TEXT REFERENCES platforms(id),
  social_channel_id TEXT REFERENCES social_channels(id),
  title             TEXT,
  description       TEXT,
  price_suggestion  TEXT,
  seo_json          TEXT,
  content_json      TEXT,
  asset_refs_json   TEXT,
  status            TEXT NOT NULL DEFAULT 'draft',
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Workflow Runs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_runs (
  id                   TEXT PRIMARY KEY,
  product_id           TEXT NOT NULL REFERENCES products(id),
  template_id          TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  started_at           TEXT,
  finished_at          TEXT,
  provider_summary_json TEXT,
  cost_summary_json    TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Workflow Steps ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_steps (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES workflow_runs(id),
  step_name     TEXT NOT NULL,
  role_type     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  provider_used TEXT,
  model_used    TEXT,
  retries       INTEGER NOT NULL DEFAULT 0,
  error_log     TEXT,
  output_ref    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Reviews ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES products(id),
  version         INTEGER NOT NULL,
  reviewer_type   TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  issues_found    TEXT,
  feedback        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Revisions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revisions (
  id                TEXT PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES products(id),
  version_from      INTEGER NOT NULL,
  version_to        INTEGER NOT NULL,
  revision_reason   TEXT,
  boss_notes        TEXT,
  changed_steps_json TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Prompt Templates ────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_templates (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  role_type       TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  scope_type      TEXT,
  scope_ref       TEXT,
  system_prompt   TEXT,
  domain_prompt   TEXT,
  platform_prompt TEXT,
  quality_rules   TEXT,
  output_schema   TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Assets ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id),
  type          TEXT NOT NULL,
  storage_key   TEXT NOT NULL,
  provider      TEXT,
  metadata_json TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Publishing Jobs ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS publishing_jobs (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id),
  target_type TEXT NOT NULL,
  target_ref  TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  payload_ref TEXT,
  result_ref  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Provider Configs ────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_configs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  provider    TEXT NOT NULL,
  model       TEXT,
  task_lane   TEXT NOT NULL,
  tier        INTEGER NOT NULL DEFAULT 0,
  priority    INTEGER NOT NULL DEFAULT 0,
  state       TEXT NOT NULL DEFAULT 'sleeping',
  has_api_key INTEGER NOT NULL DEFAULT 0,
  config_json TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Workflow Templates ──────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  steps_json  TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Analytics Daily ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_daily (
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,
  domain_id     TEXT REFERENCES domains(id),
  category_id   TEXT REFERENCES categories(id),
  runs_total    INTEGER NOT NULL DEFAULT 0,
  runs_approved INTEGER NOT NULL DEFAULT 0,
  runs_failed   INTEGER NOT NULL DEFAULT 0,
  cost_total    REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Cost Events ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_events (
  id           TEXT PRIMARY KEY,
  provider     TEXT NOT NULL,
  model        TEXT NOT NULL,
  request_type TEXT NOT NULL,
  usage_amount REAL NOT NULL DEFAULT 0,
  run_id       TEXT REFERENCES workflow_runs(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
