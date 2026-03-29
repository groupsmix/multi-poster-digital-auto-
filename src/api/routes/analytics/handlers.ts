/**
 * Analytics & Usage Tracking — Dashboard stats route handlers.
 *
 * Provides API endpoints for:
 *   - Dashboard overview stats
 *   - Provider usage breakdown
 *   - Step timing analysis
 *   - Approval/rejection counts
 *   - Routing audit trail (free-first routing visibility)
 *   - Per-run provider path
 *   - Per-run event log
 *   - Daily trend data
 */

import type { Env } from "../../../shared/types";
import {
  json,
  badRequest,
  notFound,
  serverError,
} from "../../../shared/utils";
import {
  getDashboardStats,
  getRunProviderPath,
  getRunEvents,
  getProviderBreakdown,
  recordEvent,
  recordApprovalEvent,
  recordStepTiming,
  recordCostEvent,
} from "../../../services/analytics";
import type { AnalyticsEventType } from "../../../services/analytics";
import { parseJsonBody, validateFields } from "../../../shared/utils";

// ── Dashboard Stats ──────────────────────────────────────────

/**
 * GET /api/analytics/dashboard
 *
 * Returns aggregated dashboard stats including:
 * - Overview (total runs, success/fail, cost, avg duration)
 * - Provider usage breakdown
 * - Step timing analysis
 * - Approval/rejection counts
 * - Recent routing audit trail
 * - Daily trend data
 *
 * Query params:
 * - start_date: YYYY-MM-DD (default: 30 days ago)
 * - end_date: YYYY-MM-DD (default: today)
 * - domain_id: filter by domain (optional)
 */
export async function getDashboard(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("start_date") ?? undefined;
    const endDate = url.searchParams.get("end_date") ?? undefined;
    const domainId = url.searchParams.get("domain_id") ?? undefined;

    const stats = await getDashboardStats(env, startDate, endDate, domainId);

    return json({ data: stats });
  } catch (err) {
    console.error("[analytics/dashboard]", err);
    return serverError("Failed to load dashboard stats.");
  }
}

// ── Provider Usage ───────────────────────────────────────────

/**
 * GET /api/analytics/providers
 *
 * Returns provider usage breakdown showing which providers were used,
 * success/failure rates, failover counts, and cost.
 * This is the core endpoint for auditing free-first routing behavior.
 *
 * Query params:
 * - start_date: YYYY-MM-DD
 * - end_date: YYYY-MM-DD
 */
export async function getProviderUsage(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("start_date") ?? undefined;
    const endDate = url.searchParams.get("end_date") ?? undefined;

    const breakdown = await getProviderBreakdown(env, startDate, endDate);

    return json({ data: breakdown });
  } catch (err) {
    console.error("[analytics/providers]", err);
    return serverError("Failed to load provider usage.");
  }
}

// ── Routing Audit Trail ──────────────────────────────────────

/**
 * GET /api/analytics/routing
 *
 * Returns the routing audit trail showing the full provider chain walk
 * for recent runs. Each entry shows which providers were tried,
 * which were skipped (and why), and which ultimately succeeded.
 *
 * This makes the free-first routing behavior fully auditable.
 *
 * Query params:
 * - run_id: filter by specific run (optional)
 * - limit: max results (default: 50)
 */
export async function getRoutingAudit(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const runId = url.searchParams.get("run_id");
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

    if (runId) {
      const path = await getRunProviderPath(env, runId);
      return json({ data: path, total: path.length });
    }

    // General routing audit query
    const result = await env.DB.prepare(
      `SELECT * FROM routing_audit_log
       ORDER BY created_at DESC
       LIMIT ?`,
    )
      .bind(Math.min(limit, 200))
      .all();

    return json({ data: result.results, total: result.results.length });
  } catch (err) {
    console.error("[analytics/routing]", err);
    return serverError("Failed to load routing audit.");
  }
}

// ── Run Analytics ────────────────────────────────────────────

/**
 * GET /api/analytics/runs/:runId
 *
 * Returns full analytics for a specific workflow run including:
 * - Provider path (which providers were tried and used)
 * - All analytics events for the run
 * - Step timing data
 *
 * This gives complete visibility into provider usage per run.
 */
