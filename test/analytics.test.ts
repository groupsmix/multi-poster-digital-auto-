import { describe, it, expect, vi } from "vitest";

/**
 * Analytics & Usage Tracking tests.
 *
 * Tests the analytics service and route handlers in isolation
 * by mocking the D1 env. Covers:
 * - Event type constants
 * - Service exports
 * - Route handler responses (dashboard, providers, routing, etc.)
 * - Analytics event recording
 * - Approval stats tracking
 * - Cost analytics
 */

// ── Mock D1 helpers ──────────────────────────────────────────

interface MockRow {
  [key: string]: unknown;
}

function makeMockStmt(options: {
  allResults?: MockRow[];
  firstResult?: MockRow | null;
  runMeta?: { changes: number };
} = {}) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: options.allResults ?? [] }),
    first: vi.fn().mockResolvedValue(options.firstResult ?? null),
    run: vi.fn().mockResolvedValue({ meta: options.runMeta ?? { changes: 1 } }),
  };
  return stmt;
}

function makeMockEnv(stmtOrFn?: ReturnType<typeof makeMockStmt> | ((query: string) => ReturnType<typeof makeMockStmt>)) {
  const defaultStmt = makeMockStmt();
  return {
    DB: {
      prepare: vi.fn((query: string) => {
        if (typeof stmtOrFn === "function") return stmtOrFn(query);
        return stmtOrFn ?? defaultStmt;
      }),
    },
    CACHE: {},
    ASSETS_BUCKET: {},
    WORKFLOW_COORDINATOR: {},
    PROVIDER_ROUTER: {},
    ENVIRONMENT: "test",
    APP_NAME: "NEXUS",
  };
}

function makeRequest(method: string, url: string, body?: unknown): Request {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(url, init);
}

// ── Constants & exports tests ────────────────────────────────

describe("analytics/constants", () => {
  it("exports all expected event types", async () => {
    const { ANALYTICS_EVENT_TYPES } = await import("../src/services/analytics");
    expect(ANALYTICS_EVENT_TYPES).toBeDefined();
    expect(ANALYTICS_EVENT_TYPES.length).toBeGreaterThan(0);

    // Should include key event types
    expect(ANALYTICS_EVENT_TYPES).toContain("provider_call");
    expect(ANALYTICS_EVENT_TYPES).toContain("provider_retry");
    expect(ANALYTICS_EVENT_TYPES).toContain("provider_failover");
    expect(ANALYTICS_EVENT_TYPES).toContain("provider_rate_limit");
    expect(ANALYTICS_EVENT_TYPES).toContain("step_started");
    expect(ANALYTICS_EVENT_TYPES).toContain("step_completed");
    expect(ANALYTICS_EVENT_TYPES).toContain("step_failed");
    expect(ANALYTICS_EVENT_TYPES).toContain("workflow_started");
    expect(ANALYTICS_EVENT_TYPES).toContain("workflow_completed");
    expect(ANALYTICS_EVENT_TYPES).toContain("review_created");
    expect(ANALYTICS_EVENT_TYPES).toContain("review_approved");
    expect(ANALYTICS_EVENT_TYPES).toContain("review_rejected");
    expect(ANALYTICS_EVENT_TYPES).toContain("review_revision_requested");
    expect(ANALYTICS_EVENT_TYPES).toContain("regeneration_triggered");
    expect(ANALYTICS_EVENT_TYPES).toContain("cost_recorded");
  });

  it("has 16 event types total", async () => {
    const { ANALYTICS_EVENT_TYPES } = await import("../src/services/analytics");
    expect(ANALYTICS_EVENT_TYPES.length).toBe(16);
  });
});

describe("analytics/service-exports", () => {
  it("exports recording functions from services index", async () => {
    const services = await import("../src/services/index");
    expect(services.recordEvent).toBeDefined();
    expect(services.recordRoutingAttempts).toBeDefined();
    expect(services.recordStepTiming).toBeDefined();
    expect(services.recordApprovalEvent).toBeDefined();
    expect(services.recordCostEvent).toBeDefined();
    expect(services.ANALYTICS_EVENT_TYPES).toBeDefined();
  });

  it("exports query functions from services index", async () => {
    const services = await import("../src/services/index");
    expect(services.getDashboardStats).toBeDefined();
    expect(services.getRunProviderPath).toBeDefined();
    expect(services.getRunEvents).toBeDefined();
    expect(services.getProviderBreakdown).toBeDefined();
  });
});

