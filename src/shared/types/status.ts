/**
 * Lifecycle status values used across products, variants, and workflow steps.
 * These are stored as TEXT in D1 and enforced at the application layer.
 */

/** Product / variant statuses */
export type ProductStatus =
  | "draft"
  | "queued"
  | "running"
  | "waiting_for_review"
  | "rejected"
  | "revision_requested"
  | "approved"
  | "ready_to_publish"
  | "publishing"
  | "published"
  | "archived"
  | "failed_partial"
  | "failed";

/** Workflow step statuses */
export type StepStatus =
  | "pending"
  | "running"
  | "retrying"
  | "cooldown_wait"
  | "completed"
  | "failed"
  | "skipped";

/** AI provider states */
export type ProviderState =
  | "active"
  | "sleeping"
  | "cooldown"
  | "rate_limited"
  | "error"
  | "disabled";

/** Review / approval outcomes */
export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "revision_requested";
