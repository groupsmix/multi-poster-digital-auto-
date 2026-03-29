/**
 * Analytics Service — records and queries usage tracking data.
 *
 * Tracks:
 *   - Provider usage per run (which providers were called, outcomes)
 *   - Retries (how many times a step retried before success/failure)
 *   - Failovers (when provider A failed and provider B was used)
 *   - Time per step (duration of each workflow step)
 *   - Approval/rejection counts (review outcomes)
 *   - Cost/credits (estimated cost per provider call)
 *   - Full routing audit trail (free-first routing behavior)
 */

import type { Env } from "../shared/types";
import type { RoutingAttempt } from "../providers/types";
import { generateId } from "../shared/utils";

// ── Event types ─────────────────────────────────────────────

/** All trackable event types in the analytics system. */
export const ANALYTICS_EVENT_TYPES = [
  "provider_call",
  "provider_retry",
  "provider_failover",
  "provider_rate_limit",
  "step_started",
  "step_completed",
  "step_failed",
  "workflow_started",
  "workflow_completed",
  "workflow_failed",
  "review_created",
  "review_approved",
  "review_rejected",
  "review_revision_requested",
  "regeneration_triggered",
  "cost_recorded",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

// ── Interfaces ──────────────────────────────────────────────

/** Input for recording an analytics event. */
export interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  runId?: string;
  stepId?: string;
  productId?: string;
  providerId?: string;
  providerName?: string;
  model?: string;
  taskLane?: string;
  outcome: string;
  durationMs?: number;
  tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  costEstimate?: number;
  metadata?: Record<string, unknown>;
}

/** Input for recording a routing audit entry. */
export interface RoutingAuditInput {
  runId?: string;
  stepId?: string;
  productId?: string;
  taskLane: string;
  attempts: RoutingAttempt[];
  selectedProvider?: string;
  selectedModel?: string;
  selectedTier?: number;
  finalOutcome: string;
  totalLatencyMs?: number;
}

/** Ranked insight row for "most X" dashboard metrics. */
export interface RankedInsight {
  label: string;
  id: string | null;
  count: number;
  extra?: Record<string, unknown>;
}

export interface DashboardStats {
  overview: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    totalCost: number;
    avgRunDurationMs: number;
  };
  providerUsage: ProviderUsageRow[];
  stepTiming: StepTimingRow[];
  approvalStats: ApprovalStatsRow[];
  recentRouting: RoutingAuditRow[];
  dailyTrend: DailyTrendRow[];
  insights: {
    mostUsedDomain: RankedInsight | null;
    mostUsedCategory: RankedInsight | null;
    bestPerformingPlatform: RankedInsight | null;
    mostApprovedPromptVersion: RankedInsight | null;
    mostReliableProvider: RankedInsight | null;
    avgRevisionsBeforeApproval: number;
    costPerApprovedOutput: number;
  };
}

export interface ProviderUsageRow {
  providerName: string;
  model: string | null;
  taskLane: string;
  totalCalls: number;
  successful: number;
  failed: number;
  rateLimited: number;
  failovers: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCost: number;
}

export interface StepTimingRow {
  stepName: string;
  roleType: string;
  totalRuns: number;
  avgDurationMs: number;
  minDurationMs: number | null;
  maxDurationMs: number | null;
  totalRetries: number;
  successCount: number;
  failureCount: number;
}

export interface ApprovalStatsRow {
  reviewerType: string;
  domainId: string | null;
  totalReviews: number;
  approved: number;
  rejected: number;
  revisionRequested: number;
  pending: number;
}

export interface RoutingAuditRow {
  id: string;
  runId: string | null;
  productId: string | null;
  taskLane: string;
  chainJson: string;
  selectedProvider: string | null;
  selectedModel: string | null;
  selectedTier: number | null;
  totalAttempts: number;
  skippedFree: number;
  skippedPaid: number;
  failoverCount: number;
  finalOutcome: string;
  totalLatencyMs: number | null;
  createdAt: string;
}

export interface DailyTrendRow {
  date: string;
  totalEvents: number;
  providerCalls: number;
  failovers: number;
  retries: number;
  totalCost: number;
  approvals: number;
  rejections: number;
}

// ── Recording functions ─────────────────────────────────────

/**
 * Record a single analytics event.
 */
