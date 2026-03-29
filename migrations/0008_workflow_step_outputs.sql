-- NEXUS — Workflow step outputs table.
-- Stores structured JSON output for each completed workflow step.
-- Referenced by workflow_steps.output_ref → workflow_step_outputs.id.

CREATE TABLE IF NOT EXISTS workflow_step_outputs (
  id          TEXT PRIMARY KEY,
  step_id     TEXT NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  run_id      TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  role_type   TEXT NOT NULL,
  output_json TEXT NOT NULL,
  provider_log_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wso_step ON workflow_step_outputs(step_id);
CREATE INDEX IF NOT EXISTS idx_wso_run ON workflow_step_outputs(run_id);
CREATE INDEX IF NOT EXISTS idx_wso_product ON workflow_step_outputs(product_id);
CREATE INDEX IF NOT EXISTS idx_wso_role ON workflow_step_outputs(role_type);
