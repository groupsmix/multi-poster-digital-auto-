import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * CRUD handler tests.
 *
 * These test the handler functions in isolation by mocking the D1 env.
 * Each test verifies request parsing, validation, and response shape
 * without requiring a running Worker or real database.
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

// ── Domain handler tests ─────────────────────────────────

describe("domains/handlers", () => {
  describe("listDomains", () => {
    it("returns list from DB", async () => {
      const { listDomains } = await import("../src/api/routes/domains/handlers");
      const rows = [{ id: "dom_1", name: "Test", slug: "test" }];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const req = makeRequest("GET", "http://localhost/api/domains");
      const res = await listDomains(req, env as any);
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it("filters by active=true", async () => {
      const { listDomains } = await import("../src/api/routes/domains/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest("GET", "http://localhost/api/domains?active=true");
      await listDomains(req, env as any);
      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining("is_active = 1"),
      );
    });
  });

  describe("getDomain", () => {
    it("returns 404 when not found", async () => {
      const { getDomain } = await import("../src/api/routes/domains/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getDomain(env as any, "nonexistent");
      expect(res.status).toBe(404);
    });

    it("returns domain when found", async () => {
      const { getDomain } = await import("../src/api/routes/domains/handlers");
      const row = { id: "dom_1", name: "Test", slug: "test" };
      const env = makeMockEnv(makeMockStmt({ firstResult: row }));
      const res = await getDomain(env as any, "dom_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data.name).toBe("Test");
    });
  });

  describe("createDomain", () => {
    it("returns 400 for missing name", async () => {
      const { createDomain } = await import("../src/api/routes/domains/handlers");
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/domains", {});
      const res = await createDomain(req, env as any);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON", async () => {
      const { createDomain } = await import("../src/api/routes/domains/handlers");
      const env = makeMockEnv();
      const req = new Request("http://localhost/api/domains", {
        method: "POST",
        body: "not json",
      });
      const res = await createDomain(req, env as any);
      expect(res.status).toBe(400);
    });

    it("returns 400 for duplicate slug", async () => {
      const { createDomain } = await import("../src/api/routes/domains/handlers");
      // First call (slug check) returns existing, second (insert) never reached
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM domains WHERE slug")) {
          return makeMockStmt({ firstResult: { id: "dom_existing" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/domains", {
        name: "Test Domain",
      });
      const res = await createDomain(req, env as any);
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("already exists");
    });

    it("creates domain with auto-generated slug", async () => {
      const { createDomain } = await import("../src/api/routes/domains/handlers");
      const created = { id: "dom_new", name: "Test Domain", slug: "test-domain" };
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM domains WHERE slug")) {
          return makeMockStmt({ firstResult: null });
        }
        if (query.includes("INSERT INTO")) {
          return makeMockStmt();
        }
        if (query.includes("SELECT * FROM domains WHERE id")) {
          return makeMockStmt({ firstResult: created });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/domains", {
        name: "Test Domain",
      });
      const res = await createDomain(req, env as any);
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.data.name).toBe("Test Domain");
    });
  });

  describe("updateDomain", () => {
    it("returns 404 when domain not found", async () => {
      const { updateDomain } = await import("../src/api/routes/domains/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("PUT", "http://localhost/api/domains/nope", {
        name: "Updated",
      });
      const res = await updateDomain(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 when no fields provided", async () => {
      const { updateDomain } = await import("../src/api/routes/domains/handlers");
      const existing = { id: "dom_1", name: "Old", slug: "old" };
      const env = makeMockEnv(makeMockStmt({ firstResult: existing }));
      const req = makeRequest("PUT", "http://localhost/api/domains/dom_1", {});
      const res = await updateDomain(req, env as any, "dom_1");
      expect(res.status).toBe(400);
    });
  });

  describe("deleteDomain", () => {
    it("returns 404 when domain not found", async () => {
      const { deleteDomain } = await import("../src/api/routes/domains/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await deleteDomain(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("soft-deletes domain", async () => {
      const { deleteDomain } = await import("../src/api/routes/domains/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM domains")) {
          return makeMockStmt({ firstResult: { id: "dom_1" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await deleteDomain(env as any, "dom_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("deactivated");
    });
  });
});

// ── Category handler tests ───────────────────────────────

describe("categories/handlers", () => {
  describe("createCategory", () => {
    it("returns 400 for missing required fields", async () => {
      const { createCategory } = await import("../src/api/routes/categories/handlers");
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/categories", {});
      const res = await createCategory(req, env as any);
      expect(res.status).toBe(400);
    });

    it("returns 400 when parent domain not found", async () => {
      const { createCategory } = await import("../src/api/routes/categories/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM domains")) {
          return makeMockStmt({ firstResult: null });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/categories", {
        domain_id: "nonexistent",
        name: "Test",
      });
      const res = await createCategory(req, env as any);
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("domain not found");
    });

    it("returns 400 for duplicate slug within domain", async () => {
      const { createCategory } = await import("../src/api/routes/categories/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM domains")) {
          return makeMockStmt({ firstResult: { id: "dom_1" } });
        }
        if (query.includes("SELECT id FROM categories")) {
          return makeMockStmt({ firstResult: { id: "cat_existing" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/categories", {
        domain_id: "dom_1",
        name: "Planners",
      });
      const res = await createCategory(req, env as any);
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("already exists");
    });
  });

  describe("listCategories", () => {
    it("filters by domain_id query param", async () => {
      const { listCategories } = await import("../src/api/routes/categories/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest("GET", "http://localhost/api/categories?domain_id=dom_1");
      await listCategories(req, env as any);
      const prepareCall = env.DB.prepare.mock.calls[0][0] as string;
      expect(prepareCall).toContain("domain_id = ?");
    });
  });

  describe("deleteCategory", () => {
    it("soft-deletes category", async () => {
      const { deleteCategory } = await import("../src/api/routes/categories/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM categories")) {
          return makeMockStmt({ firstResult: { id: "cat_1" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await deleteCategory(env as any, "cat_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("deactivated");
    });
  });
});

// ── Platform handler tests ───────────────────────────────

describe("platforms/handlers", () => {
  describe("listPlatforms", () => {
    it("returns list from DB", async () => {
      const { listPlatforms } = await import("../src/api/routes/platforms/handlers");
      const rows = [{ id: "plat_1", name: "Etsy" }];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const req = makeRequest("GET", "http://localhost/api/platforms");
      const res = await listPlatforms(req, env as any);
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
    });
  });

  describe("createPlatform", () => {
    it("returns 400 for missing name", async () => {
      const { createPlatform } = await import("../src/api/routes/platforms/handlers");
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/platforms", {});
      const res = await createPlatform(req, env as any);
      expect(res.status).toBe(400);
    });

    it("returns 400 for duplicate name", async () => {
      const { createPlatform } = await import("../src/api/routes/platforms/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM platforms WHERE name")) {
          return makeMockStmt({ firstResult: { id: "plat_existing" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/platforms", {
        name: "Etsy",
      });
      const res = await createPlatform(req, env as any);
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("already exists");
    });

    it("creates platform with all fields", async () => {
      const { createPlatform } = await import("../src/api/routes/platforms/handlers");
      const created = { id: "plat_new", name: "NewPlatform", title_limit: 200 };
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM platforms WHERE name")) {
          return makeMockStmt({ firstResult: null });
        }
        if (query.includes("INSERT INTO")) {
          return makeMockStmt();
        }
        if (query.includes("SELECT * FROM platforms WHERE id")) {
          return makeMockStmt({ firstResult: created });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/platforms", {
        name: "NewPlatform",
        title_limit: 200,
        tone_profile: "professional",
        cta_style: "Buy Now",
      });
      const res = await createPlatform(req, env as any);
      expect(res.status).toBe(201);
    });
  });

  describe("deletePlatform", () => {
    it("returns 404 when not found", async () => {
      const { deletePlatform } = await import("../src/api/routes/platforms/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await deletePlatform(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("soft-deletes platform", async () => {
      const { deletePlatform } = await import("../src/api/routes/platforms/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM platforms")) {
          return makeMockStmt({ firstResult: { id: "plat_1" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await deletePlatform(env as any, "plat_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("deactivated");
    });
  });
});

// ── Social channel handler tests ─────────────────────────

describe("social-channels/handlers", () => {
  describe("listSocialChannels", () => {
    it("returns list from DB", async () => {
      const { listSocialChannels } = await import("../src/api/routes/social-channels/handlers");
      const rows = [{ id: "sc_1", name: "Instagram" }];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const req = makeRequest("GET", "http://localhost/api/social-channels");
      const res = await listSocialChannels(req, env as any);
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
    });
  });

  describe("createSocialChannel", () => {
    it("returns 400 for missing name", async () => {
      const { createSocialChannel } = await import("../src/api/routes/social-channels/handlers");
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/social-channels", {});
      const res = await createSocialChannel(req, env as any);
      expect(res.status).toBe(400);
    });

    it("returns 400 for duplicate name", async () => {
      const { createSocialChannel } = await import("../src/api/routes/social-channels/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM social_channels WHERE name")) {
          return makeMockStmt({ firstResult: { id: "sc_existing" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/social-channels", {
        name: "Instagram",
      });
      const res = await createSocialChannel(req, env as any);
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("already exists");
    });

    it("creates social channel with all fields", async () => {
      const { createSocialChannel } = await import("../src/api/routes/social-channels/handlers");
      const created = { id: "sc_new", name: "Threads" };
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM social_channels WHERE name")) {
          return makeMockStmt({ firstResult: null });
        }
        if (query.includes("INSERT INTO")) {
          return makeMockStmt();
        }
        if (query.includes("SELECT * FROM social_channels WHERE id")) {
          return makeMockStmt({ firstResult: created });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/social-channels", {
        name: "Threads",
        tone_profile: "casual, trend-aware",
        hashtag_rules: "3-5 hashtags",
      });
      const res = await createSocialChannel(req, env as any);
      expect(res.status).toBe(201);
    });
  });

  describe("deleteSocialChannel", () => {
    it("returns 404 when not found", async () => {
      const { deleteSocialChannel } = await import("../src/api/routes/social-channels/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await deleteSocialChannel(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("soft-deletes social channel", async () => {
      const { deleteSocialChannel } = await import("../src/api/routes/social-channels/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM social_channels")) {
          return makeMockStmt({ firstResult: { id: "sc_1" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await deleteSocialChannel(env as any, "sc_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("deactivated");
    });
  });
});

// ── Prompt template handler tests ────────────────────────

describe("prompts/handlers", () => {
  describe("listPromptTemplates", () => {
    it("returns list from DB", async () => {
      const { listPromptTemplates } = await import("../src/api/routes/prompts/handlers");
      const rows = [{ id: "pt_1", name: "Master", role_type: "master", version: 1 }];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const req = makeRequest("GET", "http://localhost/api/prompts");
      const res = await listPromptTemplates(req, env as any);
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
    });

    it("filters by role_type", async () => {
      const { listPromptTemplates } = await import("../src/api/routes/prompts/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest("GET", "http://localhost/api/prompts?role_type=creator");
      await listPromptTemplates(req, env as any);
      const prepareCall = env.DB.prepare.mock.calls[0][0] as string;
      expect(prepareCall).toContain("role_type = ?");
    });
  });

  describe("getPromptTemplate", () => {
    it("returns 404 when not found", async () => {
      const { getPromptTemplate } = await import("../src/api/routes/prompts/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getPromptTemplate(env as any, "nonexistent");
      expect(res.status).toBe(404);
    });

    it("returns prompt when found", async () => {
      const { getPromptTemplate } = await import("../src/api/routes/prompts/handlers");
      const row = { id: "pt_1", name: "Master", role_type: "master", version: 1 };
      const env = makeMockEnv(makeMockStmt({ firstResult: row }));
      const res = await getPromptTemplate(env as any, "pt_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data.name).toBe("Master");
    });
  });

  describe("createPromptTemplate", () => {
    it("returns 400 for missing required fields", async () => {
      const { createPromptTemplate } = await import("../src/api/routes/prompts/handlers");
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/prompts", {});
      const res = await createPromptTemplate(req, env as any);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid role_type", async () => {
      const { createPromptTemplate } = await import("../src/api/routes/prompts/handlers");
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/prompts", {
        name: "Test",
        role_type: "invalid_role",
      });
      const res = await createPromptTemplate(req, env as any);
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("Invalid role_type");
    });

    it("creates prompt with auto-versioning (version 1)", async () => {
      const { createPromptTemplate } = await import("../src/api/routes/prompts/handlers");
      const created = { id: "pt_new", name: "Creator Prompt", role_type: "creator", version: 1 };
      const stmtFn = (query: string) => {
        if (query.includes("MAX(version)")) {
          return makeMockStmt({ firstResult: { max_v: null } });
        }
        if (query.includes("INSERT INTO")) {
          return makeMockStmt();
        }
        if (query.includes("SELECT * FROM prompt_templates WHERE id")) {
          return makeMockStmt({ firstResult: created });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/prompts", {
        name: "Creator Prompt",
        role_type: "creator",
        system_prompt: "# You are a creator\nGenerate product content.",
        quality_rules: "Must be original, SEO-optimized",
        output_schema: '{"title": "string", "description": "string"}',
      });
      const res = await createPromptTemplate(req, env as any);
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.data.version).toBe(1);
    });

    it("increments version for same name", async () => {
      const { createPromptTemplate } = await import("../src/api/routes/prompts/handlers");
      const created = { id: "pt_v2", name: "Creator Prompt", role_type: "creator", version: 2 };
      const stmtFn = (query: string) => {
        if (query.includes("MAX(version)")) {
          return makeMockStmt({ firstResult: { max_v: 1 } });
        }
        if (query.includes("INSERT INTO")) {
          return makeMockStmt();
        }
        if (query.includes("SELECT * FROM prompt_templates WHERE id")) {
          return makeMockStmt({ firstResult: created });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/prompts", {
        name: "Creator Prompt",
        role_type: "creator",
        system_prompt: "# Updated creator\nImproved content generation.",
      });
      const res = await createPromptTemplate(req, env as any);
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.data.version).toBe(2);
    });
  });

  describe("createPromptVersion", () => {
    it("returns 404 when source not found", async () => {
      const { createPromptVersion } = await import("../src/api/routes/prompts/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/prompts/nope/version", {});
      const res = await createPromptVersion(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("creates new version from source", async () => {
      const { createPromptVersion } = await import("../src/api/routes/prompts/handlers");
      const source = {
        id: "pt_1", name: "Creator Prompt", role_type: "creator", version: 1,
        system_prompt: "# Original", scope_type: null, scope_ref: null,
        domain_prompt: null, platform_prompt: null, social_prompt: null,
        category_prompt: null, quality_rules: null, output_schema: null,
        revision_prompt: null, notes: null,
      };
      const created = { ...source, id: "pt_v2", version: 2, system_prompt: "# Updated" };
      const stmtFn = (query: string) => {
        if (query.includes("SELECT * FROM prompt_templates WHERE id") && !query.includes("INSERT")) {
          // First call is source lookup, last call is fetch created
          return makeMockStmt({ firstResult: source });
        }
        if (query.includes("MAX(version)")) {
          return makeMockStmt({ firstResult: { max_v: 1 } });
        }
        if (query.includes("INSERT INTO")) {
          return makeMockStmt();
        }
        return makeMockStmt({ firstResult: created });
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/prompts/pt_1/version", {
        system_prompt: "# Updated",
      });
      const res = await createPromptVersion(req, env as any, "pt_1");
      expect(res.status).toBe(201);
    });
  });

  describe("activatePromptVersion", () => {
    it("returns 404 when not found", async () => {
      const { activatePromptVersion } = await import("../src/api/routes/prompts/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await activatePromptVersion(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("deactivates siblings and activates target", async () => {
      const { activatePromptVersion } = await import("../src/api/routes/prompts/handlers");
      const target = { id: "pt_2", name: "Creator Prompt", version: 2, is_active: 1 };
      let deactivatedAll = false;
      let activatedTarget = false;
      const stmtFn = (query: string) => {
        if (query.includes("SELECT * FROM prompt_templates WHERE id") && !deactivatedAll) {
          return makeMockStmt({ firstResult: target });
        }
        if (query.includes("SET is_active = 0") && query.includes("WHERE name")) {
          deactivatedAll = true;
          return makeMockStmt();
        }
        if (query.includes("SET is_active = 1") && query.includes("WHERE id")) {
          activatedTarget = true;
          return makeMockStmt();
        }
        return makeMockStmt({ firstResult: { ...target, is_active: 1 } });
      };
      const env = makeMockEnv(stmtFn);
      const res = await activatePromptVersion(env as any, "pt_2");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("activated");
      expect(deactivatedAll).toBe(true);
      expect(activatedTarget).toBe(true);
    });
  });

  describe("updatePromptTemplate", () => {
    it("returns 404 when not found", async () => {
      const { updatePromptTemplate } = await import("../src/api/routes/prompts/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("PUT", "http://localhost/api/prompts/nope", { name: "X" });
      const res = await updatePromptTemplate(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid role_type on update", async () => {
      const { updatePromptTemplate } = await import("../src/api/routes/prompts/handlers");
      const existing = { id: "pt_1", name: "Test", role_type: "master" };
      const env = makeMockEnv(makeMockStmt({ firstResult: existing }));
      const req = makeRequest("PUT", "http://localhost/api/prompts/pt_1", {
        role_type: "bad_role",
      });
      const res = await updatePromptTemplate(req, env as any, "pt_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("Invalid role_type");
    });

    it("returns 400 when no fields provided", async () => {
      const { updatePromptTemplate } = await import("../src/api/routes/prompts/handlers");
      const existing = { id: "pt_1", name: "Test", role_type: "master" };
      const env = makeMockEnv(makeMockStmt({ firstResult: existing }));
      const req = makeRequest("PUT", "http://localhost/api/prompts/pt_1", {});
      const res = await updatePromptTemplate(req, env as any, "pt_1");
      expect(res.status).toBe(400);
    });
  });

  describe("deletePromptTemplate", () => {
    it("returns 404 when not found", async () => {
      const { deletePromptTemplate } = await import("../src/api/routes/prompts/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await deletePromptTemplate(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("soft-deletes prompt template", async () => {
      const { deletePromptTemplate } = await import("../src/api/routes/prompts/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM prompt_templates")) {
          return makeMockStmt({ firstResult: { id: "pt_1" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await deletePromptTemplate(env as any, "pt_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("deactivated");
    });
  });
});