export async function recordEvent(
  env: Env,
  event: AnalyticsEvent,
): Promise<string> {
  const id = generateId("ae_");
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO analytics_events
         (id, event_type, run_id, step_id, product_id, provider_id,
          provider_name, model, task_lane, outcome, duration_ms,
          token_usage, cost_estimate, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        event.eventType,
        event.runId ?? null,
        event.stepId ?? null,
        event.productId ?? null,
        event.providerId ?? null,
        event.providerName ?? null,
        event.model ?? null,
        event.taskLane ?? null,
        event.outcome,
        event.durationMs ?? null,
        event.tokenUsage ? JSON.stringify(event.tokenUsage) : null,
        event.costEstimate ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        now,
      )
      .run();
  } catch (err) {
    console.error("[analytics/recordEvent]", err);
  }

  return id;
}

/**
 * Record provider routing attempts from a completed routing cycle.
 *
 * Creates individual analytics events for each attempt and
 * a routing audit log entry for the full chain walk.
 */
export async function recordRoutingAttempts(
  env: Env,
  input: RoutingAuditInput,
): Promise<string> {
  const auditId = generateId("ral_");
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Analyze the routing chain for audit metrics
  let skippedFree = 0;
  let skippedPaid = 0;
  let failoverCount = 0;
  let foundSuccess = false;

  for (const attempt of input.attempts) {
    // Record individual event for each attempt
    const eventType = resolveAttemptEventType(attempt.outcome);
    await recordEvent(env, {
      eventType,
      runId: input.runId,
      stepId: input.stepId,
      productId: input.productId,
      providerId: attempt.providerId,
      providerName: attempt.providerName,
      model: attempt.model ?? undefined,
      taskLane: input.taskLane,
      outcome: attempt.outcome,
      durationMs: attempt.latencyMs,
      metadata: attempt.error ? { error: attempt.error } : undefined,
    });

    // Count skipped/failover metrics
    if (attempt.outcome === "success") {
      foundSuccess = true;
    } else if (attempt.outcome.startsWith("skipped_")) {
      // We can't know tier from attempt alone; count all skips
      skippedFree++;
    } else if (
      attempt.outcome === "rate_limited" ||
      attempt.outcome === "error"
    ) {
      failoverCount++;
    }
  }

  // If success happened after failures, those failures were failovers
  if (foundSuccess && failoverCount > 0) {
    // Update provider usage summary with failover count
    await updateProviderUsageSummary(env, today, input, failoverCount);
  }

  // Record the full routing audit log
  try {
    await env.DB.prepare(
      `INSERT INTO routing_audit_log
         (id, run_id, step_id, product_id, task_lane, chain_json,
          selected_provider, selected_model, selected_tier,
          total_attempts, skipped_free, skipped_paid, failover_count,
          final_outcome, total_latency_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        auditId,
        input.runId ?? null,
        input.stepId ?? null,
        input.productId ?? null,
        input.taskLane,
        JSON.stringify(input.attempts),
        input.selectedProvider ?? null,
        input.selectedModel ?? null,
        input.selectedTier ?? null,
        input.attempts.length,
        skippedFree,
        skippedPaid,
        failoverCount,
        input.finalOutcome,
        input.totalLatencyMs ?? null,
        now,
      )
      .run();
  } catch (err) {
    console.error("[analytics/recordRoutingAttempts]", err);
  }

  return auditId;
}

/**
 * Record step timing data when a workflow step completes or fails.
 */
export async function recordStepTiming(
  env: Env,
  stepName: string,
  roleType: string,
  durationMs: number,
  retries: number,
  succeeded: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  try {
    // Try to update existing summary row
    const existing = await env.DB.prepare(
      `SELECT id, total_runs, avg_duration_ms, min_duration_ms, max_duration_ms,
              total_duration_ms, total_retries, success_count, failure_count
       FROM step_timing_summary
       WHERE date = ? AND step_name = ? AND role_type = ?`,
    )
      .bind(today, stepName, roleType)
      .first();

    if (existing) {
      const totalRuns = (existing.total_runs as number) + 1;
      const totalDuration = (existing.total_duration_ms as number) + durationMs;
      const avgDuration = totalDuration / totalRuns;
      const minDuration = existing.min_duration_ms !== null
        ? Math.min(existing.min_duration_ms as number, durationMs)
        : durationMs;
      const maxDuration = existing.max_duration_ms !== null
        ? Math.max(existing.max_duration_ms as number, durationMs)
        : durationMs;

      await env.DB.prepare(
        `UPDATE step_timing_summary
         SET total_runs = ?, avg_duration_ms = ?, min_duration_ms = ?,
             max_duration_ms = ?, total_duration_ms = ?, total_retries = ?,
             success_count = ?, failure_count = ?, updated_at = ?
         WHERE id = ?`,
      )
        .bind(
          totalRuns,
          avgDuration,
          minDuration,
          maxDuration,
          totalDuration,
          (existing.total_retries as number) + retries,
          (existing.success_count as number) + (succeeded ? 1 : 0),
          (existing.failure_count as number) + (succeeded ? 0 : 1),
          now,
          existing.id as string,
        )
        .run();
    } else {
      const id = generateId("sts_");
      await env.DB.prepare(
        `INSERT INTO step_timing_summary
           (id, date, step_name, role_type, total_runs, avg_duration_ms,
            min_duration_ms, max_duration_ms, total_duration_ms,
            total_retries, success_count, failure_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id, today, stepName, roleType, durationMs,
          durationMs, durationMs, durationMs, retries,
          succeeded ? 1 : 0, succeeded ? 0 : 1, now, now,
        )
        .run();
    }
  } catch (err) {
    console.error("[analytics/recordStepTiming]", err);
  }
}

