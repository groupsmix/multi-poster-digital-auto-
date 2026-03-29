-- NEXUS — Workflow step extensions
-- Adds step_order for explicit ordering and target_ref for
-- platform/social channel references on per-step basis.

ALTER TABLE workflow_steps ADD COLUMN step_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workflow_steps ADD COLUMN target_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_workflow_steps_order ON workflow_steps(run_id, step_order);
