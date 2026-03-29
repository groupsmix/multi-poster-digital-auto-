import { describe, it, expect, vi } from "vitest";

/**
 * AI Router state layer tests.
 *
 * Tests the provider handler functions in isolation by mocking the D1 env.
 * Covers: CRUD, sleep/wake, cooldown logic, error/rate-limit reporting,
 * task lane listing, and provider resolution.
 */

// ── Mock D1 helpers (same pattern as crud.test.ts) ───────

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

// ── Provider CRUD tests ─────────────────────────────────

describe("providers/handlers", () => {
  describe("listProviders", () => {
    it("returns list from DB", async () => {
      const { listProviders } = await import("../src/api/routes/providers/handlers");
      const rows = [{ id: "prov_1", name: "Gemini Flash", task_lane: "search" }];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const req = makeRequest("GET", "http://localhost/api/providers");
      const res = await listProviders(req, env as any);
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it("filters by task_lane", async () => {
      const { listProviders } = await import("../src/api/routes/providers/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest("GET", "http://localhost/api/providers?task_lane=search");
      await listProviders(req, env as any);
      const prepareCall = env.DB.prepare.mock.calls[0][0] as string;
      expect(prepareCall).toContain("task_lane = ?");
    });

    it("filters by state", async () => {
      const { listProviders } = await import("../src/api/routes/providers/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest("GET", "http://localhost/api/providers?state=active");
      await listProviders(req, env as any);
      const prepareCall = env.DB.prepare.mock.calls[0][0] as string;
      expect(prepareCall).toContain("state = ?");
    });

    it("filters by active=true", async () => {
      const { listProviders } = await import("../src/api/routes/providers/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest("GET", "http://localhost/api/providers?active=true");
      await listProviders(req, env as any);
      const prepareCall = env.DB.prepare.mock.calls[0][0] as string;
      expect(prepareCall).toContain("is_active = 1");
    });
  });

  describe("getProvider", () => {
    it("returns 404 when not found", async () => {
      const { getProvider } = await import("../src/api/routes/providers/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getProvider(env as any, "nonexistent");
      expect(res.status).toBe(404);
    });

    it("returns provider when found", async () => {
      const { getProvider } = await import("../src/api/routes/providers/handlers");
      const row = { id: "prov_1", name: "Gemini Flash", state: "active", cooldown_until: null };
      const env = makeMockEnv(makeMockStmt({ firstResult: row }));
      const res = await getProvider(env as any, "prov_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data.name).toBe("Gemini Flash");
      expect(body.data.effective_state).toBe("active");
    });

    it("resolves expired cooldown to active", async () => {
      const { getProvider } = await import("../src/api/routes/providers/handlers");
      const pastDate = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      const row = { id: "prov_1", name: "Test", state: "cooldown", cooldown_until: pastDate };
      const env = makeMockEnv(makeMockStmt({ firstResult: row }));
      const res = await getProvider(env as any, "prov_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data.effective_state).toBe("active");
      expect(body.data.cooldown_expired).toBe(true);
    });

    it("keeps active cooldown state", async () => {
      const { getProvider } = await import("../src/api/routes/providers/handlers");
      const futureDate = new Date(Date.now() + 60000).toISOString(); // 1 minute from now
      const row = { id: "prov_1", name: "Test", state: "cooldown", cooldown_until: futureDate };
      const env = makeMockEnv(makeMockStmt({ firstResult: row }));
      const res = await getProvider(env as any, "prov_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data.effective_state).toBe("cooldown");
      expect(body.data.cooldown_expired).toBe(false);
    });
  });

  describe("createProvider", () => {
    it("returns 400 for missing required fields", async () => {
      const { createProvider } = await import("../src/api/routes/providers/handlers");
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/providers", {});
      const res = await createProvider(req, env as any);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON", async () => {
      const { createProvider } = await import("../src/api/routes/providers/handlers");
      const env = makeMockEnv();
      const req = new Request("http://localhost/api/providers", {
        method: "POST",
        body: "not json",
      });
      const res = await createProvider(req, env as any);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid task_lane", async () => {
      const { createProvider } = await import("../src/api/routes/providers/handlers");
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/providers", {
        name: "Test",
        provider: "openai",
        task_lane: "invalid_lane",
      });
      const res = await createProvider(req, env as any);
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("Invalid task_lane");
    });

    it("creates free provider as active", async () => {
      const { createProvider } = await import("../src/api/routes/providers/handlers");
      const created = { id: "prov_new", name: "Gemini", state: "active", tier: 0 };
      const stmtFn = (query: string) => {
        if (query.includes("INSERT INTO")) return makeMockStmt();
        if (query.includes("SELECT * FROM provider_configs WHERE id")) {
          return makeMockStmt({ firstResult: created });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/providers", {
        name: "Gemini",
        provider: "google",
        task_lane: "search",
        tier: 0,
      });
      const res = await createProvider(req, env as any);
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.data.state).toBe("active");
    });

    it("creates paid provider as sleeping", async () => {
      const { createProvider } = await import("../src/api/routes/providers/handlers");
      const created = { id: "prov_new", name: "GPT-4", state: "sleeping", tier: 2 };
      const stmtFn = (query: string) => {
        if (query.includes("INSERT INTO")) {
          return makeMockStmt();
        }
        if (query.includes("SELECT * FROM provider_configs WHERE id")) {
          return makeMockStmt({ firstResult: created });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/providers", {
        name: "GPT-4",
        provider: "openai",
        task_lane: "build",
        tier: 2,
      });
      const res = await createProvider(req, env as any);
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.data.state).toBe("sleeping");
    });
  });

  describe("updateProvider", () => {
    it("returns 404 when not found", async () => {
      const { updateProvider } = await import("../src/api/routes/providers/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT")) return makeMockStmt({ firstResult: null });
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("PUT", "http://localhost/api/providers/nope", { name: "Updated" });
      const res = await updateProvider(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 when no fields provided", async () => {
      const { updateProvider } = await import("../src/api/routes/providers/handlers");
      const existing = { id: "prov_1", name: "Old" };
      const env = makeMockEnv(makeMockStmt({ firstResult: existing }));
      const req = makeRequest("PUT", "http://localhost/api/providers/prov_1", {});
      const res = await updateProvider(req, env as any, "prov_1");
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid task_lane on update", async () => {
      const { updateProvider } = await import("../src/api/routes/providers/handlers");
      const existing = { id: "prov_1", name: "Old" };
      const env = makeMockEnv(makeMockStmt({ firstResult: existing }));
      const req = makeRequest("PUT", "http://localhost/api/providers/prov_1", {
        task_lane: "invalid",
      });
      const res = await updateProvider(req, env as any, "prov_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("Invalid task_lane");
    });
  });

  describe("deleteProvider", () => {
    it("returns 404 when not found", async () => {
      const { deleteProvider } = await import("../src/api/routes/providers/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await deleteProvider(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("soft-deletes provider", async () => {
      const { deleteProvider } = await import("../src/api/routes/providers/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM provider_configs")) {
          return makeMockStmt({ firstResult: { id: "prov_1" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await deleteProvider(env as any, "prov_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("deactivated");
    });
  });
});

// ── Sleep / Wake tests ──────────────────────────────────

describe("providers/sleep-wake", () => {
  describe("sleepProvider", () => {
    it("returns 404 when not found", async () => {
      const { sleepProvider } = await import("../src/api/routes/providers/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await sleepProvider(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("puts provider to sleep", async () => {
      const { sleepProvider } = await import("../src/api/routes/providers/handlers");
      const existing = { id: "prov_1", name: "Test", state: "active" };
      const updated = { ...existing, state: "sleeping" };
      const stmtFn = (query: string) => {
        if (query.includes("SELECT") && query.includes("UPDATE") === false) {
          if (query.includes("UPDATE")) return makeMockStmt({ firstResult: updated });
          return makeMockStmt({ firstResult: existing });
        }
        if (query.includes("UPDATE")) return makeMockStmt();
        return makeMockStmt({ firstResult: updated });
      };
      const env = makeMockEnv(stmtFn);
      const res = await sleepProvider(env as any, "prov_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("sleep");
    });

    it("returns already sleeping message", async () => {
      const { sleepProvider } = await import("../src/api/routes/providers/handlers");
      const existing = { id: "prov_1", name: "Test", state: "sleeping" };
      const env = makeMockEnv(makeMockStmt({ firstResult: existing }));
      const res = await sleepProvider(env as any, "prov_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("already sleeping");
    });
  });

  describe("wakeProvider", () => {
    it("returns 404 when not found", async () => {
      const { wakeProvider } = await import("../src/api/routes/providers/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await wakeProvider(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("wakes a sleeping free provider", async () => {
      const { wakeProvider } = await import("../src/api/routes/providers/handlers");
      const existing = { id: "prov_1", name: "Test", state: "sleeping", tier: 0, has_api_key: 0 };
      const updated = { ...existing, state: "active" };
      let callCount = 0;
      const stmtFn = (query: string) => {
        if (query.includes("SELECT")) {
          callCount++;
          if (callCount === 1) return makeMockStmt({ firstResult: existing });
          return makeMockStmt({ firstResult: updated });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await wakeProvider(env as any, "prov_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("woken");
    });

    it("returns already active message", async () => {
      const { wakeProvider } = await import("../src/api/routes/providers/handlers");
      const existing = { id: "prov_1", state: "active", tier: 0 };
      const env = makeMockEnv(makeMockStmt({ firstResult: existing }));
      const res = await wakeProvider(env as any, "prov_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("already active");
    });

    it("rejects waking paid provider without API key", async () => {
      const { wakeProvider } = await import("../src/api/routes/providers/handlers");
      const existing = { id: "prov_1", state: "sleeping", tier: 2, has_api_key: 0 };
      const env = makeMockEnv(makeMockStmt({ firstResult: existing }));
      const res = await wakeProvider(env as any, "prov_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("API key");
    });

    it("allows waking paid provider with API key", async () => {
      const { wakeProvider } = await import("../src/api/routes/providers/handlers");
      const existing = { id: "prov_1", state: "sleeping", tier: 2, has_api_key: 1 };
      const updated = { ...existing, state: "active" };
      let callCount = 0;
      const stmtFn = (query: string) => {
        if (query.includes("SELECT")) {
          callCount++;
          if (callCount === 1) return makeMockStmt({ firstResult: existing });
          return makeMockStmt({ firstResult: updated });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await wakeProvider(env as any, "prov_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("woken");
    });
  });
});

// ── Cooldown / Error / Rate Limit tests ────────────────

describe("providers/cooldown-error", () => {
  describe("cooldownProvider", () => {
    it("returns 404 when not found", async () => {
      const { cooldownProvider } = await import("../src/api/routes/providers/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT")) return makeMockStmt({ firstResult: null });
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/providers/nope/cooldown", {
        duration_secs: 30,
      });
      const res = await cooldownProvider(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("puts provider in cooldown", async () => {
      const { cooldownProvider } = await import("../src/api/routes/providers/handlers");
      const existing = { id: "prov_1", name: "Test", state: "active" };
      const updated = { ...existing, state: "cooldown" };
      let callCount = 0;
      const stmtFn = (query: string) => {
        if (query.includes("SELECT")) {
          callCount++;
          if (callCount === 1) return makeMockStmt({ firstResult: existing });
          return makeMockStmt({ firstResult: updated });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/providers/prov_1/cooldown", {
        duration_secs: 120,
        reason: "too many requests",
      });
      const res = await cooldownProvider(req, env as any, "prov_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("cooldown");
      expect(body.cooldown_until).toBeDefined();
    });
  });

  describe("reportProviderError", () => {
    it("returns 404 when not found", async () => {
      const { reportProviderError } = await import("../src/api/routes/providers/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT")) return makeMockStmt({ firstResult: null });
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/providers/nope/report-error", {
        error: "connection failed",
      });
      const res = await reportProviderError(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("marks provider as error", async () => {
      const { reportProviderError } = await import("../src/api/routes/providers/handlers");
      const existing = { id: "prov_1", name: "Test", state: "active" };
      const updated = { ...existing, state: "error", last_error: "timeout" };
      let callCount = 0;
      const stmtFn = (query: string) => {
        if (query.includes("SELECT")) {
          callCount++;
          if (callCount === 1) return makeMockStmt({ firstResult: existing });
          return makeMockStmt({ firstResult: updated });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/providers/prov_1/report-error", {
        error: "timeout",
      });
      const res = await reportProviderError(req, env as any, "prov_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("error");
    });
  });

  describe("reportProviderRateLimit", () => {
    it("returns 404 when not found", async () => {
      const { reportProviderRateLimit } = await import("../src/api/routes/providers/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT")) return makeMockStmt({ firstResult: null });
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/providers/nope/report-rate-limit", {});
      const res = await reportProviderRateLimit(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("marks provider as rate_limited with cooldown", async () => {
      const { reportProviderRateLimit } = await import("../src/api/routes/providers/handlers");
      const existing = { id: "prov_1", name: "Test", state: "active" };
      const updated = { ...existing, state: "rate_limited" };
      let callCount = 0;
      const stmtFn = (query: string) => {
        if (query.includes("SELECT")) {
          callCount++;
          if (callCount === 1) return makeMockStmt({ firstResult: existing });
          return makeMockStmt({ firstResult: updated });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/providers/prov_1/report-rate-limit", {
        duration_secs: 30,
      });
      const res = await reportProviderRateLimit(req, env as any, "prov_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("rate-limited");
      expect(body.cooldown_until).toBeDefined();
    });
  });
});

// ── Task Lane tests ─────────────────────────────────────

describe("providers/task-lanes", () => {
  describe("listTaskLanes", () => {
    it("groups providers by lane", async () => {
      const { listTaskLanes } = await import("../src/api/routes/providers/handlers");
      const rows = [
        { id: "p1", name: "Gemini", task_lane: "search", state: "active", cooldown_until: null, tier: 0 },
        { id: "p2", name: "GPT-4", task_lane: "build", state: "active", cooldown_until: null, tier: 2 },
        { id: "p3", name: "Llama", task_lane: "search", state: "sleeping", cooldown_until: null, tier: 1 },
      ];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const res = await listTaskLanes(env as any);
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.lanes).toContain("search");
      expect(body.lanes).toContain("build");
      expect(body.data.search).toHaveLength(2);
      expect(body.data.build).toHaveLength(1);
      expect(body.total_providers).toBe(3);
    });
  });

  describe("getTaskLane", () => {
    it("returns 400 for invalid lane", async () => {
      const { getTaskLane } = await import("../src/api/routes/providers/handlers");
      const env = makeMockEnv();
      const res = await getTaskLane(env as any, "invalid_lane");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("Invalid task lane");
    });

    it("returns providers for valid lane", async () => {
      const { getTaskLane } = await import("../src/api/routes/providers/handlers");
      const rows = [
        { id: "p1", name: "Gemini", task_lane: "search", state: "active", tier: 0, cooldown_until: null },
      ];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const res = await getTaskLane(env as any, "search");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.lane).toBe("search");
      expect(body.providers).toHaveLength(1);
    });
  });

  describe("resolveTaskLane", () => {
    it("returns 400 for invalid lane", async () => {
      const { resolveTaskLane } = await import("../src/api/routes/providers/handlers");
      const env = makeMockEnv();
      const res = await resolveTaskLane(env as any, "invalid_lane");
      expect(res.status).toBe(400);
    });

    it("resolves best active provider by tier then priority", async () => {
      const { resolveTaskLane } = await import("../src/api/routes/providers/handlers");
      const rows = [
        { id: "p1", name: "Gemini", state: "active", tier: 0, priority: 0, has_api_key: 0, cooldown_until: null, task_lane: "search" },
        { id: "p2", name: "GPT-4", state: "active", tier: 2, priority: 0, has_api_key: 1, cooldown_until: null, task_lane: "search" },
      ];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const res = await resolveTaskLane(env as any, "search");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.resolved.name).toBe("Gemini");
      expect(body.resolved.tier).toBe(0);
    });

    it("skips sleeping providers", async () => {
      const { resolveTaskLane } = await import("../src/api/routes/providers/handlers");
      const rows = [
        { id: "p1", name: "Sleeping", state: "sleeping", tier: 0, priority: 0, has_api_key: 0, cooldown_until: null, task_lane: "search" },
        { id: "p2", name: "Active", state: "active", tier: 1, priority: 0, has_api_key: 0, cooldown_until: null, task_lane: "search" },
      ];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const res = await resolveTaskLane(env as any, "search");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.resolved.name).toBe("Active");
      expect(body.skipped).toHaveLength(1);
      expect(body.skipped[0].reason).toContain("sleeping");
    });

    it("skips errored providers", async () => {
      const { resolveTaskLane } = await import("../src/api/routes/providers/handlers");
      const rows = [
        { id: "p1", name: "Errored", state: "error", tier: 0, priority: 0, has_api_key: 0, cooldown_until: null, task_lane: "build" },
        { id: "p2", name: "Working", state: "active", tier: 1, priority: 0, has_api_key: 0, cooldown_until: null, task_lane: "build" },
      ];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const res = await resolveTaskLane(env as any, "build");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.resolved.name).toBe("Working");
    });

    it("skips providers in active cooldown", async () => {
      const { resolveTaskLane } = await import("../src/api/routes/providers/handlers");
      const futureDate = new Date(Date.now() + 60000).toISOString();
      const rows = [
        { id: "p1", name: "Cooling", state: "cooldown", tier: 0, priority: 0, has_api_key: 0, cooldown_until: futureDate, task_lane: "search" },
        { id: "p2", name: "Ready", state: "active", tier: 1, priority: 0, has_api_key: 0, cooldown_until: null, task_lane: "search" },
      ];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const res = await resolveTaskLane(env as any, "search");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.resolved.name).toBe("Ready");
      expect(body.skipped[0].reason).toContain("cooldown");
    });

    it("selects expired-cooldown provider as active", async () => {
      const { resolveTaskLane } = await import("../src/api/routes/providers/handlers");
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const rows = [
        { id: "p1", name: "CooldownDone", state: "cooldown", tier: 0, priority: 0, has_api_key: 0, cooldown_until: pastDate, task_lane: "search" },
      ];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const res = await resolveTaskLane(env as any, "search");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.resolved.name).toBe("CooldownDone");
      expect(body.resolved.state).toBe("active");
    });

    it("skips paid provider without API key", async () => {
      const { resolveTaskLane } = await import("../src/api/routes/providers/handlers");
      const rows = [
        { id: "p1", name: "Paid-NoKey", state: "active", tier: 2, priority: 0, has_api_key: 0, cooldown_until: null, task_lane: "build" },
        { id: "p2", name: "Free", state: "active", tier: 0, priority: 1, has_api_key: 0, cooldown_until: null, task_lane: "build" },
      ];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const res = await resolveTaskLane(env as any, "build");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.resolved.name).toBe("Free");
      expect(body.skipped[0].reason).toContain("API key");
    });

    it("returns 404 when no provider available", async () => {
      const { resolveTaskLane } = await import("../src/api/routes/providers/handlers");
      const rows = [
        { id: "p1", name: "Sleeping", state: "sleeping", tier: 0, priority: 0, has_api_key: 0, cooldown_until: null, task_lane: "review" },
      ];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const res = await resolveTaskLane(env as any, "review");
      const body = await res.json() as any;
      expect(res.status).toBe(404);
      expect(body.resolved).toBeNull();
      expect(body.message).toContain("No available provider");
    });
  });
});
