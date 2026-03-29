import { describe, it, expect, vi } from "vitest";

/**
 * Marketing AI workflow tests.
 *
 * Tests the marketing service (response parsing) and API route handlers.
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
// ── Marketing Service Tests ─────────────────────────────
// ═════════════════════════════════════════════════════════

describe("services/marketing — response parsing", () => {
  it("parses complete marketing output", async () => {
    const validJson = JSON.stringify({
      price_suggestion: {
        recommended_price: "$29.99",
        price_tier: "mid_range",
        pricing_model: "one-time",
        justification: "Based on competitor analysis",
      },
      seo: {
        seo_title_variations: ["Best AI Writing Tool 2026"],
        meta_description: "The most powerful AI writing assistant.",
        primary_keywords: ["ai writing"],
        secondary_keywords: ["content generator"],
        long_tail_keywords: ["best ai writing tool for bloggers"],
      },
      descriptions: {
        short_description: "AI-powered writing made easy.",
        medium_description: "A comprehensive AI writing assistant.",
        long_description: "Full marketing copy here.",
        bullet_benefits: ["Save time", "Better quality"],
      },
      copy: {
        headline_variations: ["Write Better, Faster"],
        subheadline_options: ["AI that understands you"],
        hook_sentences: ["What if writing was effortless?"],
        objection_handlers: ["No learning curve"],
        social_proof_suggestions: ["Used by 10k+ writers"],
        urgency_angles: ["Limited launch pricing"],
      },
      cta_options: {
        primary_cta: "Start Writing Free",
        secondary_cta: "See Examples",
        variations: ["Try It Now", "Get Started"],
      },
      positioning: {
        usp: "AI writing that sounds like you",
        differentiators: ["Personal voice matching"],
        target_audience_message: "For professional writers",
        brand_voice_notes: "Confident, helpful",
      },
    });

    const { executeMarketing } = await import("../src/services/marketing");

    const stmtFn = (query: string) => {
      if (query.includes("prompt_templates")) {
        return makeMockStmt({ firstResult: null });
      }
      if (query.includes("provider_configs")) {
        return makeMockStmt({
          allResults: [{
            id: "p1", name: "Gemini", provider: "gemini",
            model: "gemini-2.0-flash", task_lane: "build",
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
        candidates: [{ content: { parts: [{ text: validJson }] } }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200, totalTokenCount: 300 },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executeMarketing(env as any, {
        productIdea: "AI writing assistant",
        domain: "software",
      });

      expect(result.success).toBe(true);
      expect(result.marketing).toBeDefined();
      expect(result.marketing!.price_suggestion.recommended_price).toBe("$29.99");
      expect(result.marketing!.price_suggestion.price_tier).toBe("mid_range");
      expect(result.marketing!.seo.primary_keywords).toContain("ai writing");
      expect(result.marketing!.descriptions.bullet_benefits).toHaveLength(2);
      expect(result.marketing!.copy.headline_variations).toHaveLength(1);
      expect(result.marketing!.cta_options.primary_cta).toBe("Start Writing Free");
      expect(result.marketing!.positioning.usp).toContain("AI writing");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns error when all providers exhausted", async () => {
    const { executeMarketing } = await import("../src/services/marketing");

    const stmtFn = (query: string) => {
      if (query.includes("prompt_templates")) {
        return makeMockStmt({ firstResult: null });
      }
      if (query.includes("provider_configs")) {
        return makeMockStmt({ allResults: [] });
      }
      return makeMockStmt();
    };

    const env = makeMockEnv(stmtFn);

    const result = await executeMarketing(env as any, {
      productIdea: "Test",
      domain: "test",
    });

    expect(result.success).toBe(false);
    expect(result.marketing).toBeNull();
    expect(result.error).toContain("providers exhausted");
  });

  it("returns error on unparseable content", async () => {
    const { executeMarketing } = await import("../src/services/marketing");

    const stmtFn = (query: string) => {
      if (query.includes("prompt_templates")) {
        return makeMockStmt({ firstResult: null });
      }
      if (query.includes("provider_configs")) {
        return makeMockStmt({
          allResults: [{
            id: "p1", name: "Gemini", provider: "gemini",
            model: "gemini-2.0-flash", task_lane: "build",
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
        candidates: [{ content: { parts: [{ text: "Not valid JSON" }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executeMarketing(env as any, {
        productIdea: "Test",
        domain: "test",
      });

      expect(result.success).toBe(false);
      expect(result.marketing).toBeNull();
      expect(result.error).toContain("parse");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ═════════════════════════════════════════════════════════
// ── Marketing API Handlers Tests ────────────────────────
// ═════════════════════════════════════════════════════════

describe("marketing/handlers", () => {
  describe("runMarketing", () => {
    it("returns 404 when product not found", async () => {
      const { runMarketing } = await import("../src/api/routes/marketing/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/products/nope/marketing", {});
      const res = await runMarketing(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 when product domain not found", async () => {
      const { runMarketing } = await import("../src/api/routes/marketing/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1", idea: "Test", domain_id: "dom_1", category_id: null } });
        }
        if (query.includes("FROM domains WHERE id")) {
          return makeMockStmt({ firstResult: null });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/marketing", {});
      const res = await runMarketing(req, env as any, "prod_1");
      expect(res.status).toBe(400);
    });
  });

  describe("getProductMarketing", () => {
    it("returns 404 when product not found", async () => {
      const { getProductMarketing } = await import("../src/api/routes/marketing/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getProductMarketing(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns marketing output when found", async () => {
      const { getProductMarketing } = await import("../src/api/routes/marketing/handlers");
      const marketing = {
        price_suggestion: { recommended_price: "$19.99" },
        seo: { primary_keywords: ["test"] },
        descriptions: { short_description: "Short" },
        copy: { headline_variations: ["H1"] },
        cta_options: { primary_cta: "Buy" },
        positioning: { usp: "Unique" },
      };
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1" } });
        }
        if (query.includes("workflow_step_outputs")) {
          return makeMockStmt({
            firstResult: {
              id: "wso_1", step_id: "step_1", run_id: "run_1", product_id: "prod_1",
              output_json: JSON.stringify(marketing), provider_log_json: JSON.stringify([]),
              created_at: "2026-01-01T00:00:00Z",
            },
          });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await getProductMarketing(env as any, "prod_1");
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.marketing.price_suggestion.recommended_price).toBe("$19.99");
    });
  });

  describe("getMarketingOutput", () => {
    it("returns 404 when output not found", async () => {
      const { getMarketingOutput } = await import("../src/api/routes/marketing/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getMarketingOutput(env as any, "nope");
      expect(res.status).toBe(404);
    });
  });
});