/**
 * Record an approval/rejection event and update daily stats.
 */
export async function recordApprovalEvent(
  env: Env,
  reviewerType: string,
  domainId: string | null,
  status: "approved" | "rejected" | "revision_requested" | "pending",
): Promise<void> {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Map status to event type
  const eventTypeMap: Record<string, AnalyticsEventType> = {
    approved: "review_approved",
    rejected: "review_rejected",
    revision_requested: "review_revision_requested",
    pending: "review_created",
  };

  await recordEvent(env, {
    eventType: eventTypeMap[status] ?? "review_created",
    outcome: status,
    metadata: { reviewer_type: reviewerType, domain_id: domainId },
  });

  try {
    const existing = await env.DB.prepare(
      `SELECT id, total_reviews, approved, rejected, revision_requested, pending
       FROM approval_stats
       WHERE date = ? AND reviewer_type = ? AND (domain_id = ? OR (domain_id IS NULL AND ? IS NULL))`,
    )
      .bind(today, reviewerType, domainId, domainId)
      .first();

    if (existing) {
      const field = status === "revision_requested" ? "revision_requested" : status;
      await env.DB.prepare(
        `UPDATE approval_stats
         SET total_reviews = total_reviews + 1,
             ${field} = ${field} + 1,
             updated_at = ?
         WHERE id = ?`,
      )
        .bind(now, existing.id as string)
        .run();
    } else {
      const id = generateId("as_");
      await env.DB.prepare(
        `INSERT INTO approval_stats
           (id, date, reviewer_type, domain_id, total_reviews,
            approved, rejected, revision_requested, pending, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id, today, reviewerType, domainId,
          status === "approved" ? 1 : 0,
          status === "rejected" ? 1 : 0,
          status === "revision_requested" ? 1 : 0,
          status === "pending" ? 1 : 0,
          now, now,
        )
        .run();
    }
  } catch (err) {
    console.error("[analytics/recordApprovalEvent]", err);
  }
}

/**
 * Record a cost event and update provider usage summary.
 */
export async function recordCostEvent(
  env: Env,
  provider: string,
  model: string,
  requestType: string,
  usageAmount: number,
  runId?: string,
  tokenUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number },
): Promise<string> {
  const id = generateId("ce_");
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      `INSERT INTO cost_events
         (id, provider, model, request_type, usage_amount, run_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, provider, model, requestType, usageAmount, runId ?? null, now)
      .run();

    // Also record as analytics event
    await recordEvent(env, {
      eventType: "cost_recorded",
      runId,
      providerName: provider,
      model,
      taskLane: requestType,
      outcome: "recorded",
      costEstimate: usageAmount,
      tokenUsage,
    });
  } catch (err) {
    console.error("[analytics/recordCostEvent]", err);
  }

  return id;
}

// ── Query functions ─────────────────────────────────────────

/**
 * Get dashboard stats for a given date range.
 */
export async function getDashboardStats(
  env: Env,
  startDate?: string,
  endDate?: string,
  domainId?: string,
): Promise<DashboardStats> {
  const now = new Date().toISOString();
  const start = startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = endDate ?? now.slice(0, 10);

  const [overview, providerUsage, stepTiming, approvalStats, recentRouting, dailyTrend, insights] =
    await Promise.all([
      getOverviewStats(env, start, end),
      getProviderUsageStats(env, start, end),
      getStepTimingStats(env, start, end),
      getApprovalStats(env, start, end, domainId),
      getRecentRoutingAudits(env, 20),
      getDailyTrend(env, start, end),
      getDashboardInsights(env, start, end),
    ]);

  return {
    overview,
    providerUsage,
    stepTiming,
    approvalStats,
    recentRouting,
    dailyTrend,
    insights,
  };
}

/**
 * Get provider usage for a specific workflow run (provider path per run).
 */
export async function getRunProviderPath(
  env: Env,
  runId: string,
): Promise<RoutingAuditRow[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT * FROM routing_audit_log
       WHERE run_id = ?
       ORDER BY created_at ASC`,
    )
      .bind(runId)
      .all();

    return result.results.map(mapRoutingAuditRow);
  } catch (err) {
    console.error("[analytics/getRunProviderPath]", err);
    return [];
  }
}

/**
 * Get analytics events for a specific workflow run.
 */
export async function getRunEvents(
  env: Env,
  runId: string,
): Promise<Record<string, unknown>[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT * FROM analytics_events
       WHERE run_id = ?
       ORDER BY created_at ASC`,
    )
      .bind(runId)
      .all();

    return result.results as Record<string, unknown>[];
  } catch (err) {
    console.error("[analytics/getRunEvents]", err);
    return [];
  }
}