// ── recordEvent tests ────────────────────────────────────────

describe("analytics/recordEvent", () => {
  it("inserts an analytics event into D1", async () => {
    const { recordEvent } = await import("../src/services/analytics");
    const env = makeMockEnv();
    const id = await recordEvent(env as any, {
      eventType: "provider_call",
      runId: "run_123",
      providerName: "gemini",
      model: "gemini-2.0-flash",
      taskLane: "search",
      outcome: "success",
      durationMs: 1500,
    });

    expect(id).toBeDefined();
    expect(id.startsWith("ae_")).toBe(true);
    expect(env.DB.prepare).toHaveBeenCalled();

    // Verify the INSERT query was used
    const queries = env.DB.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
    const insertQuery = queries.find((q: string) => q.includes("INSERT INTO analytics_events"));
    expect(insertQuery).toBeDefined();
  });

  it("handles errors gracefully without throwing", async () => {
    const { recordEvent } = await import("../src/services/analytics");
    const errorStmt = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockRejectedValue(new Error("DB error")),
      first: vi.fn().mockRejectedValue(new Error("DB error")),
      run: vi.fn().mockRejectedValue(new Error("DB error")),
    };
    const env = makeMockEnv(() => errorStmt as any);

    // Should not throw
    const id = await recordEvent(env as any, {
      eventType: "provider_call",
      outcome: "error",
    });
    expect(id).toBeDefined();
  });

  it("stores token usage and metadata as JSON", async () => {
    const { recordEvent } = await import("../src/services/analytics");
    const env = makeMockEnv();

    await recordEvent(env as any, {
      eventType: "cost_recorded",
      outcome: "recorded",
      tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      costEstimate: 0.002,
      metadata: { custom: "data" },
    });

    // Verify bind was called with JSON stringified values
    const bindCalls = env.DB.prepare.mock.results[0].value.bind.mock.calls[0];
    // Token usage should be JSON
    const tokenUsageArg = bindCalls.find((arg: unknown) =>
      typeof arg === "string" && arg.includes("promptTokens"));
    expect(tokenUsageArg).toBeDefined();
    // Metadata should be JSON
    const metadataArg = bindCalls.find((arg: unknown) =>
      typeof arg === "string" && arg.includes("custom"));
    expect(metadataArg).toBeDefined();
  });
});

// ── recordStepTiming tests ───────────────────────────────────

describe("analytics/recordStepTiming", () => {
  it("creates new step timing summary when none exists", async () => {
    const { recordStepTiming } = await import("../src/services/analytics");
    const stmtFn = (query: string) => {
      if (query.includes("SELECT") && query.includes("step_timing_summary")) {
        return makeMockStmt({ firstResult: null });
      }
      return makeMockStmt();
    };
    const env = makeMockEnv(stmtFn);

    await recordStepTiming(env as any, "research", "researcher", 2500, 0, true);

    // Should have called INSERT
    const queries = env.DB.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
    const insertQuery = queries.find((q: string) => q.includes("INSERT INTO step_timing_summary"));
    expect(insertQuery).toBeDefined();
  });

  it("updates existing step timing summary", async () => {
    const { recordStepTiming } = await import("../src/services/analytics");
    const existingRow = {
      id: "sts_existing",
      total_runs: 5,
      avg_duration_ms: 2000,
      min_duration_ms: 1500,
      max_duration_ms: 3000,
      total_duration_ms: 10000,
      total_retries: 2,
      success_count: 4,
      failure_count: 1,
    };
    const stmtFn = (query: string) => {
      if (query.includes("SELECT") && query.includes("step_timing_summary")) {
        return makeMockStmt({ firstResult: existingRow });
      }
      return makeMockStmt();
    };
    const env = makeMockEnv(stmtFn);

    await recordStepTiming(env as any, "research", "researcher", 1800, 1, true);

    // Should have called UPDATE
    const queries = env.DB.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
    const updateQuery = queries.find((q: string) => q.includes("UPDATE step_timing_summary"));
    expect(updateQuery).toBeDefined();
  });
});

// ── recordApprovalEvent tests ────────────────────────────────

