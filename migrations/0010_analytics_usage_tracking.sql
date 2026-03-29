-- NEXUS — Analytics and usage tracking tables.
-- Extends the existing analytics infrastructure with detailed event tracking
-- for provider usage, retries, failovers, step timing, and approval/rejection counts.

-- ── Analytics Events ──────────────────────────────────────
-- Granular event log for every trackable action in the system.
-- Each event captures what happened, which provider was involved,
-- timing data, and cost information.
CREATE TABLE IF NOT EXISTS analytics_events (
  id            TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  run_id        TEXT REFERENCES workflow_runs(id) ON DELETE SET NULL,
  step_id       TEXT REFERENCES workflow_steps(id) ON DELETE SET NULL,
  product_id    TEXT REFERENCES products(id) ON DELETE SET NULL,
  provider_id   TEXT,
  provider_name TEXT,
  model         TEXT,
  task_lane     TEXT,
  outcome       TEXT NOT NULL,
  duration_ms   INTEGER,
  token_usage   TEXT,
  cost_estimate REAL,
  metadata_json TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_run ON analytics_events(run_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_product ON analytics_events(product_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_provider ON analytics_events(provider_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_outcome ON analytics_events(outcome);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_lane ON analytics_events(task_lane);

-- ── Provider Usage Summary ────────────────────────────────
-- Aggregated provider usage stats per day for dashboard display.
-- Updated incrementally as events are recorded.
CREATE TABLE IF NOT EXISTS provider_usage_summary (
  id              TEXT PRIMARY KEY,
  date            TEXT NOT NULL,
  provider_name   TEXT NOT NULL,
  model           TEXT,
  task_lane       TEXT NOT NULL,
  total_calls     INTEGER NOT NULL DEFAULT 0,
  successful      INTEGER NOT NULL DEFAULT 0,
  failed          INTEGER NOT NULL DEFAULT 0,
  rate_limited    INTEGER NOT NULL DEFAULT 0,
  skipped         INTEGER NOT NULL DEFAULT 0,
  total_retries   INTEGER NOT NULL DEFAULT 0,
  failovers       INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms  REAL NOT NULL DEFAULT 0,
  total_tokens    INTEGER NOT NULL DEFAULT 0,
  total_cost      REAL NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, provider_name, model, task_lane)
);

CREATE INDEX IF NOT EXISTS idx_pus_date ON provider_usage_summary(date);
CREATE INDEX IF NOT EXISTS idx_pus_provider ON provider_usage_summary(provider_name);
CREATE INDEX IF NOT EXISTS idx_pus_lane ON provider_usage_summary(task_lane);

-- ── Step Timing Summary ───────────────────────────────────
-- Tracks average and total time per workflow step type.
-- Useful for identifying bottlenecks in the pipeline.
CREATE TABLE IF NOT EXISTS step_timing_summary (
  id             TEXT PRIMARY KEY,
  date           TEXT NOT NULL,
  step_name      TEXT NOT NULL,
  role_type      TEXT NOT NULL,
  total_runs     INTEGER NOT NULL DEFAULT 0,
  avg_duration_ms REAL NOT NULL DEFAULT 0,
  min_duration_ms INTEGER,
  max_duration_ms INTEGER,
  total_duration_ms INTEGER NOT NULL DEFAULT 0,
  total_retries  INTEGER NOT NULL DEFAULT 0,
  success_count  INTEGER NOT NULL DEFAULT 0,
  failure_count  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, step_name, role_type)
);

CREATE INDEX IF NOT EXISTS idx_sts_date ON step_timing_summary(date);
CREATE INDEX IF NOT EXISTS idx_sts_step ON step_timing_summary(step_name);
CREATE INDEX IF NOT EXISTS idx_sts_role ON step_timing_summary(role_type);

-- ── Routing Audit Log ─────────────────────────────────────
-- Detailed record of the full routing path for each provider call.
-- Captures the entire chain walk so free-first routing can be audited.
CREATE TABLE IF NOT EXISTS routing_audit_log (
  id              TEXT PRIMARY KEY,
  run_id          TEXT REFERENCES workflow_runs(id) ON DELETE SET NULL,
  step_id         TEXT REFERENCES workflow_steps(id) ON DELETE SET NULL,
  product_id      TEXT REFERENCES products(id) ON DELETE SET NULL,
  task_lane       TEXT NOT NULL,
  chain_json      TEXT NOT NULL,
  selected_provider TEXT,
  selected_model  TEXT,
  selected_tier   INTEGER,
  total_attempts  INTEGER NOT NULL DEFAULT 0,
  skipped_free    INTEGER NOT NULL DEFAULT 0,
  skipped_paid    INTEGER NOT NULL DEFAULT 0,
  failover_count  INTEGER NOT NULL DEFAULT 0,
  final_outcome   TEXT NOT NULL,
  total_latency_ms INTEGER,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ral_run ON routing_audit_log(run_id);
CREATE INDEX IF NOT EXISTS idx_ral_product ON routing_audit_log(product_id);
CREATE INDEX IF NOT EXISTS idx_ral_lane ON routing_audit_log(task_lane);
CREATE INDEX IF NOT EXISTS idx_ral_outcome ON routing_audit_log(final_outcome);
CREATE INDEX IF NOT EXISTS idx_ral_created ON routing_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_ral_provider ON routing_audit_log(selected_provider);

-- ── Approval Stats ────────────────────────────────────────
-- Daily aggregated approval/rejection counts by reviewer type.
CREATE TABLE IF NOT EXISTS approval_stats (
  id              TEXT PRIMARY KEY,
  date            TEXT NOT NULL,
  reviewer_type   TEXT NOT NULL,
  domain_id       TEXT REFERENCES domains(id) ON DELETE SET NULL,
  total_reviews   INTEGER NOT NULL DEFAULT 0,
  approved        INTEGER NOT NULL DEFAULT 0,
  rejected        INTEGER NOT NULL DEFAULT 0,
  revision_requested INTEGER NOT NULL DEFAULT 0,
  pending         INTEGER NOT NULL DEFAULT 0,
  avg_review_time_ms REAL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date, reviewer_type, domain_id)
);

CREATE INDEX IF NOT EXISTS idx_as_date ON approval_stats(date);
CREATE INDEX IF NOT EXISTS idx_as_reviewer ON approval_stats(reviewer_type);
CREATE INDEX IF NOT EXISTS idx_as_domain ON approval_stats(domain_id);