/**
 * Get provider usage breakdown (free vs paid, success rates).
 */
export async function getProviderBreakdown(
  env: Env,
  startDate?: string,
  endDate?: string,
): Promise<Record<string, unknown>[]> {
  const start = startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = endDate ?? new Date().toISOString().slice(0, 10);

  try {
    const result = await env.DB.prepare(
      `SELECT provider_name, model, task_lane,
              SUM(total_calls) as total_calls,
              SUM(successful) as successful,
              SUM(failed) as failed,
              SUM(rate_limited) as rate_limited,
              SUM(failovers) as failovers,
              AVG(avg_latency_ms) as avg_latency_ms,
              SUM(total_tokens) as total_tokens,
              SUM(total_cost) as total_cost
       FROM provider_usage_summary
       WHERE date >= ? AND date <= ?
       GROUP BY provider_name, model, task_lane
       ORDER BY total_calls DESC`,
    )
      .bind(start, end)
      .all();

    return result.results as Record<string, unknown>[];
  } catch (err) {
    console.error("[analytics/getProviderBreakdown]", err);
    return [];
  }
}

// ── Internal helpers ────────────────────────────────────────

function resolveAttemptEventType(outcome: string): AnalyticsEventType {
  switch (outcome) {
    case "success":
      return "provider_call";
    case "rate_limited":
      return "provider_rate_limit";
    case "error":
      return "provider_failover";
    case "skipped_no_key":
    case "skipped_sleeping":
    case "skipped_cooldown":
    case "skipped_disabled":
      return "provider_call";
    default:
      return "provider_call";
  }
}

