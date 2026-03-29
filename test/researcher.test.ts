import { describe, it, expect, vi } from "vitest";

/**
 * Researcher AI workflow tests.
 *
 * Tests the prompt composer, researcher service (response parsing),
 * and researcher API route handlers.
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
// ── Prompt Composer Tests ───────────────────────────────
// ═════════════════════════════════════════════════════════

describe("services/prompt-composer", () => {
  it("composes a prompt with default fallback when no DB template exists", async () => {
    const { composePrompt } = await import("../src/services/prompt-composer");
    const env = makeMockEnv(makeMockStmt({ firstResult: null }));
    const result = await composePrompt(env as any, {
      role: "researcher",
      domainRef: "digital-products",
    });
    expect(result.systemPrompt).toBeDefined();
    expect(result.systemPrompt.length).toBeGreaterThan(0);
    // Falls back to defaults
    expect(result.templateId).toBeNull();
    expect(result.templateVersion).toBeNull();
    expect(result.systemPrompt).toContain("NEXUS");
    expect(result.systemPrompt).toContain("Quality rules");
  });

  it("uses template from DB when active template exists", async () => {
    const { composePrompt } = await import("../src/services/prompt-composer");
    const template = {
      id: "pt_test1",
      name: "researcher_v1",
      role_type: "researcher",
      version: 2,
      scope_type: null,
      scope_ref: null,
      system_prompt: "Custom system prompt for NEXUS researcher.",
      domain_prompt: "Focus on digital product trends.",
      platform_prompt: null,
      social_prompt: null,
      category_prompt: "Category-specific guidance here.",
      quality_rules: "Custom quality rules.",
      output_schema: '{"type":"object"}',
      revision_prompt: null,
      is_active: 1,
    };
    const stmtFn = (query: string) => {
      if (query.includes("prompt_templates") && query.includes("role_type")) {
        return makeMockStmt({ firstResult: template });
      }
      return makeMockStmt({ firstResult: null });
    };
    const env = makeMockEnv(stmtFn);
    const result = await composePrompt(env as any, {
      role: "researcher",
      domainRef: "digital-products",
      categoryRef: "ebooks",
    });
    expect(result.systemPrompt).toContain("Custom system prompt for NEXUS researcher.");
    expect(result.systemPrompt).toContain("Focus on digital product trends.");
    expect(result.systemPrompt).toContain("Custom quality rules.");
    expect(result.systemPrompt).toContain("Category-specific guidance here.");
    expect(result.templateId).toBe("pt_test1");
    expect(result.templateVersion).toBe(2);
    expect(result.outputSchema).toBe('{"type":"object"}');
  });

  it("includes revision notes when isRevision is true", async () => {
    const { composePrompt } = await import("../src/services/prompt-composer");
    const env = makeMockEnv(makeMockStmt({ firstResult: null }));
    const result = await composePrompt(env as any, {
      role: "researcher",
      isRevision: true,
      revisionNotes: "Add more competitor analysis.",
    });
    expect(result.systemPrompt).toContain("revision");
    expect(result.systemPrompt).toContain("Add more competitor analysis.");
  });

  it("does not include revision layer when isRevision is false", async () => {
    const { composePrompt } = await import("../src/services/prompt-composer");
    const env = makeMockEnv(makeMockStmt({ firstResult: null }));
    const result = await composePrompt(env as any, {
      role: "researcher",
      isRevision: false,
    });
    expect(result.systemPrompt).not.toContain("revision");
  });
});

// ═════════════════════════════════════════════════════════
// ── Researcher Service Tests ────────────────────────────
// ═════════════════════════════════════════════════════════

describe("services/researcher — response parsing", () => {
  it("parseResearchResponse handles clean JSON", async () => {
    // We test via executeResearch with a mocked provider chain
    // that returns structured JSON. Instead we import the module
    // and test the parse logic via the full flow.
    const validJson = JSON.stringify({
      trends: [{ trend: "AI tools growing", relevance: "high" }],
      competitors: [{ name: "CompetitorX", strengths: ["fast"], weaknesses: ["expensive"] }],
      pricing_signals: [{ tier: "mid_range", range: "$20-50", model: "subscription" }],
      keywords: [{ keyword: "ai tools", type: "primary" }],
      audience_notes: [{ insight: "Tech-savvy millennials", category: "demographics" }],
    });

    // Test the full executeResearch with mocked fetch
    const { executeResearch } = await import("../src/services/researcher");

    // Mock provider chain: one active provider
    const stmtFn = (query: string) => {
      if (query.includes("prompt_templates")) {
        return makeMockStmt({ firstResult: null });
      }
      if (query.includes("provider_configs")) {
        return makeMockStmt({
          allResults: [{
            id: "p1",
            name: "Gemini",
            provider: "gemini",
            model: "gemini-2.0-flash",
            task_lane: "search",
            tier: 0,
            priority: 0,
            state: "active",
            has_api_key: 1,
            cooldown_until: null,
            is_active: 1,
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
      const result = await executeResearch(env as any, {
        productIdea: "AI-powered writing assistant",
        domain: "software",
        category: "productivity",
      });

      expect(result.success).toBe(true);
      expect(result.research).toBeDefined();
      expect(result.research!.trends).toHaveLength(1);
      expect(result.research!.trends[0].trend).toBe("AI tools growing");
      expect(result.research!.competitors).toHaveLength(1);
      expect(result.research!.pricing_signals).toHaveLength(1);
      expect(result.research!.keywords).toHaveLength(1);
      expect(result.research!.audience_notes).toHaveLength(1);
      expect(result.provider).toBe("gemini");
      expect(result.providerLog).toHaveLength(1);
      expect(result.providerLog[0].outcome).toBe("success");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("parseResearchResponse handles JSON in markdown code fences", async () => {
    const fencedJson = '```json\n' + JSON.stringify({
      trends: [{ trend: "Remote work tools", relevance: "medium" }],
      competitors: [],
      pricing_signals: [],
      keywords: [],
      audience_notes: [],
    }) + '\n```';

    const { executeResearch } = await import("../src/services/researcher");

    const stmtFn = (query: string) => {
      if (query.includes("prompt_templates")) {
        return makeMockStmt({ firstResult: null });
      }
      if (query.includes("provider_configs")) {
        return makeMockStmt({
          allResults: [{
            id: "p1", name: "Gemini", provider: "gemini",
            model: "gemini-2.0-flash", task_lane: "search",
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
      const result = await executeResearch(env as any, {
        productIdea: "Remote team dashboard",
        domain: "saas",
      });

      expect(result.success).toBe(true);
      expect(result.research!.trends).toHaveLength(1);
      expect(result.research!.trends[0].trend).toBe("Remote work tools");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns error when all providers exhausted", async () => {
    const { executeResearch } = await import("../src/services/researcher");

    const stmtFn = (query: string) => {
      if (query.includes("prompt_templates")) {
        return makeMockStmt({ firstResult: null });
      }
      if (query.includes("provider_configs")) {
        return makeMockStmt({ allResults: [] }); // No providers
      }
      return makeMockStmt();
    };

    const env = makeMockEnv(stmtFn);

    const result = await executeResearch(env as any, {
      productIdea: "Test idea",
      domain: "test",
    });

    expect(result.success).toBe(false);
    expect(result.research).toBeNull();
    expect(result.error).toContain("providers exhausted");
  });

  it("returns error when provider returns unparseable content", async () => {
    const { executeResearch } = await import("../src/services/researcher");

    const stmtFn = (query: string) => {
      if (query.includes("prompt_templates")) {
        return makeMockStmt({ firstResult: null });
      }
      if (query.includes("provider_configs")) {
        return makeMockStmt({
          allResults: [{
            id: "p1", name: "Gemini", provider: "gemini",
            model: "gemini-2.0-flash", task_lane: "search",
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
        candidates: [{ content: { parts: [{ text: "This is not valid JSON at all." }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executeResearch(env as any, {
        productIdea: "Test idea",
        domain: "test",
      });

      expect(result.success).toBe(false);
      expect(result.research).toBeNull();
      expect(result.rawContent).toBe("This is not valid JSON at all.");
      expect(result.error).toContain("parse");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ═════════════════════════════════════════════════════════
// ── Researcher API Handlers Tests ───────────────────────
// ═════════════════════════════════════════════════════════

describe("researcher/handlers", () => {
  describe("runResearch", () => {
    it("returns 404 when product not found", async () => {
      const { runResearch } = await import("../src/api/routes/researcher/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/products/nope/research", {});
      const res = await runResearch(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 when product domain not found", async () => {
      const { runResearch } = await import("../src/api/routes/researcher/handlers");
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
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/research", {});
      const res = await runResearch(req, env as any, "prod_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("domain not found");
    });
  });

  describe("getProductResearch", () => {
    it("returns 404 when product not found", async () => {
      const { getProductResearch } = await import("../src/api/routes/researcher/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getProductResearch(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 404 when no research output exists", async () => {
      const { getProductResearch } = await import("../src/api/routes/researcher/handlers");
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
      const res = await getProductResearch(env as any, "prod_1");
      expect(res.status).toBe(404);
      const body = await res.json() as any;
      expect(body.error).toContain("No research output");
    });

    it("returns research output when found", async () => {
      const { getProductResearch } = await import("../src/api/routes/researcher/handlers");
      const research = { trends: [{ trend: "AI growth", relevance: "high" }], competitors: [], pricing_signals: [], keywords: [], audience_notes: [] };
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
              output_json: JSON.stringify(research),
              provider_log_json: JSON.stringify([]),
              created_at: "2026-01-01T00:00:00Z",
            },
          });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await getProductResearch(env as any, "prod_1");
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.id).toBe("wso_1");
      expect(body.data.research.trends).toHaveLength(1);
    });
  });

  describe("getResearchOutput", () => {
    it("returns 404 when output not found", async () => {
      const { getResearchOutput } = await import("../src/api/routes/researcher/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getResearchOutput(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns output by ID", async () => {
      const { getResearchOutput } = await import("../src/api/routes/researcher/handlers");
      const research = { trends: [], competitors: [{ name: "Rival", strengths: ["speed"], weaknesses: ["price"] }], pricing_signals: [], keywords: [], audience_notes: [] };
      const env = makeMockEnv(makeMockStmt({
        firstResult: {
          id: "wso_abc",
          step_id: "step_1",
          run_id: "run_1",
          product_id: "prod_1",
          output_json: JSON.stringify(research),
          provider_log_json: JSON.stringify([{ providerId: "p1", outcome: "success" }]),
          created_at: "2026-01-01T00:00:00Z",
        },
      }));
      const res = await getResearchOutput(env as any, "wso_abc");
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data.research.competitors).toHaveLength(1);
      expect(body.data.provider_log).toHaveLength(1);
    });
  });

  describe("listResearchOutputs", () => {
    it("returns all research outputs", async () => {
      const { listResearchOutputs } = await import("../src/api/routes/researcher/handlers");
      const rows = [
        {
          id: "wso_1", step_id: "s1", run_id: "r1", product_id: "p1",
          output_json: JSON.stringify({ trends: [], competitors: [], pricing_signals: [], keywords: [], audience_notes: [] }),
          provider_log_json: "[]", created_at: "2026-01-01",
        },
        {
          id: "wso_2", step_id: "s2", run_id: "r2", product_id: "p2",
          output_json: JSON.stringify({ trends: [], competitors: [], pricing_signals: [], keywords: [], audience_notes: [] }),
          provider_log_json: "[]", created_at: "2026-01-02",
        },
      ];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const req = makeRequest("GET", "http://localhost/api/research");
      const res = await listResearchOutputs(req, env as any);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("filters by product_id", async () => {
      const { listResearchOutputs } = await import("../src/api/routes/researcher/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest("GET", "http://localhost/api/research?product_id=prod_1");
      await listResearchOutputs(req, env as any);
      const query = env.DB.prepare.mock.calls[0][0] as string;
      expect(query).toContain("product_id = ?");
    });
  });
});

// ═════════════════════════════════════════════════════════
// ── Research Output Save/Log Tests ──────────────────────
// ═════════════════════════════════════════════════════════

describe("services/researcher — save and log", () => {
  it("saveResearchOutput inserts into workflow_step_outputs", async () => {
    const { saveResearchOutput } = await import("../src/services/researcher");
    const mockStmt = makeMockStmt();
    const env = makeMockEnv(mockStmt);

    const result = {
      success: true,
      research: { trends: [], competitors: [], pricing_signals: [], keywords: [], audience_notes: [] },
      rawContent: "{}",
      providerLog: [],
      provider: "gemini",
      model: "gemini-2.0-flash",
      templateId: "pt_1",
      templateVersion: 1,
      error: null,
    };

    const outputId = await saveResearchOutput(env as any, "step_1", "run_1", "prod_1", result as any);
    expect(outputId).toMatch(/^wso_/);

    // Verify INSERT was called
    const calls = env.DB.prepare.mock.calls;
    const insertCall = calls.find((c: string[]) => c[0].includes("INSERT INTO workflow_step_outputs"));
    expect(insertCall).toBeDefined();

    // Verify UPDATE workflow_steps was called
    const updateCall = calls.find((c: string[]) => c[0].includes("UPDATE workflow_steps SET output_ref"));
    expect(updateCall).toBeDefined();
  });

  it("logProviderPath inserts into provider_call_log", async () => {
    const { logProviderPath } = await import("../src/services/researcher");
    const mockStmt = makeMockStmt();
    const env = makeMockEnv(mockStmt);

    const attempts = [
      { providerId: "p1", providerName: "Gemini", model: "gemini-2.0-flash", outcome: "success" as const, latencyMs: 150 },
      { providerId: "p2", providerName: "Groq", model: "llama", outcome: "skipped_no_key" as const },
    ];

    await logProviderPath(env as any, "run_1", "step_1", attempts);

    // Two INSERT calls (one per attempt)
    const calls = env.DB.prepare.mock.calls;
    const insertCalls = calls.filter((c: string[]) => c[0].includes("INSERT INTO provider_call_log"));
    expect(insertCalls).toHaveLength(2);
  });
});