export async function getRunAnalytics(
  env: Env,
  runId: string,
): Promise<Response> {
  try {
    // Verify the run exists
    const run = await env.DB.prepare(
      "SELECT * FROM workflow_runs WHERE id = ?",
    )
      .bind(runId)
      .first();

    if (!run) return notFound(`Workflow run not found: ${runId}`);

    // Get provider path and events in parallel
    const [providerPath, events] = await Promise.all([
      getRunProviderPath(env, runId),
      getRunEvents(env, runId),
    ]);

    // Get step details for this run
    const steps = await env.DB.prepare(
      `SELECT id, step_name, role_type, status, provider_used, model_used,
              retries, started_at, finished_at,
              CASE
                WHEN finished_at IS NOT NULL AND started_at IS NOT NULL
                THEN CAST((julianday(finished_at) - julianday(started_at)) * 86400000 AS INTEGER)
                ELSE NULL
              END as duration_ms
       FROM workflow_steps
       WHERE run_id = ?
       ORDER BY created_at ASC`,
    )
      .bind(runId)
      .all();

    // Get cost events for this run
    const costs = await env.DB.prepare(
      `SELECT * FROM cost_events WHERE run_id = ? ORDER BY created_at ASC`,
    )
      .bind(runId)
      .all();

    return json({
      data: {
        run,
        steps: steps.results,
        providerPath,
        events,
        costs: costs.results,
        summary: {
          totalSteps: steps.results.length,
          completedSteps: steps.results.filter((s) => s.status === "completed").length,
          failedSteps: steps.results.filter((s) => s.status === "failed").length,
          totalRetries: steps.results.reduce((sum, s) => sum + ((s.retries as number) ?? 0), 0),
          totalProviderAttempts: providerPath.reduce((sum, p) => sum + p.totalAttempts, 0),
          totalFailovers: providerPath.reduce((sum, p) => sum + p.failoverCount, 0),
          totalCost: costs.results.reduce((sum, c) => sum + ((c.usage_amount as number) ?? 0), 0),
        },
      },
    });
  } catch (err) {
    console.error("[analytics/run]", err);
    return serverError("Failed to load run analytics.");
  }
}

// ── Step Timing ──────────────────────────────────────────────

/**
 * GET /api/analytics/step-timing
 *
 * Returns step timing analysis showing average, min, max durations
 * per step type, plus retry and success/failure counts.
 *
 * Query params:
 * - start_date: YYYY-MM-DD
 * - end_date: YYYY-MM-DD
 */
export async function getStepTimingAnalytics(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("start_date") ??
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const endDate = url.searchParams.get("end_date") ??
      new Date().toISOString().slice(0, 10);

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

    return json({ data: result.results, total: result.results.length });
  } catch (err) {
    console.error("[analytics/step-timing]", err);
    return serverError("Failed to load step timing.");
  }
}

// ── Approval Stats ───────────────────────────────────────────

/**
 * GET /api/analytics/approvals
 *
 * Returns approval/rejection counts grouped by reviewer type and domain.
 *
 * Query params:
 * - start_date: YYYY-MM-DD
 * - end_date: YYYY-MM-DD
 * - domain_id: filter by domain (optional)
 * - reviewer_type: filter by reviewer type (optional)
 */
export async function getApprovalAnalytics(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("start_date") ??
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const endDate = url.searchParams.get("end_date") ??
      new Date().toISOString().slice(0, 10);
    const domainId = url.searchParams.get("domain_id");
    const reviewerType = url.searchParams.get("reviewer_type");

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
    if (reviewerType) {
      query += " AND reviewer_type = ?";
      binds.push(reviewerType);
    }

    query += " GROUP BY reviewer_type, domain_id ORDER BY total_reviews DESC";

    const result = await env.DB.prepare(query).bind(...binds).all();

    // Also get live counts from reviews table for current state
    const liveResult = await env.DB.prepare(
      `SELECT reviewer_type,
              COUNT(*) as total,
              SUM(CASE WHEN approval_status = 'approved' THEN 1 ELSE 0 END) as approved,
              SUM(CASE WHEN approval_status = 'rejected' THEN 1 ELSE 0 END) as rejected,
              SUM(CASE WHEN approval_status = 'revision_requested' THEN 1 ELSE 0 END) as revision_requested,
              SUM(CASE WHEN approval_status = 'pending' THEN 1 ELSE 0 END) as pending
       FROM reviews
       WHERE created_at >= ? AND created_at <= ?
       GROUP BY reviewer_type`,
    )
      .bind(startDate, endDate + "T23:59:59")
      .all();

    return json({
      data: {
        aggregated: result.results,
        live: liveResult.results,
      },
    });
  } catch (err) {
    console.error("[analytics/approvals]", err);
    return serverError("Failed to load approval stats.");
  }
}

// ── Cost Analytics ───────────────────────────────────────────

/**
 * GET /api/analytics/costs
 *
 * Returns cost/credits breakdown by provider, model, and time period.
 *
 * Query params:
 * - start_date: YYYY-MM-DD
 * - end_date: YYYY-MM-DD
 * - group_by: "provider" | "model" | "day" (default: "provider")
 */