async function updateProviderUsageSummary(
  env: Env,
  today: string,
  input: RoutingAuditInput,
  failoverCount: number,
): Promise<void> {
  if (!input.selectedProvider) return;

  try {
    const existing = await env.DB.prepare(
      `SELECT id FROM provider_usage_summary
       WHERE date = ? AND provider_name = ? AND task_lane = ?
       AND (model = ? OR (model IS NULL AND ? IS NULL))`,
    )
      .bind(today, input.selectedProvider, input.taskLane, input.selectedModel ?? null, input.selectedModel ?? null)
      .first();

    const now = new Date().toISOString();

    if (existing) {
      await env.DB.prepare(
        `UPDATE provider_usage_summary
         SET total_calls = total_calls + 1,
             successful = successful + CASE WHEN ? = 'success' THEN 1 ELSE 0 END,
             failed = failed + CASE WHEN ? != 'success' THEN 1 ELSE 0 END,
             failovers = failovers + ?,
             total_latency_ms = COALESCE(total_latency_ms, 0) + COALESCE(?, 0),
             updated_at = ?
         WHERE id = ?`,
      )
        .bind(
          input.finalOutcome,
          input.finalOutcome,
          failoverCount,
          input.totalLatencyMs ?? 0,
          now,
          existing.id as string,
        )
        .run();
    } else {
      const id = generateId("pus_");
      await env.DB.prepare(
        `INSERT INTO provider_usage_summary
           (id, date, provider_name, model, task_lane,
            total_calls, successful, failed, rate_limited, skipped,
            total_retries, failovers, avg_latency_ms, total_tokens, total_cost,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0, 0, 0, ?, ?, 0, 0, ?, ?)`,
      )
        .bind(
          id, today, input.selectedProvider, input.selectedModel ?? null, input.taskLane,
          input.finalOutcome === "success" ? 1 : 0,
          input.finalOutcome !== "success" ? 1 : 0,
          failoverCount,
          input.totalLatencyMs ?? 0,
          now, now,
        )
        .run();
    }
  } catch (err) {
    console.error("[analytics/updateProviderUsageSummary]", err);
  }
}

async function getOverviewStats(
  env: Env,
  startDate: string,
  endDate: string,
): Promise<DashboardStats["overview"]> {
  try {
    const result = await env.DB.prepare(
      `SELECT
         COUNT(*) as total_runs,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_runs,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_runs,
         AVG(CASE
           WHEN finished_at IS NOT NULL AND started_at IS NOT NULL
           THEN (julianday(finished_at) - julianday(started_at)) * 86400000
           ELSE NULL
         END) as avg_run_duration_ms
       FROM workflow_runs
       WHERE created_at >= ? AND created_at <= ?`,
    )
      .bind(startDate, endDate + "T23:59:59")
      .first();

    const costResult = await env.DB.prepare(
      `SELECT COALESCE(SUM(usage_amount), 0) as total_cost
       FROM cost_events
       WHERE created_at >= ? AND created_at <= ?`,
    )
      .bind(startDate, endDate + "T23:59:59")
      .first();

    return {
      totalRuns: (result?.total_runs as number) ?? 0,
      successfulRuns: (result?.successful_runs as number) ?? 0,
      failedRuns: (result?.failed_runs as number) ?? 0,
      totalCost: (costResult?.total_cost as number) ?? 0,
      avgRunDurationMs: (result?.avg_run_duration_ms as number) ?? 0,
    };
  } catch (err) {
    console.error("[analytics/getOverviewStats]", err);
    return { totalRuns: 0, successfulRuns: 0, failedRuns: 0, totalCost: 0, avgRunDurationMs: 0 };
  }
}

