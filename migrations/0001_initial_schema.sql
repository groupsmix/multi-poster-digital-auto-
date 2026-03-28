-- NEXUS — Initial D1 schema
-- Matches Section 12 of NEXUS_Final_Architecture.md
-- 18 core entities with proper FKs, indexes, timestamps, status/version fields.

-- ── Domains ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS domains (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  icon        TEXT,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_domains_slug ON domains(slug);
CREATE INDEX IF NOT EXISTS idx_domains_active ON domains(is_active);

-- ── Categories ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  domain_id   TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  config_json TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(domain_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_categories_domain ON categories(domain_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);

-- ── Platforms ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platforms (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  type              TEXT,
  title_limit       INTEGER,
  description_rules TEXT,
  tag_rules         TEXT,
  seo_rules         TEXT,
  audience_profile  TEXT,
  tone_profile      TEXT,
  cta_style         TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_platforms_active ON platforms(is_active);

-- ── Social Channels ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_channels (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  caption_rules   TEXT,
  hashtag_rules   TEXT,
  length_rules    TEXT,
  audience_style  TEXT,
  tone_profile    TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_social_channels_active ON social_channels(is_active);

-- ── AI Roles ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_roles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  config_json TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_roles_slug ON ai_roles(slug);
CREATE INDEX IF NOT EXISTS idx_ai_roles_active ON ai_roles(is_active);

-- ── Provider Configs ────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_configs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  provider    TEXT NOT NULL,
  model       TEXT,
  task_lane   TEXT NOT NULL,
  ai_role_id  TEXT REFERENCES ai_roles(id) ON DELETE SET NULL,
  tier        INTEGER NOT NULL DEFAULT 0,
  priority    INTEGER NOT NULL DEFAULT 0,
  state       TEXT NOT NULL DEFAULT 'sleeping',
  has_api_key INTEGER NOT NULL DEFAULT 0,
  config_json TEXT,
  notes       TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_provider_configs_task_lane ON provider_configs(task_lane);
CREATE INDEX IF NOT EXISTS idx_provider_configs_state ON provider_configs(state);
CREATE INDEX IF NOT EXISTS idx_provider_configs_active ON provider_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_provider_configs_tier_priority ON provider_configs(tier, priority);

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
  social_prompt   TEXT,
  category_prompt TEXT,
  quality_rules   TEXT,
  output_schema   TEXT,
  revision_prompt TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_role ON prompt_templates(role_type);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON prompt_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_scope ON prompt_templates(scope_type, scope_ref);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_version ON prompt_templates(name, version);

-- ── Workflow Templates ──────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  steps_json  TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_active ON workflow_templates(is_active);

-- ── Products ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY,
  domain_id        TEXT NOT NULL REFERENCES domains(id) ON DELETE RESTRICT,
  category_id      TEXT REFERENCES categories(id) ON DELETE SET NULL,
  idea             TEXT NOT NULL,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'draft',
  current_version  INTEGER NOT NULL DEFAULT 1,
  approved_version INTEGER,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_domain ON products(domain_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at);

-- ── Product Variants ────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id                TEXT PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL DEFAULT 1,
  platform_id       TEXT REFERENCES platforms(id) ON DELETE SET NULL,
  social_channel_id TEXT REFERENCES social_channels(id) ON DELETE SET NULL,
  variant_type      TEXT NOT NULL DEFAULT 'base',
  title             TEXT,
  description       TEXT,
  price_suggestion  TEXT,
  seo_json          TEXT,
  content_json      TEXT,
  asset_refs_json   TEXT,
  status            TEXT NOT NULL DEFAULT 'draft',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_platform ON product_variants(platform_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_social ON product_variants(social_channel_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_status ON product_variants(status);
CREATE INDEX IF NOT EXISTS idx_product_variants_version ON product_variants(product_id, version);

-- ── Workflow Runs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_runs (
  id                    TEXT PRIMARY KEY,
  product_id            TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  template_id           TEXT REFERENCES workflow_templates(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  started_at            TEXT,
  finished_at           TEXT,
  provider_summary_json TEXT,
  cost_summary_json     TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_product ON workflow_runs(product_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_created ON workflow_runs(created_at);

-- ── Workflow Steps ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_steps (
  id             TEXT PRIMARY KEY,
  run_id         TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_name      TEXT NOT NULL,
  role_type      TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  provider_used  TEXT,
  model_used     TEXT,
  prompt_version INTEGER,
  retries        INTEGER NOT NULL DEFAULT 0,
  error_log      TEXT,
  output_ref     TEXT,
  started_at     TEXT,
  finished_at    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_run ON workflow_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON workflow_steps(status);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_role ON workflow_steps(role_type);

-- ── Reviews ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  reviewer_type   TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  issues_found    TEXT,
  feedback        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(approval_status);
CREATE INDEX IF NOT EXISTS idx_reviews_product_version ON reviews(product_id, version);

-- ── Revisions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revisions (
  id                 TEXT PRIMARY KEY,
  product_id         TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version_from       INTEGER NOT NULL,
  version_to         INTEGER NOT NULL,
  revision_reason    TEXT,
  boss_notes         TEXT,
  changed_steps_json TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_revisions_product ON revisions(product_id);

-- ── Assets ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id            TEXT PRIMARY KEY,
  product_id    TEXT REFERENCES products(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,
  storage_key   TEXT NOT NULL,
  provider      TEXT,
  metadata_json TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assets_product ON assets(product_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_storage_key ON assets(storage_key);

-- ── Publishing Jobs ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS publishing_jobs (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_ref  TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  payload_ref TEXT,
  result_ref  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_publishing_jobs_product ON publishing_jobs(product_id);
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_status ON publishing_jobs(status);

-- ── Analytics Daily ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_daily (
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,
  domain_id     TEXT REFERENCES domains(id) ON DELETE SET NULL,
  category_id   TEXT REFERENCES categories(id) ON DELETE SET NULL,
  runs_total    INTEGER NOT NULL DEFAULT 0,
  runs_approved INTEGER NOT NULL DEFAULT 0,
  runs_failed   INTEGER NOT NULL DEFAULT 0,
  cost_total    REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, domain_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(date);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_domain ON analytics_daily(domain_id);

-- ── Cost Events ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_events (
  id           TEXT PRIMARY KEY,
  provider     TEXT NOT NULL,
  model        TEXT NOT NULL,
  request_type TEXT NOT NULL,
  usage_amount REAL NOT NULL DEFAULT 0,
  run_id       TEXT REFERENCES workflow_runs(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cost_events_run ON cost_events(run_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_provider ON cost_events(provider);
CREATE INDEX IF NOT EXISTS idx_cost_events_created ON cost_events(created_at);
