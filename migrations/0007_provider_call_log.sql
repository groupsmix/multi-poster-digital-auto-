-- NEXUS — Provider call log for recording provider used per execution.
-- Records each provider attempt so workflow runs have full observability.

CREATE TABLE IF NOT EXISTS provider_call_log (
  id              TEXT PRIMARY KEY,
  run_id          TEXT REFERENCES workflow_runs(id) ON DELETE SET NULL,
  step_id         TEXT REFERENCES workflow_steps(id) ON DELETE SET NULL,
  task_lane       TEXT NOT NULL,
  provider_id     TEXT,
  provider_name   TEXT NOT NULL,
  model           TEXT,
  outcome         TEXT NOT NULL,
  error           TEXT,
  latency_ms      INTEGER,
  attempt_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_provider_call_log_run ON provider_call_log(run_id);
CREATE INDEX IF NOT EXISTS idx_provider_call_log_step ON provider_call_log(step_id);
CREATE INDEX IF NOT EXISTS idx_provider_call_log_provider ON provider_call_log(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_call_log_outcome ON provider_call_log(outcome);
CREATE INDEX IF NOT EXISTS idx_provider_call_log_created ON provider_call_log(created_at);