async function getProviderUsageStats(
  env: Env,
  startDate: string,
  endDate: string,
): Promise<ProviderUsageRow[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT provider_name, model, task_lane,
              SUM(total_calls) as total_calls,
              SUM(successful) as successful,
              SUM(failed) as failed,
              SUM(rate_limited) as rate_limited,
              SUM(failovers) as failovers,
              AVG(avg_latency_ms) as avg_latency_ms,
              SUM(total_tokens) as total_tokens,
              SUM(total_cost) as total_cost
       FROM provider_usage_summary
       WHERE date >= ? AND date <= ?
       GROUP BY provider_name, model, task_lane
       ORDER BY total_calls DESC`,
    )
      .bind(startDate, endDate)
      .all();

    return result.results.map((r) => ({
      providerName: r.provider_name as string,
      model: r.model as string | null,
      taskLane: r.task_lane as string,
      totalCalls: (r.total_calls as number) ?? 0,
      successful: (r.successful as number) ?? 0,
      failed: (r.failed as number) ?? 0,
      rateLimited: (r.rate_limited as number) ?? 0,
      failovers: (r.failovers as number) ?? 0,
      avgLatencyMs: (r.avg_latency_ms as number) ?? 0,
      totalTokens: (r.total_tokens as number) ?? 0,
      totalCost: (r.total_cost as number) ?? 0,
    }));
  } catch (err) {
    console.error("[analytics/getProviderUsageStats]", err);
    return [];
  }
}

async function getStepTimingStats(
  env: Env,
  startDate: string,
  endDate: string,
): Promise<StepTimingRow[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT step_name, role_type,
              SUM(total_runs) as total_runs,
              AVG(avg_duration_ms) as avg_duration_ms,
              MIN(min_duration_ms) as min_duration_ms,
              MAX(max_duration_ms) as max_duration_ms,
              SUM(total_retries) as total_retries,
              SUM(success_count) as success_count,
              SUM(failure_count) as failure_count
       FROM step_timing_summary
       WHERE date >= ? AND date <= ?
       GROUP BY step_name, role_type
       ORDER BY avg_duration_ms DESC`,
    )
      .bind(startDate, endDate)
      .all();

    return result.results.map((r) => ({
      stepName: r.step_name as string,
      roleType: r.role_type as string,
      totalRuns: (r.total_runs as number) ?? 0,
      avgDurationMs: (r.avg_duration_ms as number) ?? 0,
      minDurationMs: r.min_duration_ms as number | null,
      maxDurationMs: r.max_duration_ms as number | null,
      totalRetries: (r.total_retries as number) ?? 0,
      successCount: (r.success_count as number) ?? 0,
      failureCount: (r.failure_count as number) ?? 0,
    }));
  } catch (err) {
    console.error("[analytics/getStepTimingStats]", err);
    return [];
  }
}

async function getApprovalStats(
  env: Env,
  startDate: string,
  endDate: string,
  domainId?: string,
): Promise<ApprovalStatsRow[]> {
  try {
    let query = `SELECT reviewer_type, domain_id,
                        SUM(total_reviews) as total_reviews,
                        SUM(approved) as approved,
                        SUM(rejected) as rejected,
                        SUM(revision_requested) as revision_requested,
                        SUM(pending) as pending
                 FROM approval_stats
                 WHERE date >= ? AND date <= ?`;
    const binds: unknown[] = [startDate, endDate];

    if (domainId) {
      query += " AND domain_id = ?";
      binds.push(domainId);
    }

    query += " GROUP BY reviewer_type, domain_id ORDER BY total_reviews DESC";

    const stmt = env.DB.prepare(query);
    const result = binds.length > 0 ? await stmt.bind(...binds).all() : await stmt.all();

    return result.results.map((r) => ({
      reviewerType: r.reviewer_type as string,
      domainId: r.domain_id as string | null,
      totalReviews: (r.total_reviews as number) ?? 0,
      approved: (r.approved as number) ?? 0,
      rejected: (r.rejected as number) ?? 0,
      revisionRequested: (r.revision_requested as number) ?? 0,
      pending: (r.pending as number) ?? 0,
    }));
  } catch (err) {
    console.error("[analytics/getApprovalStats]", err);
    return [];
  }
}

async function getRecentRoutingAudits(
  env: Env,
  limit: number,
): Promise<RoutingAuditRow[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT * FROM routing_audit_log
       ORDER BY created_at DESC
       LIMIT ?`,
    )
      .bind(limit)
      .all();

    return result.results.map(mapRoutingAuditRow);
  } catch (err) {
    console.error("[analytics/getRecentRoutingAudits]", err);
    return [];
  }
}

async function getDailyTrend(
  env: Env,
  startDate: string,
  endDate: string,
): Promise<DailyTrendRow[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT
         date(created_at) as date,
         COUNT(*) as total_events,
         SUM(CASE WHEN event_type = 'provider_call' THEN 1 ELSE 0 END) as provider_calls,
         SUM(CASE WHEN event_type = 'provider_failover' THEN 1 ELSE 0 END) as failovers,
         SUM(CASE WHEN event_type = 'provider_retry' THEN 1 ELSE 0 END) as retries,
         COALESCE(SUM(cost_estimate), 0) as total_cost,
         SUM(CASE WHEN event_type = 'review_approved' THEN 1 ELSE 0 END) as approvals,
         SUM(CASE WHEN event_type = 'review_rejected' THEN 1 ELSE 0 END) as rejections
       FROM analytics_events
       WHERE created_at >= ? AND created_at <= ?
       GROUP BY date(created_at)
       ORDER BY date ASC`,
    )
      .bind(startDate, endDate + "T23:59:59")
      .all();

    return result.results.map((r) => ({
      date: r.date as string,
      totalEvents: (r.total_events as number) ?? 0,
      providerCalls: (r.provider_calls as number) ?? 0,
      failovers: (r.failovers as number) ?? 0,
      retries: (r.retries as number) ?? 0,
      totalCost: (r.total_cost as number) ?? 0,
      approvals: (r.approvals as number) ?? 0,
      rejections: (r.rejections as number) ?? 0,
    }));
  } catch (err) {
    console.error("[analytics/getDailyTrend]", err);
    return [];
  }
}