describe("analytics/recordApprovalEvent", () => {
  it("creates new approval stats row for new date/type", async () => {
    const { recordApprovalEvent } = await import("../src/services/analytics");
    const stmtFn = (query: string) => {
      if (query.includes("SELECT") && query.includes("approval_stats")) {
        return makeMockStmt({ firstResult: null });
      }
      return makeMockStmt();
    };
    const env = makeMockEnv(stmtFn);

    await recordApprovalEvent(env as any, "ai", "dom_123", "approved");

    const queries = env.DB.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
    const insertQuery = queries.find((q: string) => q.includes("INSERT INTO approval_stats"));
    expect(insertQuery).toBeDefined();
  });

  it("updates existing approval stats row", async () => {
    const { recordApprovalEvent } = await import("../src/services/analytics");
    const existingRow = {
      id: "as_existing",
      total_reviews: 10,
      approved: 7,
      rejected: 2,
      revision_requested: 1,
      pending: 0,
    };
    const stmtFn = (query: string) => {
      if (query.includes("SELECT") && query.includes("approval_stats")) {
        return makeMockStmt({ firstResult: existingRow });
      }
      return makeMockStmt();
    };
    const env = makeMockEnv(stmtFn);

    await recordApprovalEvent(env as any, "boss", null, "rejected");

    const queries = env.DB.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
    const updateQuery = queries.find((q: string) => q.includes("UPDATE approval_stats"));
    expect(updateQuery).toBeDefined();
  });
});

// ── recordCostEvent tests ────────────────────────────────────

