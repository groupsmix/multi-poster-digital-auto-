import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Provider layer tests.
 *
 * Tests the unified provider interface, adapter contracts, routing logic,
 * missing-key skipping, rate-limit sleep, and fallback chain behavior.
 */

// ── Types & Errors ───────────────────────────────────────

describe("provider/types", () => {
  it("ProviderMissingKeyError has correct name and message", async () => {
    const { ProviderMissingKeyError } = await import("../src/providers/types");
    const err = new ProviderMissingKeyError("gemini");
    expect(err.name).toBe("ProviderMissingKeyError");
    expect(err.message).toContain("gemini");
    expect(err.message).toContain("no API key");
  });

  it("ProviderRateLimitError carries retryAfterSecs", async () => {
    const { ProviderRateLimitError } = await import("../src/providers/types");
    const err = new ProviderRateLimitError("groq", 120);
    expect(err.name).toBe("ProviderRateLimitError");
    expect(err.retryAfterSecs).toBe(120);
    expect(err.message).toContain("120");
  });

  it("ProviderRateLimitError defaults to 60s", async () => {
    const { ProviderRateLimitError } = await import("../src/providers/types");
    const err = new ProviderRateLimitError("tavily");
    expect(err.retryAfterSecs).toBe(60);
  });

  it("ProviderCallError carries statusCode", async () => {
    const { ProviderCallError } = await import("../src/providers/types");
    const err = new ProviderCallError("exa", "bad gateway", 502);
    expect(err.name).toBe("ProviderCallError");
    expect(err.statusCode).toBe(502);
    expect(err.message).toContain("exa");
  });
});

// ── Adapter credential checks ────────────────────────────

describe("provider/adapters credential checks", () => {
  it("TavilyAdapter.hasCredentials returns false without key", async () => {
    const { TavilyAdapter } = await import("../src/providers/adapters/tavily");
    const adapter = new TavilyAdapter(undefined);
    expect(adapter.hasCredentials()).toBe(false);
    expect(adapter.id).toBe("tavily");
  });

  it("TavilyAdapter.hasCredentials returns true with key", async () => {
    const { TavilyAdapter } = await import("../src/providers/adapters/tavily");
    const adapter = new TavilyAdapter("tvly-test-key");
    expect(adapter.hasCredentials()).toBe(true);
  });

  it("ExaAdapter.hasCredentials returns false without key", async () => {
    const { ExaAdapter } = await import("../src/providers/adapters/exa");
    const adapter = new ExaAdapter(undefined);
    expect(adapter.hasCredentials()).toBe(false);
  });

  it("GeminiAdapter.hasCredentials returns false without key", async () => {
    const { GeminiAdapter } = await import("../src/providers/adapters/gemini");
    const adapter = new GeminiAdapter(undefined);
    expect(adapter.hasCredentials()).toBe(false);
  });

  it("GroqAdapter.hasCredentials returns false without key", async () => {
    const { GroqAdapter } = await import("../src/providers/adapters/groq");
    const adapter = new GroqAdapter(undefined);
    expect(adapter.hasCredentials()).toBe(false);
  });

  it("CloudflareAiAdapter.hasCredentials returns false without binding", async () => {
    const { CloudflareAiAdapter } = await import("../src/providers/adapters/cloudflare-ai");
    const adapter = new CloudflareAiAdapter(undefined);
    expect(adapter.hasCredentials()).toBe(false);
  });

  it("OpenAiAdapter.hasCredentials returns false without key (paid stub)", async () => {
    const { OpenAiAdapter } = await import("../src/providers/adapters/openai");
    const adapter = new OpenAiAdapter(undefined);
    expect(adapter.hasCredentials()).toBe(false);
    expect(adapter.displayName).toContain("paid");
  });

  it("AnthropicAdapter.hasCredentials returns false without key (paid stub)", async () => {
    const { AnthropicAdapter } = await import("../src/providers/adapters/anthropic");
    const adapter = new AnthropicAdapter(undefined);
    expect(adapter.hasCredentials()).toBe(false);
    expect(adapter.displayName).toContain("paid");
  });
});

// ── Adapter execute throws ProviderMissingKeyError without key ──