/**
 * Get dashboard insight metrics required by architecture Section 24:
 * most used card, most used category, best performing platform,
 * most approved prompt version, most reliable provider,
 * average revisions before approval, cost per approved output.
 */
async function getDashboardInsights(
  env: Env,
  startDate: string,
  endDate: string,
): Promise<DashboardStats["insights"]> {
  const dateFilter = `created_at >= '${startDate}' AND created_at <= '${endDate}T23:59:59'`;

  const [
    mostUsedDomain,
    mostUsedCategory,
    bestPerformingPlatform,
    mostApprovedPromptVersion,
    mostReliableProvider,
    avgRevisions,
    costPerApproved,
  ] = await Promise.all([
    getMostUsedDomain(env, dateFilter),
    getMostUsedCategory(env, dateFilter),
    getBestPerformingPlatform(env, dateFilter),
    getMostApprovedPromptVersion(env, dateFilter),
    getMostReliableProvider(env, startDate, endDate),
    getAvgRevisionsBeforeApproval(env, dateFilter),
    getCostPerApprovedOutput(env, dateFilter),
  ]);

  return {
    mostUsedDomain,
    mostUsedCategory,
    bestPerformingPlatform,
    mostApprovedPromptVersion,
    mostReliableProvider,
    avgRevisionsBeforeApproval: avgRevisions,
    costPerApprovedOutput: costPerApproved,
  };
}

/** Most used domain card — counts workflow runs per domain. */
async function getMostUsedDomain(
  env: Env,
  dateFilter: string,
): Promise<RankedInsight | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT d.name as label, d.id as id, COUNT(wr.id) as cnt
       FROM workflow_runs wr
       JOIN products p ON wr.product_id = p.id
       JOIN domains d ON p.domain_id = d.id
       WHERE wr.${dateFilter}
       GROUP BY d.id
       ORDER BY cnt DESC
       LIMIT 1`,
    ).first();
    if (!row) return null;
    return { label: row.label as string, id: row.id as string, count: row.cnt as number };
  } catch {
    return null;
  }
}

/** Most used category — counts workflow runs per category. */
async function getMostUsedCategory(
  env: Env,
  dateFilter: string,
): Promise<RankedInsight | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT c.name as label, c.id as id, COUNT(wr.id) as cnt
       FROM workflow_runs wr
       JOIN products p ON wr.product_id = p.id
       JOIN categories c ON p.category_id = c.id
       WHERE wr.${dateFilter}
       GROUP BY c.id
       ORDER BY cnt DESC
       LIMIT 1`,
    ).first();
    if (!row) return null;
    return { label: row.label as string, id: row.id as string, count: row.cnt as number };
  } catch {
    return null;
  }
}

