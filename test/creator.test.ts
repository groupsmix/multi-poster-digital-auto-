import { describe, it, expect, vi } from "vitest";

/**
 * Creator AI workflow tests.
 *
 * Tests the creator service (response parsing) and API route handlers.
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
// ── Creator Service Tests ───────────────────────────────
// ═════════════════════════════════════════════════════════

describe("services/creator — response parsing", () => {
  it("parses clean JSON creator output", async () => {
    const validJson = JSON.stringify({
      title: "AI Writing Assistant Pro",
      description: "A powerful AI-powered writing tool.",
      content_body: "Full product specification here.",
      image_prompts: [{ prompt: "Modern UI screenshot", style: "photorealistic", aspect_ratio: "16:9" }],
      tags: ["ai", "writing", "productivity"],
    });

    const { executeCreator } = await import("../src/services/creator");

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
      const result = await executeCreator(env as any, {
        productIdea: "AI writing assistant",
        domain: "software",
        category: "productivity",
      });

      expect(result.success).toBe(true);
      expect(result.creation).toBeDefined();
      expect(result.creation!.title).toBe("AI Writing Assistant Pro");
      expect(result.creation!.description).toContain("AI-powered");
      expect(result.creation!.image_prompts).toHaveLength(1);
      expect(result.creation!.tags).toContain("ai");
      expect(result.provider).toBe("gemini");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles JSON in markdown code fences", async () => {
    const fencedJson = '```json\n' + JSON.stringify({
      title: "Test Product",
      description: "Test description",
      content_body: "Body content",
      image_prompts: [],
      tags: ["test"],
    }) + '\n```';

    const { executeCreator } = await import("../src/services/creator");

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
        candidates: [{ content: { parts: [{ text: fencedJson }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executeCreator(env as any, {
        productIdea: "Test product",
        domain: "test",
      });

      expect(result.success).toBe(true);
      expect(result.creation!.title).toBe("Test Product");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns error when all providers exhausted", async () => {
    const { executeCreator } = await import("../src/services/creator");

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

    const result = await executeCreator(env as any, {
      productIdea: "Test idea",
      domain: "test",
    });

    expect(result.success).toBe(false);
    expect(result.creation).toBeNull();
    expect(result.error).toContain("providers exhausted");
  });

  it("includes prior workflow context in user prompt", async () => {
    const { executeCreator } = await import("../src/services/creator");

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

    let capturedBody: any = null;
    const mockFetch = vi.fn().mockImplementation((_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify({
            title: "T", description: "D", content_body: "B", image_prompts: [], tags: [],
          }) }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
        }),
      });
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      await executeCreator(env as any, {
        productIdea: "AI tool",
        domain: "software",
        researchContext: { trends: [{ trend: "AI growth" }] },
      });

      // The user prompt should contain the research context
      // Gemini format: contents[0] is system prompt, contents[1] is user prompt
      // Or system_instruction is separate. Check all content parts.
      const allText = JSON.stringify(capturedBody);
      expect(allText).toContain("RESEARCH CONTEXT");
      expect(allText).toContain("AI growth");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ═════════════════════════════════════════════════════════
// ── Creator API Handlers Tests ──────────────────────────
// ═════════════════════════════════════════════════════════

describe("creator/handlers", () => {
  describe("runCreator", () => {
    it("returns 404 when product not found", async () => {
      const { runCreator } = await import("../src/api/routes/creator/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/products/nope/create", {});
      const res = await runCreator(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 when product domain not found", async () => {
      const { runCreator } = await import("../src/api/routes/creator/handlers");
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
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/create", {});
      const res = await runCreator(req, env as any, "prod_1");
      expect(res.status).toBe(400);
    });
  });

  describe("getProductCreation", () => {
    it("returns 404 when product not found", async () => {
      const { getProductCreation } = await import("../src/api/routes/creator/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getProductCreation(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 404 when no creation output exists", async () => {
      const { getProductCreation } = await import("../src/api/routes/creator/handlers");
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
      const res = await getProductCreation(env as any, "prod_1");
      expect(res.status).toBe(404);
    });

    it("returns creation output when found", async () => {
      const { getProductCreation } = await import("../src/api/routes/creator/handlers");
      const creation = { title: "Test", description: "Desc", content_body: "Body", image_prompts: [], tags: [] };
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1" } });
        }
        if (query.includes("workflow_step_outputs")) {
          return makeMockStmt({
            firstResult: {
              id: "wso_1", step_id: "step_1", run_id: "run_1", product_id: "prod_1",
              output_json: JSON.stringify(creation), provider_log_json: JSON.stringify([]),
              created_at: "2026-01-01T00:00:00Z",
            },
          });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await getProductCreation(env as any, "prod_1");
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.creation.title).toBe("Test");
    });
  });

  describe("getCreationOutput", () => {
    it("returns 404 when output not found", async () => {
      const { getCreationOutput } = await import("../src/api/routes/creator/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getCreationOutput(env as any, "nope");
      expect(res.status).toBe(404);
    });
  });
});
