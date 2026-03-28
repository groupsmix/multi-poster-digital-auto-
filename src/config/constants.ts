/**
 * Central configuration constants for NEXUS.
 *
 * All magic numbers and default values live here so they can be
 * overridden from the dashboard later without code changes.
 */

/** Application metadata */
export const APP = {
  NAME: "NEXUS",
  VERSION: "0.1.0",
  DESCRIPTION: "Dashboard-driven, AI-powered product operating system",
} as const;

/** AI role identifiers used across prompt layers and routing */
export const AI_ROLES = [
  "researcher",
  "planner",
  "creator",
  "adapter",
  "marketing",
  "social",
  "reviewer",
] as const;

export type AiRole = (typeof AI_ROLES)[number];

/** Prompt layer ordering — referenced when composing prompt chains */
export const PROMPT_LAYERS = [
  "master_system",
  "role",
  "domain",
  "category",
  "platform",
  "social",
  "output_schema",
  "quality_rules",
  "revision",
] as const;

export type PromptLayer = (typeof PROMPT_LAYERS)[number];

/** Provider routing priority tiers */
export const PROVIDER_TIERS = {
  FREE: 0,
  FREE_FALLBACK: 1,
  PAID: 2,
  PAID_FALLBACK: 3,
} as const;

/** Task lane identifiers for the AI router */
export const TASK_LANES = [
  "search",
  "planning",
  "build",
  "structured_output",
  "review",
] as const;

export type TaskLane = (typeof TASK_LANES)[number];

/** Default limits — can be overridden via dashboard settings later */
export const DEFAULTS = {
  /** Max retries per workflow step before marking failed */
  MAX_STEP_RETRIES: 3,
  /** Cooldown period in seconds after a provider rate-limit */
  PROVIDER_COOLDOWN_SECS: 60,
  /** Max concurrent workflow runs (enforced by Durable Object) */
  MAX_CONCURRENT_RUNS: 5,
} as const;
