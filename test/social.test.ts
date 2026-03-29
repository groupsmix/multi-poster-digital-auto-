import { describe, it, expect, vi } from "vitest";

/**
 * Social AI workflow tests.
 *
 * Tests the social service (response parsing, batch execution)
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
// ── Social Service Tests ────────────────────────────────
// ═════════════════════════════════════════════════════════

describe("services/social — batch execution", () => {
  it("returns error for inactive/missing social channel", async () => {
    const { executeSocial } = await import("../src/services/social");

    const stmtFn = (query: string) => {
      if (query.includes("social_channels WHERE")) {
        return makeMockStmt({ firstResult: null }); // Channel not found
      }
      return makeMockStmt({ firstResult: null });
    };

    const env = makeMockEnv(stmtFn);

    const result = await executeSocial(env as any, {
      productIdea: "Test product",
      domain: "software",
      socialChannelIds: ["sc_missing"],
      version: 1,
    });

    expect(result.total).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toContain("not found");
  });

  it("creates one variant per social channel", async () => {
    const socialJson = JSON.stringify({
      post_content: "Check out this amazing AI tool!",
      hook: "What if writing was 10x faster?",
      cta: "Link in bio",
      hashtags: ["#AIwriting", "#productivity"],
      visual_suggestions: ["Product demo screenshot"],
      engagement_prompt: "What's your biggest writing challenge?",
      content_json: { format_type: "post", tone: "casual" },
    });

    const { executeSocial } = await import("../src/services/social");

    const stmtFn = (query: string) => {
      if (query.includes("social_channels WHERE")) {
        return makeMockStmt({
          firstResult: {
            id: "sc_1", name: "Instagram",
            caption_rules: "Max 2200 chars", hashtag_rules: "Max 30 hashtags",
            length_rules: null, audience_style: "Visual-first", tone_profile: "Casual",
            is_active: 1,
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
        candidates: [{ content: { parts: [{ text: socialJson }] } }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200, totalTokenCount: 300 },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executeSocial(env as any, {
        productIdea: "AI writing tool",
        domain: "software",
        socialChannelIds: ["sc_1"],
        version: 1,
      });

      expect(result.total).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].variant!.social_channel_name).toBe("Instagram");
      expect(result.results[0].variant!.hook).toContain("writing");
      expect(result.results[0].variant!.hashtags).toHaveLength(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles multiple channels independently", async () => {
    const { executeSocial } = await import("../src/services/social");

    let callCount = 0;
    const stmtFn = (query: string) => {
      if (query.includes("social_channels WHERE")) {
        callCount++;
        if (callCount <= 1) {
          return makeMockStmt({
            firstResult: {
              id: "sc_1", name: "Instagram",
              caption_rules: null, hashtag_rules: null, length_rules: null,
              audience_style: null, tone_profile: null, is_active: 1,
            },
          });
        }
        return makeMockStmt({ firstResult: null }); // Second channel missing
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
          post_content: "Test", hook: "Hook", cta: "CTA",
          hashtags: [], visual_suggestions: [], engagement_prompt: "",
          content_json: {},
        }) }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executeSocial(env as any, {
        productIdea: "Test",
        domain: "test",
        socialChannelIds: ["sc_1", "sc_missing"],
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
// ── Social API Handlers Tests ───────────────────────────
// ═════════════════════════════════════════════════════════

describe("social/handlers", () => {
  describe("runSocial", () => {
    it("returns 404 when product not found", async () => {
      const { runSocial } = await import("../src/api/routes/social/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/products/nope/social", { social_channel_ids: ["sc1"] });
      const res = await runSocial(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 when social_channel_ids missing", async () => {
      const { runSocial } = await import("../src/api/routes/social/handlers");
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
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/social", {});
      const res = await runSocial(req, env as any, "prod_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("social_channel_ids");
    });
  });

  describe("getProductSocialVariants", () => {
    it("returns 404 when product not found", async () => {
      const { getProductSocialVariants } = await import("../src/api/routes/social/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getProductSocialVariants(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns empty array when no social variants exist", async () => {
      const { getProductSocialVariants } = await import("../src/api/routes/social/handlers");
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
      const res = await getProductSocialVariants(env as any, "prod_1");
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data).toHaveLength(0);
      expect(body.total).toBe(0);
    });
  });

  describe("getSocialVariantById", () => {
    it("returns 404 when social variant not found", async () => {
      const { getSocialVariantById } = await import("../src/api/routes/social/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getSocialVariantById(env as any, "nope");
      expect(res.status).toBe(404);
    });
  });
});
