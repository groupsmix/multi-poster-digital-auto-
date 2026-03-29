-- NEXUS — AI Router state layer
-- Adds cooldown tracking and error state columns to provider_configs.

ALTER TABLE provider_configs ADD COLUMN cooldown_until TEXT;
ALTER TABLE provider_configs ADD COLUMN last_error TEXT;
ALTER TABLE provider_configs ADD COLUMN last_used_at TEXT;

CREATE INDEX IF NOT EXISTS idx_provider_configs_cooldown ON provider_configs(cooldown_until);
