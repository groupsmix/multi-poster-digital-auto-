import { describe, it, expect, vi } from "vitest";

/**
 * Platform Adapter AI workflow tests.
 *
 * Tests the platform adapter service (response parsing, batch execution)
 * and API route handlers.
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
// ── Platform Adapter Service Tests ──────────────────────
// ═════════════════════════════════════════════════════════

describe("services/platform-adapter — batch execution", () => {
  it("returns error for inactive/missing platform", async () => {
    const { executePlatformAdapter } = await import("../src/services/platform-adapter");

    const stmtFn = (query: string) => {
      if (query.includes("FROM platforms WHERE")) {
        return makeMockStmt({ firstResult: null }); // Platform not found
      }
      return makeMockStmt({ firstResult: null });
    };

    const env = makeMockEnv(stmtFn);

    const result = await executePlatformAdapter(env as any, {
      productIdea: "Test product",
      domain: "software",
      platformIds: ["plat_missing"],
      version: 1,
    });

    expect(result.total).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toContain("not found");
  });

  it("creates one variant per platform", async () => {
    const variantJson = JSON.stringify({
      title: "Adapted Title",
      description: "Adapted description",
      tags: ["adapted"],
      seo: { seo_title: "SEO Title", meta_description: "Meta desc", keywords: ["k1"] },
      cta: "Buy Now",
      content_json: { format: "listing" },
    });

    const { executePlatformAdapter } = await import("../src/services/platform-adapter");

    const stmtFn = (query: string) => {
      if (query.includes("FROM platforms WHERE")) {
        return makeMockStmt({
          firstResult: {
            id: "plat_1", name: "Gumroad", slug: "gumroad",
            title_rules: null, description_rules: null, tag_rules: null,
            seo_rules: null, cta_rules: null, content_rules: null, is_active: 1,
          },
        });
      }
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
        candidates: [{ content: { parts: [{ text: variantJson }] } }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200, totalTokenCount: 300 },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executePlatformAdapter(env as any, {
        productIdea: "AI writing tool",
        domain: "software",
        platformIds: ["plat_1"],
        version: 1,
      });

      expect(result.total).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].variant!.platform_name).toBe("Gumroad");
      expect(result.results[0].variant!.title).toBe("Adapted Title");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles multiple platforms independently", async () => {
    const { executePlatformAdapter } = await import("../src/services/platform-adapter");

    let callCount = 0;
    const stmtFn = (query: string) => {
      if (query.includes("FROM platforms WHERE")) {
        callCount++;
        if (callCount <= 1) {
          return makeMockStmt({
            firstResult: {
              id: "plat_1", name: "Gumroad", slug: "gumroad",
              title_rules: null, description_rules: null, tag_rules: null,
              seo_rules: null, cta_rules: null, content_rules: null, is_active: 1,
            },
          });
        }
        return makeMockStmt({ firstResult: null }); // Second platform missing
      }
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
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          title: "T", description: "D", tags: [], seo: {}, cta: "", content_json: {},
        }) }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executePlatformAdapter(env as any, {
        productIdea: "Test",
        domain: "test",
        platformIds: ["plat_1", "plat_missing"],
        version: 1,
      });

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ═════════════════════════════════════════════════════════
// ── Platform Adapter API Handlers Tests ─────────────────
// ═════════════════════════════════════════════════════════

describe("platform-adapter/handlers", () => {
  describe("runPlatformAdapter", () => {
    it("returns 404 when product not found", async () => {
      const { runPlatformAdapter } = await import("../src/api/routes/platform-adapter/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/products/nope/adapt", { platform_ids: ["p1"] });
      const res = await runPlatformAdapter(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 when platform_ids missing", async () => {
      const { runPlatformAdapter } = await import("../src/api/routes/platform-adapter/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1", idea: "Test", domain_id: "dom_1", category_id: null } });
        }
        if (query.includes("FROM domains WHERE id")) {
          return makeMockStmt({ firstResult: { id: "dom_1", name: "software" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/adapt", {});
      const res = await runPlatformAdapter(req, env as any, "prod_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("platform_ids");
    });
  });

  describe("getProductVariants", () => {
    it("returns 404 when product not found", async () => {
      const { getProductVariants } = await import("../src/api/routes/platform-adapter/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getProductVariants(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns empty array when no variants exist", async () => {
      const { getProductVariants } = await import("../src/api/routes/platform-adapter/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1" } });
        }
        if (query.includes("product_variants")) {
          return makeMockStmt({ allResults: [] });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await getProductVariants(env as any, "prod_1");
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data).toHaveLength(0);
      expect(body.total).toBe(0);
    });
  });

  describe("getVariantById", () => {
    it("returns 404 when variant not found", async () => {
      const { getVariantById } = await import("../src/api/routes/platform-adapter/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getVariantById(env as any, "nope");
      expect(res.status).toBe(404);
    });
  });
});