/** Best performing platform — platform with highest approval rate. */
async function getBestPerformingPlatform(
  env: Env,
  dateFilter: string,
): Promise<RankedInsight | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT pl.name as label, pl.id as id,
              COUNT(pv.id) as total,
              SUM(CASE WHEN pv.status = 'approved' THEN 1 ELSE 0 END) as approved
       FROM product_variants pv
       JOIN platforms pl ON pv.platform_id = pl.id
       WHERE pv.${dateFilter} AND pv.platform_id IS NOT NULL
       GROUP BY pl.id
       HAVING total > 0
       ORDER BY (CAST(approved AS REAL) / total) DESC, total DESC
       LIMIT 1`,
    ).first();
    if (!row) return null;
    return {
      label: row.label as string,
      id: row.id as string,
      count: row.total as number,
      extra: { approved: row.approved as number },
    };
  } catch {
    return null;
  }
}

/** Most approved prompt version — prompt template version with most approvals. */
async function getMostApprovedPromptVersion(
  env: Env,
  dateFilter: string,
): Promise<RankedInsight | null> {
  try {
    // Join workflow_runs → workflow_steps (to get prompt version used) → reviews
    // Fallback: count approvals per prompt template from reviews
    const row = await env.DB.prepare(
      `SELECT pt.name as label, pt.id as id, pt.version as version,
              COUNT(r.id) as cnt
       FROM reviews r
       JOIN products p ON r.product_id = p.id
       JOIN prompt_templates pt ON pt.scope_ref = p.domain_id OR pt.scope_ref = p.category_id
       WHERE r.${dateFilter} AND r.approval_status = 'approved' AND pt.is_active = 1
       GROUP BY pt.id
       ORDER BY cnt DESC
       LIMIT 1`,
    ).first();
    if (!row) return null;
    return {
      label: row.label as string,
      id: row.id as string,
      count: row.cnt as number,
      extra: { version: row.version as number },
    };
  } catch {
    return null;
  }
}

/** Most reliable provider — highest success rate from provider_usage_summary. */
async function getMostReliableProvider(
  env: Env,
  startDate: string,
  endDate: string,
): Promise<RankedInsight | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT provider_name as label,
              SUM(total_calls) as total,
              SUM(successful) as ok,
              CASE WHEN SUM(total_calls) > 0
                THEN CAST(SUM(successful) AS REAL) / SUM(total_calls)
                ELSE 0
              END as success_rate
       FROM provider_usage_summary
       WHERE date >= ? AND date <= ?
       GROUP BY provider_name
       HAVING total >= 1
       ORDER BY success_rate DESC, total DESC
       LIMIT 1`,
    )
      .bind(startDate, endDate)
      .first();
    if (!row) return null;
    return {
      label: row.label as string,
      id: null,
      count: row.total as number,
      extra: { successRate: row.success_rate as number, successful: row.ok as number },
    };
  } catch {
    return null;
  }
}

/** Average number of revisions before a product is approved. */
async function getAvgRevisionsBeforeApproval(
  env: Env,
  dateFilter: string,
): Promise<number> {
  try {
    const row = await env.DB.prepare(
      `SELECT AVG(rev_count) as avg_revisions
       FROM (
         SELECT p.id, COUNT(rev.id) as rev_count
         FROM products p
         LEFT JOIN revisions rev ON rev.product_id = p.id
         WHERE p.status = 'approved' AND p.${dateFilter}
         GROUP BY p.id
       )`,
    ).first();
    return (row?.avg_revisions as number) ?? 0;
  } catch {
    return 0;
  }
}

/** Cost per approved output — total cost / number of approved products. */
async function getCostPerApprovedOutput(
  env: Env,
  dateFilter: string,
): Promise<number> {
  try {
    const row = await env.DB.prepare(
      `SELECT
         COALESCE(SUM(ce.usage_amount), 0) as total_cost,
         COUNT(DISTINCT CASE WHEN p.status = 'approved' THEN p.id END) as approved_count
       FROM cost_events ce
       JOIN workflow_runs wr ON ce.run_id = wr.id
       JOIN products p ON wr.product_id = p.id
       WHERE ce.${dateFilter}`,
    ).first();
    const totalCost = (row?.total_cost as number) ?? 0;
    const approvedCount = (row?.approved_count as number) ?? 0;
    return approvedCount > 0 ? totalCost / approvedCount : 0;
  } catch {
    return 0;
  }
}

function mapRoutingAuditRow(r: Record<string, unknown>): RoutingAuditRow {
  return {
    id: r.id as string,
    runId: r.run_id as string | null,
    productId: r.product_id as string | null,
    taskLane: r.task_lane as string,
    chainJson: r.chain_json as string,
    selectedProvider: r.selected_provider as string | null,
    selectedModel: r.selected_model as string | null,
    selectedTier: r.selected_tier as number | null,
    totalAttempts: r.total_attempts as number,
    skippedFree: r.skipped_free as number,
    skippedPaid: r.skipped_paid as number,
    failoverCount: r.failover_count as number,
    finalOutcome: r.final_outcome as string,
    totalLatencyMs: r.total_latency_ms as number | null,
    createdAt: r.created_at as string,
  };
}