describe("provider/adapters missing key throws", () => {
  it("TavilyAdapter.execute throws ProviderMissingKeyError", async () => {
    const { TavilyAdapter } = await import("../src/providers/adapters/tavily");
    const { ProviderMissingKeyError } = await import("../src/providers/types");
    const adapter = new TavilyAdapter(undefined);
    await expect(
      adapter.execute({ lane: "search", prompt: "test" }),
    ).rejects.toThrow(ProviderMissingKeyError);
  });

  it("ExaAdapter.execute throws ProviderMissingKeyError", async () => {
    const { ExaAdapter } = await import("../src/providers/adapters/exa");
    const { ProviderMissingKeyError } = await import("../src/providers/types");
    const adapter = new ExaAdapter(undefined);
    await expect(
      adapter.execute({ lane: "search", prompt: "test" }),
    ).rejects.toThrow(ProviderMissingKeyError);
  });

  it("GeminiAdapter.execute throws ProviderMissingKeyError", async () => {
    const { GeminiAdapter } = await import("../src/providers/adapters/gemini");
    const { ProviderMissingKeyError } = await import("../src/providers/types");
    const adapter = new GeminiAdapter(undefined);
    await expect(
      adapter.execute({ lane: "build", prompt: "test" }),
    ).rejects.toThrow(ProviderMissingKeyError);
  });

  it("GroqAdapter.execute throws ProviderMissingKeyError", async () => {
    const { GroqAdapter } = await import("../src/providers/adapters/groq");
    const { ProviderMissingKeyError } = await import("../src/providers/types");
    const adapter = new GroqAdapter(undefined);
    await expect(
      adapter.execute({ lane: "build", prompt: "test" }),
    ).rejects.toThrow(ProviderMissingKeyError);
  });

  it("OpenAiAdapter.execute throws ProviderMissingKeyError", async () => {
    const { OpenAiAdapter } = await import("../src/providers/adapters/openai");
    const { ProviderMissingKeyError } = await import("../src/providers/types");
    const adapter = new OpenAiAdapter(undefined);
    await expect(
      adapter.execute({ lane: "build", prompt: "test" }),
    ).rejects.toThrow(ProviderMissingKeyError);
  });

  it("AnthropicAdapter.execute throws ProviderMissingKeyError", async () => {
    const { AnthropicAdapter } = await import("../src/providers/adapters/anthropic");
    const { ProviderMissingKeyError } = await import("../src/providers/types");
    const adapter = new AnthropicAdapter(undefined);
    await expect(
      adapter.execute({ lane: "build", prompt: "test" }),
    ).rejects.toThrow(ProviderMissingKeyError);
  });

  it("CloudflareAiAdapter.execute throws ProviderCallError without binding", async () => {
    const { CloudflareAiAdapter } = await import("../src/providers/adapters/cloudflare-ai");
    const { ProviderCallError } = await import("../src/providers/types");
    const adapter = new CloudflareAiAdapter(undefined);
    await expect(
      adapter.execute({ lane: "build", prompt: "test" }),
    ).rejects.toThrow(ProviderCallError);
  });
});

// ── Registry ─────────────────────────────────────────────

describe("provider/registry", () => {
  it("builds all 7 adapters", async () => {
    const { buildAdapterRegistry } = await import("../src/providers/registry");
    const env = makeMockEnv();
    const registry = buildAdapterRegistry(env as any);
    expect(registry.size).toBe(7);
    expect(registry.has("tavily")).toBe(true);
    expect(registry.has("exa")).toBe(true);
    expect(registry.has("gemini")).toBe(true);
    expect(registry.has("groq")).toBe(true);
    expect(registry.has("cloudflare_ai")).toBe(true);
    expect(registry.has("openai")).toBe(true);
    expect(registry.has("anthropic")).toBe(true);
  });

  it("adapters without env keys have hasCredentials=false", async () => {
    const { buildAdapterRegistry } = await import("../src/providers/registry");
    const env = makeMockEnv();
    const registry = buildAdapterRegistry(env as any);
    for (const [, adapter] of registry) {
      expect(adapter.hasCredentials()).toBe(false);
    }
  });

  it("adapters with env keys have hasCredentials=true", async () => {
    const { buildAdapterRegistry } = await import("../src/providers/registry");
    const env = makeMockEnv({ GEMINI_API_KEY: "test-key", GROQ_API_KEY: "test-key" });
    const registry = buildAdapterRegistry(env as any);
    expect(registry.get("gemini")!.hasCredentials()).toBe(true);
    expect(registry.get("groq")!.hasCredentials()).toBe(true);
    expect(registry.get("tavily")!.hasCredentials()).toBe(false);
  });
});

