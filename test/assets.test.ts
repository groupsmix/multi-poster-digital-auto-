import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Asset library handler tests.
 *
 * Tests the asset CRUD handlers in isolation by mocking D1 and R2 env.
 * Follows the same pattern as crud.test.ts.
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

function makeMockR2Bucket() {
  return {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
    head: vi.fn().mockResolvedValue(null),
  };
}

function makeMockEnv(
  stmtOrFn?: ReturnType<typeof makeMockStmt> | ((query: string) => ReturnType<typeof makeMockStmt>),
  r2Bucket?: ReturnType<typeof makeMockR2Bucket>,
) {
  const defaultStmt = makeMockStmt();
  return {
    DB: {
      prepare: vi.fn((query: string) => {
        if (typeof stmtOrFn === "function") return stmtOrFn(query);
        return stmtOrFn ?? defaultStmt;
      }),
    },
    CACHE: {},
    ASSETS_BUCKET: r2Bucket ?? makeMockR2Bucket(),
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

// ── listAssets tests ────────────────────────────────────────

describe("assets/handlers", () => {
  describe("listAssets", () => {
    it("returns list from DB", async () => {
      const { listAssets } = await import("../src/api/routes/assets/handlers");
      const rows = [
        { id: "ast_1", filename: "logo.png", type: "image", is_active: 1 },
      ];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const req = makeRequest("GET", "http://localhost/api/assets");
      const res = await listAssets(req, env as any);
      const body = (await res.json()) as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it("filters by product_id", async () => {
      const { listAssets } = await import("../src/api/routes/assets/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest(
        "GET",
        "http://localhost/api/assets?product_id=prod_1",
      );
      await listAssets(req, env as any);
      const prepareCall = env.DB.prepare.mock.calls[0][0] as string;
      expect(prepareCall).toContain("product_id = ?");
    });

    it("filters by type", async () => {
      const { listAssets } = await import("../src/api/routes/assets/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest(
        "GET",
        "http://localhost/api/assets?type=image",
      );
      await listAssets(req, env as any);
      const prepareCall = env.DB.prepare.mock.calls[0][0] as string;
      expect(prepareCall).toContain("type = ?");
    });

    it("rejects invalid type", async () => {
      const { listAssets } = await import("../src/api/routes/assets/handlers");
      const env = makeMockEnv();
      const req = makeRequest(
        "GET",
        "http://localhost/api/assets?type=invalid_type",
      );
      const res = await listAssets(req, env as any);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toContain("Invalid asset type");
    });
  });

  // ── listProductAssets tests ─────────────────────────────────

  describe("listProductAssets", () => {
    it("returns assets for a product", async () => {
      const { listProductAssets } = await import(
        "../src/api/routes/assets/handlers"
      );
      const rows = [
        { id: "ast_1", product_id: "prod_1", type: "image" },
      ];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const res = await listProductAssets(env as any, "prod_1");
      const body = (await res.json()) as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
    });
  });

  // ── getAsset tests ──────────────────────────────────────────

  describe("getAsset", () => {
    it("returns 404 when not found", async () => {
      const { getAsset } = await import("../src/api/routes/assets/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getAsset(env as any, "nonexistent");
      expect(res.status).toBe(404);
    });

    it("returns asset when found", async () => {
      const { getAsset } = await import("../src/api/routes/assets/handlers");
      const row = {
        id: "ast_1",
        filename: "logo.png",
        type: "image",
        is_active: 1,
      };
      const env = makeMockEnv(makeMockStmt({ firstResult: row }));
      const res = await getAsset(env as any, "ast_1");
      const body = (await res.json()) as any;
      expect(res.status).toBe(200);
      expect(body.data.filename).toBe("logo.png");
    });
  });

  // ── uploadAsset (JSON mode) tests ──────────────────────────

  describe("uploadAsset (JSON)", () => {
    it("returns 400 for missing filename", async () => {
      const { uploadAsset } = await import(
        "../src/api/routes/assets/handlers"
      );
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/assets", {
        type: "image",
      });
      const res = await uploadAsset(req, env as any);
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing type", async () => {
      const { uploadAsset } = await import(
        "../src/api/routes/assets/handlers"
      );
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/assets", {
        filename: "logo.png",
      });
      const res = await uploadAsset(req, env as any);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid type", async () => {
      const { uploadAsset } = await import(
        "../src/api/routes/assets/handlers"
      );
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/assets", {
        filename: "logo.png",
        type: "invalid",
      });
      const res = await uploadAsset(req, env as any);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toContain("Invalid asset type");
    });

    it("returns 400 when product_id not found", async () => {
      const { uploadAsset } = await import(
        "../src/api/routes/assets/handlers"
      );
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM products")) {
          return makeMockStmt({ firstResult: null });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/assets", {
        filename: "logo.png",
        type: "image",
        product_id: "nonexistent",
      });
      const res = await uploadAsset(req, env as any);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toContain("Product not found");
    });

    it("creates asset with R2 put and D1 insert", async () => {
      const { uploadAsset } = await import(
        "../src/api/routes/assets/handlers"
      );
      const created = {
        id: "ast_new",
        filename: "logo.png",
        type: "image",
        storage_key: "unlinked/ast_new/logo.png",
      };
      const stmtFn = (query: string) => {
        if (query.includes("INSERT INTO")) {
          return makeMockStmt();
        }
        if (query.includes("SELECT * FROM assets WHERE id")) {
          return makeMockStmt({ firstResult: created });
        }
        return makeMockStmt();
      };
      const r2 = makeMockR2Bucket();
      const env = makeMockEnv(stmtFn, r2);
      const req = makeRequest("POST", "http://localhost/api/assets", {
        filename: "logo.png",
        type: "image",
      });
      const res = await uploadAsset(req, env as any);
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.filename).toBe("logo.png");
      // Verify R2 put was called
      expect(r2.put).toHaveBeenCalled();
    });

    it("creates asset linked to product", async () => {
      const { uploadAsset } = await import(
        "../src/api/routes/assets/handlers"
      );
      const created = {
        id: "ast_new",
        filename: "logo.png",
        type: "image",
        product_id: "prod_1",
        storage_key: "prod_1/ast_new/logo.png",
      };
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM products")) {
          return makeMockStmt({ firstResult: { id: "prod_1" } });
        }
        if (query.includes("INSERT INTO")) {
          return makeMockStmt();
        }
        if (query.includes("SELECT * FROM assets WHERE id")) {
          return makeMockStmt({ firstResult: created });
        }
        return makeMockStmt();
      };
      const r2 = makeMockR2Bucket();
      const env = makeMockEnv(stmtFn, r2);
      const req = makeRequest("POST", "http://localhost/api/assets", {
        filename: "logo.png",
        type: "image",
        product_id: "prod_1",
      });
      const res = await uploadAsset(req, env as any);
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.product_id).toBe("prod_1");
      expect(r2.put).toHaveBeenCalled();
    });

    it("returns 400 for unsupported content type", async () => {
      const { uploadAsset } = await import(
        "../src/api/routes/assets/handlers"
      );
      const env = makeMockEnv();
      const req = new Request("http://localhost/api/assets", {
        method: "POST",
        body: "plain text",
        headers: { "Content-Type": "text/plain" },
      });
      const res = await uploadAsset(req, env as any);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toContain("Content-Type");
    });
  });

  // ── deleteAsset tests ──────────────────────────────────────

  describe("deleteAsset", () => {
    it("returns 404 when not found", async () => {
      const { deleteAsset } = await import(
        "../src/api/routes/assets/handlers"
      );
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await deleteAsset(env as any, "nonexistent");
      expect(res.status).toBe(404);
    });

    it("deletes from R2 then soft-deletes in D1", async () => {
      const { deleteAsset } = await import(
        "../src/api/routes/assets/handlers"
      );
      const existing = {
        id: "ast_1",
        storage_key: "prod_1/ast_1/logo.png",
        is_active: 1,
      };
      const stmtFn = (query: string) => {
        if (query.includes("SELECT * FROM assets WHERE id")) {
          return makeMockStmt({ firstResult: existing });
        }
        if (query.includes("UPDATE assets SET is_active")) {
          return makeMockStmt();
        }
        return makeMockStmt();
      };
      const r2 = makeMockR2Bucket();
      const env = makeMockEnv(stmtFn, r2);
      const res = await deleteAsset(env as any, "ast_1");
      const body = (await res.json()) as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("deleted");
      // Verify R2 delete was called with correct key
      expect(r2.delete).toHaveBeenCalledWith("prod_1/ast_1/logo.png");
    });
  });
});
