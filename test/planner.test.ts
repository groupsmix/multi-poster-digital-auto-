import { describe, it, expect, vi } from "vitest";

/**
 * Planner AI service and API handler tests.
 *
 * Tests the planner service (response parsing, execution),
 * save function, and API route handlers.
 */

// ── Mock D1 helpers ──────────────────────────────────────

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

// ═════════════════════════════════════════════════════════
// ── Planner Service Tests ───────────────────────────────
// ═════════════════════════════════════════════════════════

describe("services/planner — execution", () => {
  it("parses clean JSON plan response", async () => {
    const validPlan = JSON.stringify({
      outline: [{ section: "Introduction", description: "Overview of the product", priority: "high" }],
      product_structure: {
        format: "ebook",
        components: ["Main guide", "Worksheet"],
        delivery_method: "digital download",
        estimated_effort: "2 weeks",
      },
      stage_plan: [{
        stage: "Research",
        tasks: ["Compile data"],
        dependencies: [],
        estimated_time: "3 days",
      }],
      offer_architecture: {
        core_offer: "Complete ebook guide",
        upsells: ["Premium templates"],
        bundles: ["Guide + Templates"],
        pricing_tiers: [{ name: "Basic", price_range: "$19-29", includes: ["Ebook"] }],
      },
    });

    const { executePlanner } = await import("../src/services/planner");

    const stmtFn = (query: string) => {
      if (query.includes("prompt_templates")) {
        return makeMockStmt({ firstResult: null });
      }
      if (query.includes("provider_configs")) {
        return makeMockStmt({
          allResults: [{
            id: "p1", name: "Gemini", provider: "gemini",
            model: "gemini-2.0-flash", task_lane: "planning",
            tier: 0, priority: 0, state: "active",
            has_api_key: 1, cooldown_until: null, is_active: 1,
          }],
        });
      }
      return makeMockStmt();
    };

    const env = makeMockEnv(stmtFn);
    (env as any).GEMINI_API_KEY = "test-key";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: validPlan }] } }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200, totalTokenCount: 300 },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executePlanner(env as any, {
        productIdea: "AI writing assistant ebook",
        domain: "digital-products",
        category: "ebooks",
      });

      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();
      expect(result.plan!.outline).toHaveLength(1);
      expect(result.plan!.outline[0].section).toBe("Introduction");
      expect(result.plan!.product_structure.format).toBe("ebook");
      expect(result.plan!.stage_plan).toHaveLength(1);
      expect(result.plan!.offer_architecture.core_offer).toBe("Complete ebook guide");
      expect(result.provider).toBe("gemini");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("parses JSON in markdown code fences", async () => {
    const fencedJson = '```json\n' + JSON.stringify({
      outline: [{ section: "Chapter 1", description: "Intro", priority: "high" }],
      product_structure: { format: "course", components: ["Video"], delivery_method: "online", estimated_effort: "1 month" },
      stage_plan: [],
      offer_architecture: { core_offer: "Online course", upsells: [], bundles: [], pricing_tiers: [] },
    }) + '\n```';

    const { executePlanner } = await import("../src/services/planner");

    const stmtFn = (query: string) => {
      if (query.includes("prompt_templates")) return makeMockStmt({ firstResult: null });
      if (query.includes("provider_configs")) {
        return makeMockStmt({
          allResults: [{
            id: "p1", name: "Gemini", provider: "gemini",
            model: "gemini-2.0-flash", task_lane: "planning",
            tier: 0, priority: 0, state: "active",
            has_api_key: 1, cooldown_until: null, is_active: 1,
          }],
        });
      }
      return makeMockStmt();
    };

    const env = makeMockEnv(stmtFn);
    (env as any).GEMINI_API_KEY = "test-key";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: fencedJson }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executePlanner(env as any, {
        productIdea: "Online course",
        domain: "education",
      });

      expect(result.success).toBe(true);
      expect(result.plan!.outline).toHaveLength(1);
      expect(result.plan!.product_structure.format).toBe("course");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns error when all providers exhausted", async () => {
    const { executePlanner } = await import("../src/services/planner");

    const stmtFn = (query: string) => {
      if (query.includes("prompt_templates")) return makeMockStmt({ firstResult: null });
      if (query.includes("provider_configs")) return makeMockStmt({ allResults: [] });
      return makeMockStmt();
    };

    const env = makeMockEnv(stmtFn);

    const result = await executePlanner(env as any, {
      productIdea: "Test idea",
      domain: "test",
    });

    expect(result.success).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.error).toContain("providers exhausted");
  });

  it("returns error when response is unparseable", async () => {
    const { executePlanner } = await import("../src/services/planner");

    const stmtFn = (query: string) => {
      if (query.includes("prompt_templates")) return makeMockStmt({ firstResult: null });
      if (query.includes("provider_configs")) {
        return makeMockStmt({
          allResults: [{
            id: "p1", name: "Gemini", provider: "gemini",
            model: "gemini-2.0-flash", task_lane: "planning",
            tier: 0, priority: 0, state: "active",
            has_api_key: 1, cooldown_until: null, is_active: 1,
          }],
        });
      }
      return makeMockStmt();
    };

    const env = makeMockEnv(stmtFn);
    (env as any).GEMINI_API_KEY = "test-key";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: "Not valid JSON at all." }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executePlanner(env as any, {
        productIdea: "Test idea",
        domain: "test",
      });

      expect(result.success).toBe(false);
      expect(result.plan).toBeNull();
      expect(result.rawContent).toBe("Not valid JSON at all.");
      expect(result.error).toContain("parse");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ═════════════════════════════════════════════════════════
// ── Planner Save Output Tests ───────────────────────────
// ═════════════════════════════════════════════════════════

describe("services/planner — savePlannerOutput", () => {
  it("saves plan result to D1", async () => {
    const { savePlannerOutput } = await import("../src/services/planner");
    const env = makeMockEnv();

    const result = await savePlannerOutput(env as any, "step_1", "run_1", "prod_1", {
      success: true,
      plan: {
        outline: [{ section: "Intro", description: "Overview", priority: "high" }],
        product_structure: { format: "ebook", components: [], delivery_method: "download", estimated_effort: "1 week" },
        stage_plan: [],
        offer_architecture: { core_offer: "Guide", upsells: [], bundles: [], pricing_tiers: [] },
      },
      rawContent: "{}",
      providerLog: [],
      provider: "gemini",
      model: "gemini-2.0-flash",
      templateId: null,
      templateVersion: null,
      error: null,
    });

    expect(result).toMatch(/^wso_/);
    // Verify DB was called with INSERT and UPDATE
    expect(env.DB.prepare).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════
// ── Planner API Handler Tests ───────────────────────────
// ═════════════════════════════════════════════════════════

describe("planner/handlers", () => {
  describe("runPlanner", () => {
    it("returns 404 when product not found", async () => {
      const { runPlanner } = await import("../src/api/routes/planner/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/products/nope/plan", {});
      const res = await runPlanner(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 when product domain not found", async () => {
      const { runPlanner } = await import("../src/api/routes/planner/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1", idea: "Test", domain_id: "dom_1", category_id: null, notes: null } });
        }
        if (query.includes("FROM domains WHERE id")) {
          return makeMockStmt({ firstResult: null });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/plan", {});
      const res = await runPlanner(req, env as any, "prod_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("domain not found");
    });
  });

  describe("getProductPlan", () => {
    it("returns 404 when product not found", async () => {
      const { getProductPlan } = await import("../src/api/routes/planner/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getProductPlan(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 404 when no plan output exists", async () => {
      const { getProductPlan } = await import("../src/api/routes/planner/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1" } });
        }
        if (query.includes("workflow_step_outputs")) {
          return makeMockStmt({ firstResult: null });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await getProductPlan(env as any, "prod_1");
      expect(res.status).toBe(404);
      const body = await res.json() as any;
      expect(body.error).toContain("No plan output");
    });

    it("returns plan output when found", async () => {
      const { getProductPlan } = await import("../src/api/routes/planner/handlers");
      const plan = {
        outline: [{ section: "Intro", description: "Overview", priority: "high" }],
        product_structure: { format: "ebook", components: [], delivery_method: "download", estimated_effort: "1 week" },
        stage_plan: [],
        offer_architecture: { core_offer: "Guide", upsells: [], bundles: [], pricing_tiers: [] },
      };
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1" } });
        }
        if (query.includes("workflow_step_outputs")) {
          return makeMockStmt({
            firstResult: {
              id: "wso_1",
              step_id: "step_1",
              run_id: "run_1",
              product_id: "prod_1",
              output_json: JSON.stringify(plan),
              provider_log_json: JSON.stringify([]),
              created_at: "2026-01-01T00:00:00Z",
            },
          });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await getProductPlan(env as any, "prod_1");
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.id).toBe("wso_1");
      expect(body.data.plan.outline).toHaveLength(1);
    });
  });
});