// ── Executor / Routing ───────────────────────────────────

describe("provider/executor — free-first routing", () => {
  it("returns success=false when no providers in chain", async () => {
    const { executeWithRouting } = await import("../src/providers/executor");
    const env = makeMockEnv({}, { allResults: [] });
    const result = await executeWithRouting(env as any, "search", {
      lane: "search",
      prompt: "test query",
    });
    expect(result.success).toBe(false);
    expect(result.attempts).toHaveLength(0);
  });

  it("skips sleeping providers", async () => {
    const { executeWithRouting } = await import("../src/providers/executor");
    const rows = [
      makeProviderRow({ id: "p1", name: "Tavily", provider: "tavily", state: "sleeping", tier: 0 }),
      makeProviderRow({ id: "p2", name: "Exa", provider: "exa", state: "sleeping", tier: 0 }),
    ];
    const env = makeMockEnv({}, { allResults: rows });
    const result = await executeWithRouting(env as any, "search", {
      lane: "search",
      prompt: "test",
    });
    expect(result.success).toBe(false);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0].outcome).toBe("skipped_sleeping");
    expect(result.attempts[1].outcome).toBe("skipped_sleeping");
  });

  it("skips providers without API key (hasCredentials=false)", async () => {
    const { executeWithRouting } = await import("../src/providers/executor");
    const rows = [
      makeProviderRow({ id: "p1", name: "Tavily", provider: "tavily", state: "active", tier: 0 }),
      makeProviderRow({ id: "p2", name: "Gemini", provider: "gemini", state: "active", tier: 0 }),
    ];
    // No API keys set → hasCredentials() = false for all
    const env = makeMockEnv({}, { allResults: rows });
    const result = await executeWithRouting(env as any, "search", {
      lane: "search",
      prompt: "test",
    });
    expect(result.success).toBe(false);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0].outcome).toBe("skipped_no_key");
    expect(result.attempts[1].outcome).toBe("skipped_no_key");
  });

  it("skips providers in cooldown (future cooldown_until)", async () => {
    const { executeWithRouting } = await import("../src/providers/executor");
    const futureDate = new Date(Date.now() + 60000).toISOString();
    const rows = [
      makeProviderRow({
        id: "p1", name: "Tavily", provider: "tavily",
        state: "cooldown", tier: 0, cooldown_until: futureDate,
      }),
    ];
    const env = makeMockEnv({}, { allResults: rows });
    const result = await executeWithRouting(env as any, "search", {
      lane: "search",
      prompt: "test",
    });
    expect(result.success).toBe(false);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].outcome).toBe("skipped_cooldown");
  });

  it("skips disabled providers", async () => {
    const { executeWithRouting } = await import("../src/providers/executor");
    const rows = [
      makeProviderRow({ id: "p1", name: "Tavily", provider: "tavily", state: "disabled", tier: 0 }),
    ];
    const env = makeMockEnv({}, { allResults: rows });
    const result = await executeWithRouting(env as any, "search", {
      lane: "search",
      prompt: "test",
    });
    expect(result.success).toBe(false);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].outcome).toBe("skipped_sleeping");
  });

  it("treats expired cooldown as active (provider becomes available)", async () => {
    const { executeWithRouting } = await import("../src/providers/executor");
    const pastDate = new Date(Date.now() - 60000).toISOString();
    const rows = [
      makeProviderRow({
        id: "p1", name: "Gemini", provider: "gemini",
        state: "rate_limited", tier: 0, cooldown_until: pastDate,
      }),
    ];
    // Gemini key available but will fail since we mock fetch to fail
    const env = makeMockEnv({ GEMINI_API_KEY: "test-key" }, { allResults: rows });

    // Mock global fetch to simulate Gemini success
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: "Generated response" }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      }),
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executeWithRouting(env as any, "build", {
        lane: "build",
        prompt: "test",
      });
      expect(result.success).toBe(true);
      expect(result.response!.provider).toBe("gemini");
      expect(result.response!.content).toBe("Generated response");
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0].outcome).toBe("success");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to next provider on rate limit", async () => {
    const { executeWithRouting } = await import("../src/providers/executor");
    const rows = [
      makeProviderRow({ id: "p1", name: "Gemini", provider: "gemini", state: "active", tier: 0 }),
      makeProviderRow({ id: "p2", name: "Groq", provider: "groq", state: "active", tier: 1 }),
    ];
    const env = makeMockEnv(
      { GEMINI_API_KEY: "key1", GROQ_API_KEY: "key2" },
      { allResults: rows },
    );

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      callCount++;
      if (callCount === 1) {
        // Gemini returns 429
        return Promise.resolve({
          ok: false,
          status: 429,
          headers: new Headers({ "Retry-After": "30" }),
          text: () => Promise.resolve("rate limited"),
        });
      }
      // Groq succeeds
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          choices: [{ message: { content: "Groq response" } }],
          usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
        }),
      });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executeWithRouting(env as any, "build", {
        lane: "build",
        prompt: "test",
      });
      expect(result.success).toBe(true);
      expect(result.response!.provider).toBe("groq");
      expect(result.response!.content).toBe("Groq response");
      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0].outcome).toBe("rate_limited");
      expect(result.attempts[1].outcome).toBe("success");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to next provider on generic error", async () => {
    const { executeWithRouting } = await import("../src/providers/executor");
    const rows = [
      makeProviderRow({ id: "p1", name: "Gemini", provider: "gemini", state: "active", tier: 0 }),
      makeProviderRow({ id: "p2", name: "Groq", provider: "groq", state: "active", tier: 1 }),
    ];
    const env = makeMockEnv(
      { GEMINI_API_KEY: "key1", GROQ_API_KEY: "key2" },
      { allResults: rows },
    );

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Gemini returns 500
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve("internal error"),
        });
      }
      // Groq succeeds
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          choices: [{ message: { content: "Groq fallback" } }],
          usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
        }),
      });
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executeWithRouting(env as any, "build", {
        lane: "build",
        prompt: "test",
      });
      expect(result.success).toBe(true);
      expect(result.response!.provider).toBe("groq");
      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0].outcome).toBe("error");
      expect(result.attempts[1].outcome).toBe("success");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("respects tier ordering: free before paid", async () => {
    const { executeWithRouting } = await import("../src/providers/executor");
    const rows = [
      makeProviderRow({ id: "p1", name: "Gemini Free", provider: "gemini", state: "active", tier: 0 }),
      makeProviderRow({ id: "p2", name: "OpenAI Paid", provider: "openai", state: "sleeping", tier: 2 }),
    ];
    const env = makeMockEnv({ GEMINI_API_KEY: "key1" }, { allResults: rows });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: "Gemini response" }] } }],
        usageMetadata: {},
      }),
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executeWithRouting(env as any, "build", {
        lane: "build",
        prompt: "test",
      });
      expect(result.success).toBe(true);
      expect(result.response!.provider).toBe("gemini");
      // OpenAI should be skipped as sleeping
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0].outcome).toBe("success");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("skips unknown provider slugs gracefully", async () => {
    const { executeWithRouting } = await import("../src/providers/executor");
    const rows = [
      makeProviderRow({ id: "p1", name: "Unknown", provider: "unknown_provider", state: "active", tier: 0 }),
    ];
    const env = makeMockEnv({}, { allResults: rows });
    const result = await executeWithRouting(env as any, "search", {
      lane: "search",
      prompt: "test",
    });
    expect(result.success).toBe(false);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0].outcome).toBe("skipped_disabled");
    expect(result.attempts[0].error).toContain("No adapter registered");
  });

  it("records provider used on success (updates last_used_at)", async () => {
    const { executeWithRouting } = await import("../src/providers/executor");
    const rows = [
      makeProviderRow({ id: "p1", name: "Groq", provider: "groq", state: "active", tier: 0 }),
    ];
    const env = makeMockEnv({ GROQ_API_KEY: "test-key" }, { allResults: rows });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        choices: [{ message: { content: "response" } }],
        usage: {},
      }),
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executeWithRouting(env as any, "build", {
        lane: "build",
        prompt: "test",
      });
      expect(result.success).toBe(true);
      // Verify that the DB was called to update last_used_at
      const dbCalls = env.DB.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
      const updateCall = dbCalls.find((q: string) => q.includes("last_used_at"));
      expect(updateCall).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("puts provider in rate_limited state on 429 and updates DB", async () => {
    const { executeWithRouting } = await import("../src/providers/executor");
    const rows = [
      makeProviderRow({ id: "p1", name: "Gemini", provider: "gemini", state: "active", tier: 0 }),
    ];
    const env = makeMockEnv({ GEMINI_API_KEY: "test-key" }, { allResults: rows });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "45" }),
      text: () => Promise.resolve("rate limited"),
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const result = await executeWithRouting(env as any, "build", {
        lane: "build",
        prompt: "test",
      });
      expect(result.success).toBe(false);
      expect(result.attempts[0].outcome).toBe("rate_limited");

      // Verify DB was updated with rate_limited state
      const dbCalls = env.DB.prepare.mock.calls.map((c: unknown[]) => c[0] as string);
      const stateUpdate = dbCalls.find((q: string) => q.includes("state = ?") && q.includes("cooldown_until"));
      expect(stateUpdate).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ── Execute endpoint handler ─────────────────────────────