describe("analytics/recordCostEvent", () => {
  it("inserts cost event and records analytics event", async () => {
    const { recordCostEvent } = await import("../src/services/analytics");
    const env = makeMockEnv();

    const id = await recordCostEvent(
      env as any,
      "gemini",
      "gemini-2.0-flash",
      "search",
      0.001,
      "run_123",
      { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    );

    expect(id).toBeDefined();
    expect(id.startsWith("ce_")).toBe(true);

    // Should insert into cost_events AND analytics_events
    const queries = env.DB.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
    const costInsert = queries.find((q: string) => q.includes("INSERT INTO cost_events"));
    const analyticsInsert = queries.find((q: string) => q.includes("INSERT INTO analytics_events"));
    expect(costInsert).toBeDefined();
    expect(analyticsInsert).toBeDefined();
  });
});

// ── Route handler tests ──────────────────────────────────────

describe("analytics/handlers/getDashboard", () => {
  it("returns 200 with dashboard stats", async () => {
    const { getDashboard } = await import("../src/api/routes/analytics/handlers");
    const env = makeMockEnv(makeMockStmt({
      allResults: [],
      firstResult: {
        total_runs: 10,
        successful_runs: 8,
        failed_runs: 2,
        avg_run_duration_ms: 5000,
        total_cost: 0.5,
        grand_total: 0.5,
        total_calls: 50,
      },
    }));
    const req = makeRequest("GET", "http://localhost/api/analytics/dashboard");
    const res = await getDashboard(req, env as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(body.data.overview).toBeDefined();
    expect(body.data.providerUsage).toBeDefined();
    expect(body.data.stepTiming).toBeDefined();
    expect(body.data.approvalStats).toBeDefined();
    expect(body.data.recentRouting).toBeDefined();
    expect(body.data.dailyTrend).toBeDefined();
  });

  it("accepts date range query params", async () => {
    const { getDashboard } = await import("../src/api/routes/analytics/handlers");
    const env = makeMockEnv(makeMockStmt({
      allResults: [],
      firstResult: {
        total_runs: 0,
        successful_runs: 0,
        failed_runs: 0,
        avg_run_duration_ms: 0,
        total_cost: 0,
        grand_total: 0,
        total_calls: 0,
      },
    }));
    const req = makeRequest("GET", "http://localhost/api/analytics/dashboard?start_date=2025-01-01&end_date=2025-01-31");
    const res = await getDashboard(req, env as any);
    expect(res.status).toBe(200);
  });
});

describe("analytics/handlers/getProviderUsage", () => {
  it("returns 200 with provider breakdown", async () => {
    const { getProviderUsage } = await import("../src/api/routes/analytics/handlers");
    const rows = [{
      provider_name: "gemini",
      model: "gemini-2.0-flash",
      task_lane: "search",
      total_calls: 100,
      successful: 95,
      failed: 5,
      rate_limited: 2,
      failovers: 3,
      avg_latency_ms: 1200,
      total_tokens: 50000,
      total_cost: 0.25,
    }];
    const env = makeMockEnv(makeMockStmt({ allResults: rows }));
    const req = makeRequest("GET", "http://localhost/api/analytics/providers");
    const res = await getProviderUsage(req, env as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toBeDefined();
  });
});

describe("analytics/handlers/getRoutingAudit", () => {
  it("returns 200 with routing audit trail", async () => {
    const { getRoutingAudit } = await import("../src/api/routes/analytics/handlers");
    const rows = [{
      id: "ral_1",
      run_id: "run_1",
      task_lane: "search",
      chain_json: "[]",
      selected_provider: "gemini",
      selected_model: "gemini-2.0-flash",
      total_attempts: 3,
      skipped_free: 1,
      skipped_paid: 0,
      failover_count: 1,
      final_outcome: "success",
      total_latency_ms: 2500,
      created_at: "2025-01-01T00:00:00Z",
    }];
    const env = makeMockEnv(makeMockStmt({ allResults: rows }));
    const req = makeRequest("GET", "http://localhost/api/analytics/routing");
    const res = await getRoutingAudit(req, env as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toBeDefined();
  });

  it("filters by run_id when provided", async () => {
    const { getRoutingAudit } = await import("../src/api/routes/analytics/handlers");
    const env = makeMockEnv(makeMockStmt({ allResults: [] }));
    const req = makeRequest("GET", "http://localhost/api/analytics/routing?run_id=run_123");
    const res = await getRoutingAudit(req, env as any);
    expect(res.status).toBe(200);

    // Should query with run_id filter
    const queries = env.DB.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
    const filteredQuery = queries.find((q: string) => q.includes("run_id"));
    expect(filteredQuery).toBeDefined();
  });
});

describe("analytics/handlers/getRunAnalytics", () => {
  it("returns 404 when run not found", async () => {
    const { getRunAnalytics } = await import("../src/api/routes/analytics/handlers");
    const env = makeMockEnv(makeMockStmt({ firstResult: null, allResults: [] }));
    const res = await getRunAnalytics(env as any, "nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns full run analytics when run exists", async () => {
    const { getRunAnalytics } = await import("../src/api/routes/analytics/handlers");
    const runRow = {
      id: "run_123",
      product_id: "prod_1",
      status: "completed",
      started_at: "2025-01-01T00:00:00Z",
      finished_at: "2025-01-01T00:05:00Z",
    };
    let callCount = 0;
    const stmtFn = (query: string) => {
      if (query.includes("FROM workflow_runs WHERE id")) {
        return makeMockStmt({ firstResult: runRow });
      }
      if (query.includes("FROM routing_audit_log")) {
        return makeMockStmt({ allResults: [] });
      }
      if (query.includes("FROM analytics_events")) {
        return makeMockStmt({ allResults: [] });
      }
      if (query.includes("FROM workflow_steps")) {
        return makeMockStmt({
          allResults: [
            { id: "step_1", step_name: "research", role_type: "researcher", status: "completed", retries: 0 },
            { id: "step_2", step_name: "create", role_type: "creator", status: "completed", retries: 1 },
          ],
        });
      }
      if (query.includes("FROM cost_events")) {
        return makeMockStmt({
          allResults: [
            { id: "ce_1", provider: "gemini", usage_amount: 0.001 },
          ],
        });
      }
      return makeMockStmt();
    };
    const env = makeMockEnv(stmtFn);
    const res = await getRunAnalytics(env as any, "run_123");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(body.data.run).toBeDefined();
    expect(body.data.steps).toBeDefined();
    expect(body.data.providerPath).toBeDefined();
    expect(body.data.summary).toBeDefined();
  });
});

describe("analytics/handlers/getApprovalAnalytics", () => {
  it("returns 200 with approval stats", async () => {
    const { getApprovalAnalytics } = await import("../src/api/routes/analytics/handlers");
    const env = makeMockEnv(makeMockStmt({
      allResults: [
        { reviewer_type: "ai", total: 20, approved: 15, rejected: 3, revision_requested: 2, pending: 0 },
        { reviewer_type: "boss", total: 15, approved: 12, rejected: 1, revision_requested: 2, pending: 0 },
      ],
    }));
    const req = makeRequest("GET", "http://localhost/api/analytics/approvals");
    const res = await getApprovalAnalytics(req, env as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(body.data.aggregated).toBeDefined();
    expect(body.data.live).toBeDefined();
  });
});

describe("analytics/handlers/getCostAnalytics", () => {
  it("returns 200 with cost breakdown", async () => {
    const { getCostAnalytics } = await import("../src/api/routes/analytics/handlers");
    const env = makeMockEnv(makeMockStmt({
      allResults: [
        { provider: "gemini", total_calls: 50, total_cost: 0.1, avg_cost: 0.002 },
      ],
      firstResult: { grand_total: 0.1, total_calls: 50 },
    }));
    const req = makeRequest("GET", "http://localhost/api/analytics/costs");
    const res = await getCostAnalytics(req, env as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toBeDefined();
    expect(body.data.breakdown).toBeDefined();
    expect(body.data.grandTotal).toBeDefined();
  });

  it("supports group_by=model", async () => {
    const { getCostAnalytics } = await import("../src/api/routes/analytics/handlers");
    const env = makeMockEnv(makeMockStmt({
      allResults: [],
      firstResult: { grand_total: 0, total_calls: 0 },
    }));
    const req = makeRequest("GET", "http://localhost/api/analytics/costs?group_by=model");
    const res = await getCostAnalytics(req, env as any);
    expect(res.status).toBe(200);

    // Should include model in the query
    const queries = env.DB.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
    const modelQuery = queries.find((q: string) => q.includes("model") && q.includes("GROUP BY"));
    expect(modelQuery).toBeDefined();
  });

  it("supports group_by=day", async () => {
    const { getCostAnalytics } = await import("../src/api/routes/analytics/handlers");
    const env = makeMockEnv(makeMockStmt({
      allResults: [],
      firstResult: { grand_total: 0, total_calls: 0 },
    }));
    const req = makeRequest("GET", "http://localhost/api/analytics/costs?group_by=day");
    const res = await getCostAnalytics(req, env as any);
    expect(res.status).toBe(200);

    // Should group by date
    const queries = env.DB.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
    const dayQuery = queries.find((q: string) => q.includes("date(created_at)"));
    expect(dayQuery).toBeDefined();
  });
});

describe("analytics/handlers/createAnalyticsEvent", () => {
  it("returns 400 for missing required fields", async () => {
    const { createAnalyticsEvent } = await import("../src/api/routes/analytics/handlers");
    const env = makeMockEnv();
    const req = makeRequest("POST", "http://localhost/api/analytics/events", {});
    const res = await createAnalyticsEvent(req, env as any);
    expect(res.status).toBe(400);
  });

  it("returns 201 for valid event", async () => {
    const { createAnalyticsEvent } = await import("../src/api/routes/analytics/handlers");
    const env = makeMockEnv();
    const req = makeRequest("POST", "http://localhost/api/analytics/events", {
      event_type: "provider_call",
      outcome: "success",
      provider_name: "gemini",
    });
    const res = await createAnalyticsEvent(req, env as any);
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.data.id).toBeDefined();
    expect(body.message).toBe("Event recorded.");
  });
});

describe("analytics/handlers/listAnalyticsEvents", () => {
  it("returns 200 with events list", async () => {
    const { listAnalyticsEvents } = await import("../src/api/routes/analytics/handlers");
    const rows = [
      { id: "ae_1", event_type: "provider_call", outcome: "success", created_at: "2025-01-01T00:00:00Z" },
      { id: "ae_2", event_type: "provider_failover", outcome: "error", created_at: "2025-01-01T00:01:00Z" },
    ];
    const env = makeMockEnv(makeMockStmt({ allResults: rows }));
    const req = makeRequest("GET", "http://localhost/api/analytics/events");
    const res = await listAnalyticsEvents(req, env as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(2);
  });

  it("filters by event_type", async () => {
    const { listAnalyticsEvents } = await import("../src/api/routes/analytics/handlers");
    const env = makeMockEnv(makeMockStmt({ allResults: [] }));
    const req = makeRequest("GET", "http://localhost/api/analytics/events?event_type=provider_call");
    await listAnalyticsEvents(req, env as any);

    const queries = env.DB.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
    const filteredQuery = queries.find((q: string) => q.includes("event_type = ?"));
    expect(filteredQuery).toBeDefined();
  });

  it("filters by run_id", async () => {
    const { listAnalyticsEvents } = await import("../src/api/routes/analytics/handlers");
    const env = makeMockEnv(makeMockStmt({ allResults: [] }));
    const req = makeRequest("GET", "http://localhost/api/analytics/events?run_id=run_123");
    await listAnalyticsEvents(req, env as any);

    const queries = env.DB.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
    const filteredQuery = queries.find((q: string) => q.includes("run_id = ?"));
    expect(filteredQuery).toBeDefined();
  });
});

describe("analytics/handlers/getDailyTrends", () => {
  it("returns 200 with trend data", async () => {
    const { getDailyTrends } = await import("../src/api/routes/analytics/handlers");
    const rows = [
      { date: "2025-01-01", total_events: 50, provider_calls: 30, failovers: 2, retries: 1, total_cost: 0.05, approvals: 5, rejections: 1 },
      { date: "2025-01-02", total_events: 45, provider_calls: 28, failovers: 1, retries: 0, total_cost: 0.04, approvals: 4, rejections: 0 },
    ];
    const env = makeMockEnv(makeMockStmt({ allResults: rows }));
    const req = makeRequest("GET", "http://localhost/api/analytics/trends");
    const res = await getDailyTrends(req, env as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
  });
});

describe("analytics/handlers/getStepTimingAnalytics", () => {
  it("returns 200 with step timing data", async () => {
    const { getStepTimingAnalytics } = await import("../src/api/routes/analytics/handlers");
    const rows = [
      { step_name: "research", role_type: "researcher", total_runs: 10, avg_duration_ms: 3000, min_duration_ms: 1500, max_duration_ms: 5000, total_retries: 2, success_count: 9, failure_count: 1 },
    ];
    const env = makeMockEnv(makeMockStmt({ allResults: rows }));
    const req = makeRequest("GET", "http://localhost/api/analytics/step-timing");
    const res = await getStepTimingAnalytics(req, env as any);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(1);
  });
});

// ── recordRoutingAttempts tests ──────────────────────────────

describe("analytics/recordRoutingAttempts", () => {
  it("records routing audit log with chain analysis", async () => {
    const { recordRoutingAttempts } = await import("../src/services/analytics");
    const env = makeMockEnv(makeMockStmt({ firstResult: null }));

    const attempts = [
      { providerId: "prov_1", providerName: "tavily", model: null, outcome: "skipped_no_key" as const },
      { providerId: "prov_2", providerName: "exa", model: null, outcome: "rate_limited" as const, error: "429" },
      { providerId: "prov_3", providerName: "gemini", model: "gemini-2.0-flash", outcome: "success" as const, latencyMs: 1500 },
    ];

    const auditId = await recordRoutingAttempts(env as any, {
      runId: "run_123",
      stepId: "step_1",
      productId: "prod_1",
      taskLane: "search",
      attempts,
      selectedProvider: "gemini",
      selectedModel: "gemini-2.0-flash",
      selectedTier: 0,
      finalOutcome: "success",
      totalLatencyMs: 1500,
    });

    expect(auditId).toBeDefined();
    expect(auditId.startsWith("ral_")).toBe(true);

    // Should have recorded individual events + routing audit
    const queries = env.DB.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
    const analyticsInserts = queries.filter((q: string) => q.includes("INSERT INTO analytics_events"));
    expect(analyticsInserts.length).toBeGreaterThanOrEqual(3); // One per attempt

    const routingInsert = queries.find((q: string) => q.includes("INSERT INTO routing_audit_log"));
    expect(routingInsert).toBeDefined();
  });
});

// ── getRunProviderPath tests ─────────────────────────────────

describe("analytics/getRunProviderPath", () => {
  it("returns routing audit rows for a run", async () => {
    const { getRunProviderPath } = await import("../src/services/analytics");
    const rows = [
      {
        id: "ral_1",
        run_id: "run_123",
        product_id: "prod_1",
        task_lane: "search",
        chain_json: "[]",
        selected_provider: "gemini",
        selected_model: "gemini-2.0-flash",
        selected_tier: 0,
        total_attempts: 2,
        skipped_free: 1,
        skipped_paid: 0,
        failover_count: 0,
        final_outcome: "success",
        total_latency_ms: 1200,
        created_at: "2025-01-01T00:00:00Z",
      },
    ];
    const env = makeMockEnv(makeMockStmt({ allResults: rows }));

    const result = await getRunProviderPath(env as any, "run_123");
    expect(result).toHaveLength(1);
    expect(result[0].taskLane).toBe("search");
    expect(result[0].selectedProvider).toBe("gemini");
    expect(result[0].finalOutcome).toBe("success");
  });

  it("returns empty array for unknown run", async () => {
    const { getRunProviderPath } = await import("../src/services/analytics");
    const env = makeMockEnv(makeMockStmt({ allResults: [] }));

    const result = await getRunProviderPath(env as any, "nonexistent");
    expect(result).toHaveLength(0);
  });
});