export async function getCostAnalytics(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("start_date") ??
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const endDate = url.searchParams.get("end_date") ??
      new Date().toISOString().slice(0, 10);
    const groupBy = url.searchParams.get("group_by") ?? "provider";

    let query: string;

    switch (groupBy) {
      case "model":
        query = `SELECT provider, model, request_type,
                        COUNT(*) as total_calls,
                        SUM(usage_amount) as total_cost,
                        AVG(usage_amount) as avg_cost
                 FROM cost_events
                 WHERE created_at >= ? AND created_at <= ?
                 GROUP BY provider, model, request_type
                 ORDER BY total_cost DESC`;
        break;
      case "day":
        query = `SELECT date(created_at) as date,
                        COUNT(*) as total_calls,
                        SUM(usage_amount) as total_cost,
                        AVG(usage_amount) as avg_cost
                 FROM cost_events
                 WHERE created_at >= ? AND created_at <= ?
                 GROUP BY date(created_at)
                 ORDER BY date ASC`;
        break;
      default: // "provider"
        query = `SELECT provider,
                        COUNT(*) as total_calls,
                        SUM(usage_amount) as total_cost,
                        AVG(usage_amount) as avg_cost
                 FROM cost_events
                 WHERE created_at >= ? AND created_at <= ?
                 GROUP BY provider
                 ORDER BY total_cost DESC`;
        break;
    }

    const result = await env.DB.prepare(query)
      .bind(startDate, endDate + "T23:59:59")
      .all();

    // Also get grand total
    const totalResult = await env.DB.prepare(
      `SELECT COALESCE(SUM(usage_amount), 0) as grand_total,
              COUNT(*) as total_calls
       FROM cost_events
       WHERE created_at >= ? AND created_at <= ?`,
    )
      .bind(startDate, endDate + "T23:59:59")
      .first();

    return json({
      data: {
        breakdown: result.results,
        grandTotal: (totalResult?.grand_total as number) ?? 0,
        totalCalls: (totalResult?.total_calls as number) ?? 0,
      },
    });
  } catch (err) {
    console.error("[analytics/costs]", err);
    return serverError("Failed to load cost analytics.");
  }
}

// ── Daily Trend ──────────────────────────────────────────────

/**
 * GET /api/analytics/trends
 *
 * Returns daily trend data for visualization.
 *
 * Query params:
 * - start_date: YYYY-MM-DD
 * - end_date: YYYY-MM-DD
 */
export async function getDailyTrends(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get("start_date") ??
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const endDate = url.searchParams.get("end_date") ??
      new Date().toISOString().slice(0, 10);

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

    return json({ data: result.results, total: result.results.length });
  } catch (err) {
    console.error("[analytics/trends]", err);
    return serverError("Failed to load daily trends.");
  }
}

// ── Record Event (POST) ─────────────────────────────────────

/**
 * POST /api/analytics/events
 *
 * Manually record an analytics event.
 * Mainly used by internal services, but exposed for extensibility.
 */
export async function createAnalyticsEvent(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = await parseJsonBody(request);
    if (!body) return badRequest("Invalid or empty JSON body.");

    const errors = validateFields(body, [
      { field: "event_type", required: true, type: "string" },
      { field: "outcome", required: true, type: "string" },
    ]);
    if (errors.length > 0) return badRequest(errors.join(" "));

    const id = await recordEvent(env, {
      eventType: body.event_type as AnalyticsEventType,
      runId: body.run_id as string | undefined,
      stepId: body.step_id as string | undefined,
      productId: body.product_id as string | undefined,
      providerId: body.provider_id as string | undefined,
      providerName: body.provider_name as string | undefined,
      model: body.model as string | undefined,
      taskLane: body.task_lane as string | undefined,
      outcome: body.outcome as string,
      durationMs: body.duration_ms as number | undefined,
      costEstimate: body.cost_estimate as number | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined,
    });

    return json({ data: { id }, message: "Event recorded." }, 201);
  } catch (err) {
    console.error("[analytics/create-event]", err);
    return serverError("Failed to record event.");
  }
}

// ── Events List ──────────────────────────────────────────────

/**
 * GET /api/analytics/events
 *
 * List analytics events with optional filtering.
 *
 * Query params:
 * - event_type: filter by event type
 * - run_id: filter by run
 * - product_id: filter by product
 * - provider_name: filter by provider
 * - limit: max results (default: 100)
 * - offset: pagination offset (default: 0)
 */
export async function listAnalyticsEvents(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const eventType = url.searchParams.get("event_type");
    const runId = url.searchParams.get("run_id");
    const productId = url.searchParams.get("product_id");
    const providerName = url.searchParams.get("provider_name");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    let query = "SELECT * FROM analytics_events WHERE 1=1";
    const binds: unknown[] = [];

    if (eventType) {
      query += " AND event_type = ?";
      binds.push(eventType);
    }
    if (runId) {
      query += " AND run_id = ?";
      binds.push(runId);
    }
    if (productId) {
      query += " AND product_id = ?";
      binds.push(productId);
    }
    if (providerName) {
      query += " AND provider_name = ?";
      binds.push(providerName);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    binds.push(limit, offset);

    const stmt = env.DB.prepare(query);
    const result = await stmt.bind(...binds).all();

    return json({ data: result.results, total: result.results.length, limit, offset });
  } catch (err) {
    console.error("[analytics/list-events]", err);
    return serverError("Failed to list analytics events.");
  }
}