describe("providers/executeProviderChain handler", () => {
  it("returns 400 when task_lane missing", async () => {
    const { executeProviderChain } = await import("../src/api/routes/providers/handlers");
    const env = makeMockEnv();
    const req = makeRequest("POST", "http://localhost/api/providers/execute", {
      prompt: "test",
    });
    const res = await executeProviderChain(req, env as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 when prompt missing", async () => {
    const { executeProviderChain } = await import("../src/api/routes/providers/handlers");
    const env = makeMockEnv();
    const req = makeRequest("POST", "http://localhost/api/providers/execute", {
      task_lane: "search",
    });
    const res = await executeProviderChain(req, env as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid task_lane", async () => {
    const { executeProviderChain } = await import("../src/api/routes/providers/handlers");
    const env = makeMockEnv();
    const req = makeRequest("POST", "http://localhost/api/providers/execute", {
      task_lane: "invalid_lane",
      prompt: "test",
    });
    const res = await executeProviderChain(req, env as any);
    expect(res.status).toBe(400);
  });

  it("returns 503 when no providers succeed", async () => {
    const { executeProviderChain } = await import("../src/api/routes/providers/handlers");
    const env = makeMockEnv({}, { allResults: [] });
    const req = makeRequest("POST", "http://localhost/api/providers/execute", {
      task_lane: "search",
      prompt: "test query",
    });
    const res = await executeProviderChain(req, env as any);
    expect(res.status).toBe(503);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
  });
});

// ── Helpers ──────────────────────────────────────────────

function makeMockStmt(options: {
  allResults?: Record<string, unknown>[];
  firstResult?: Record<string, unknown> | null;
} = {}) {
  return {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: options.allResults ?? [] }),
    first: vi.fn().mockResolvedValue(options.firstResult ?? null),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  };
}

function makeMockEnv(
  secrets: Record<string, string> = {},
  stmtOptions: { allResults?: Record<string, unknown>[]; firstResult?: Record<string, unknown> | null } = {},
) {
  const stmt = makeMockStmt(stmtOptions);
  return {
    DB: {
      prepare: vi.fn().mockReturnValue(stmt),
    },
    CACHE: {},
    ASSETS_BUCKET: {},
    WORKFLOW_COORDINATOR: {},
    PROVIDER_ROUTER: {},
    ENVIRONMENT: "test",
    APP_NAME: "NEXUS",
    ...secrets,
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

function makeProviderRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "prov_test",
    name: "Test Provider",
    provider: "test",
    model: null,
    task_lane: "search",
    tier: 0,
    priority: 0,
    state: "active",
    has_api_key: 1,
    cooldown_until: null,
    is_active: 1,
    ...overrides,
  };
}
