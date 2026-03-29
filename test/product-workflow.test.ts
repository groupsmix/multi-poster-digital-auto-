import { describe, it, expect, vi } from "vitest";

/**
 * Product Workflow Orchestration tests.
 *
 * Tests for product CRUD, variant CRUD, workflow run management,
 * and review/boss-approval handlers.
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
// ── Product CRUD Tests ──────────────────────────────────
// ═════════════════════════════════════════════════════════

describe("products/handlers", () => {
  describe("listProducts", () => {
    it("returns list from DB", async () => {
      const { listProducts } = await import("../src/api/routes/products/handlers");
      const rows = [{ id: "prod_1", idea: "Test product", status: "draft" }];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const req = makeRequest("GET", "http://localhost/api/products");
      const res = await listProducts(req, env as any);
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it("filters by domain_id", async () => {
      const { listProducts } = await import("../src/api/routes/products/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest("GET", "http://localhost/api/products?domain_id=dom_1");
      await listProducts(req, env as any);
      const query = env.DB.prepare.mock.calls[0][0] as string;
      expect(query).toContain("domain_id = ?");
    });

    it("filters by status", async () => {
      const { listProducts } = await import("../src/api/routes/products/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest("GET", "http://localhost/api/products?status=draft");
      await listProducts(req, env as any);
      const query = env.DB.prepare.mock.calls[0][0] as string;
      expect(query).toContain("status = ?");
    });
  });

  describe("getProduct", () => {
    it("returns 404 when not found", async () => {
      const { getProduct } = await import("../src/api/routes/products/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getProduct(env as any, "nonexistent");
      expect(res.status).toBe(404);
    });

    it("returns product with variants and latest run", async () => {
      const { getProduct } = await import("../src/api/routes/products/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1", idea: "Test" } });
        }
        if (query.includes("FROM product_variants")) {
          return makeMockStmt({ allResults: [{ id: "var_1", variant_type: "base" }] });
        }
        if (query.includes("FROM workflow_runs")) {
          return makeMockStmt({ firstResult: { id: "run_1", status: "running" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await getProduct(env as any, "prod_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data.id).toBe("prod_1");
      expect(body.data.variants).toHaveLength(1);
      expect(body.data.latest_run.id).toBe("run_1");
    });
  });

  describe("createProduct", () => {
    it("returns 400 for missing idea", async () => {
      const { createProduct } = await import("../src/api/routes/products/handlers");
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/products", {
        domain_id: "dom_1",
      });
      const res = await createProduct(req, env as any);
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing domain_id", async () => {
      const { createProduct } = await import("../src/api/routes/products/handlers");
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/products", {
        idea: "Test product",
      });
      const res = await createProduct(req, env as any);
      expect(res.status).toBe(400);
    });

    it("returns 400 when domain not found", async () => {
      const { createProduct } = await import("../src/api/routes/products/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM domains")) {
          return makeMockStmt({ firstResult: null });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products", {
        idea: "Test",
        domain_id: "nonexistent",
      });
      const res = await createProduct(req, env as any);
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("domain not found");
    });

    it("creates product successfully", async () => {
      const { createProduct } = await import("../src/api/routes/products/handlers");
      const created = { id: "prod_new", idea: "Great product", domain_id: "dom_1", status: "draft" };
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM domains WHERE id")) {
          return makeMockStmt({ firstResult: { id: "dom_1" } });
        }
        if (query.includes("INSERT INTO")) {
          return makeMockStmt();
        }
        if (query.includes("SELECT * FROM products WHERE id")) {
          return makeMockStmt({ firstResult: created });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products", {
        idea: "Great product",
        domain_id: "dom_1",
      });
      const res = await createProduct(req, env as any);
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.data.idea).toBe("Great product");
    });

    it("returns 400 for invalid target_platforms_json", async () => {
      const { createProduct } = await import("../src/api/routes/products/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM domains WHERE id")) {
          return makeMockStmt({ firstResult: { id: "dom_1" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products", {
        idea: "Test",
        domain_id: "dom_1",
        target_platforms_json: "not-valid-json{",
      });
      const res = await createProduct(req, env as any);
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("target_platforms_json");
    });
  });

  describe("updateProduct", () => {
    it("returns 404 when product not found", async () => {
      const { updateProduct } = await import("../src/api/routes/products/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("PUT", "http://localhost/api/products/nope", { idea: "Updated" });
      const res = await updateProduct(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 when no fields provided", async () => {
      const { updateProduct } = await import("../src/api/routes/products/handlers");
      const existing = { id: "prod_1", idea: "Old" };
      const env = makeMockEnv(makeMockStmt({ firstResult: existing }));
      const req = makeRequest("PUT", "http://localhost/api/products/prod_1", {});
      const res = await updateProduct(req, env as any, "prod_1");
      expect(res.status).toBe(400);
    });
  });

  describe("deleteProduct", () => {
    it("returns 404 when product not found", async () => {
      const { deleteProduct } = await import("../src/api/routes/products/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await deleteProduct(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("archives product", async () => {
      const { deleteProduct } = await import("../src/api/routes/products/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM products")) {
          return makeMockStmt({ firstResult: { id: "prod_1" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await deleteProduct(env as any, "prod_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("archived");
    });
  });
});

// ═════════════════════════════════════════════════════════
// ── Product Variant Tests ───────────────────────────────
// ═════════════════════════════════════════════════════════

describe("products/variants", () => {
  describe("listProductVariants", () => {
    it("returns 404 when product not found", async () => {
      const { listProductVariants } = await import("../src/api/routes/products/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await listProductVariants(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns variants for product", async () => {
      const { listProductVariants } = await import("../src/api/routes/products/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM products")) {
          return makeMockStmt({ firstResult: { id: "prod_1" } });
        }
        if (query.includes("FROM product_variants")) {
          return makeMockStmt({ allResults: [{ id: "var_1" }, { id: "var_2" }] });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await listProductVariants(env as any, "prod_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(2);
    });
  });

  describe("createProductVariant", () => {
    it("returns 404 when product not found", async () => {
      const { createProductVariant } = await import("../src/api/routes/products/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/products/nope/variants", {});
      const res = await createProductVariant(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid variant_type", async () => {
      const { createProductVariant } = await import("../src/api/routes/products/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id, current_version FROM products")) {
          return makeMockStmt({ firstResult: { id: "prod_1", current_version: 1 } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/variants", {
        variant_type: "invalid",
      });
      const res = await createProductVariant(req, env as any, "prod_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("variant_type");
    });

    it("returns 400 when platform variant missing platform_id", async () => {
      const { createProductVariant } = await import("../src/api/routes/products/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id, current_version FROM products")) {
          return makeMockStmt({ firstResult: { id: "prod_1", current_version: 1 } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/variants", {
        variant_type: "platform",
      });
      const res = await createProductVariant(req, env as any, "prod_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("platform_id");
    });

    it("creates base variant successfully", async () => {
      const { createProductVariant } = await import("../src/api/routes/products/handlers");
      const created = { id: "var_new", variant_type: "base", status: "draft" };
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id, current_version FROM products")) {
          return makeMockStmt({ firstResult: { id: "prod_1", current_version: 1 } });
        }
        if (query.includes("INSERT INTO")) {
          return makeMockStmt();
        }
        if (query.includes("SELECT * FROM product_variants WHERE id")) {
          return makeMockStmt({ firstResult: created });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/variants", {
        variant_type: "base",
        title: "Test Variant",
      });
      const res = await createProductVariant(req, env as any, "prod_1");
      expect(res.status).toBe(201);
    });
  });

  describe("deleteVariant", () => {
    it("returns 404 when not found", async () => {
      const { deleteVariant } = await import("../src/api/routes/products/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await deleteVariant(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("archives variant", async () => {
      const { deleteVariant } = await import("../src/api/routes/products/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM product_variants")) {
          return makeMockStmt({ firstResult: { id: "var_1" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await deleteVariant(env as any, "var_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.message).toContain("archived");
    });
  });
});

// ═════════════════════════════════════════════════════════
// ── Workflow Run Tests ──────────────────────────────────
// ═════════════════════════════════════════════════════════

describe("workflows/handlers", () => {
  describe("startWorkflowRun", () => {
    it("returns 404 when product not found", async () => {
      const { startWorkflowRun } = await import("../src/api/routes/workflows/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/products/nope/workflows", {});
      const res = await startWorkflowRun(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 when active run exists", async () => {
      const { startWorkflowRun } = await import("../src/api/routes/workflows/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1", workflow_template_id: null } });
        }
        if (query.includes("FROM workflow_runs WHERE product_id") && query.includes("IN")) {
          return makeMockStmt({ firstResult: { id: "run_existing" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/workflows", {});
      const res = await startWorkflowRun(req, env as any, "prod_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("active workflow run");
    });

    it("returns 400 when template not found", async () => {
      const { startWorkflowRun } = await import("../src/api/routes/workflows/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1", workflow_template_id: "wft_missing" } });
        }
        if (query.includes("FROM workflow_runs WHERE product_id") && query.includes("IN")) {
          return makeMockStmt({ firstResult: null });
        }
        if (query.includes("FROM workflow_templates WHERE id")) {
          return makeMockStmt({ firstResult: null });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/workflows", {});
      const res = await startWorkflowRun(req, env as any, "prod_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("template not found");
    });
  });

  describe("listWorkflowRuns", () => {
    it("returns list from DB", async () => {
      const { listWorkflowRuns } = await import("../src/api/routes/workflows/handlers");
      const rows = [{ id: "run_1", status: "running" }];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const req = makeRequest("GET", "http://localhost/api/workflows");
      const res = await listWorkflowRuns(req, env as any);
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
    });

    it("filters by product_id", async () => {
      const { listWorkflowRuns } = await import("../src/api/routes/workflows/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest("GET", "http://localhost/api/workflows?product_id=prod_1");
      await listWorkflowRuns(req, env as any);
      const query = env.DB.prepare.mock.calls[0][0] as string;
      expect(query).toContain("product_id = ?");
    });
  });

  describe("getWorkflowRun", () => {
    it("returns 404 when not found", async () => {
      const { getWorkflowRun } = await import("../src/api/routes/workflows/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getWorkflowRun(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns run with steps", async () => {
      const { getWorkflowRun } = await import("../src/api/routes/workflows/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM workflow_runs WHERE id")) {
          return makeMockStmt({ firstResult: { id: "run_1", status: "running" } });
        }
        if (query.includes("FROM workflow_steps WHERE run_id")) {
          return makeMockStmt({ allResults: [{ id: "step_1" }, { id: "step_2" }] });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await getWorkflowRun(env as any, "run_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data.steps).toHaveLength(2);
    });
  });

  describe("completeWorkflowStep", () => {
    it("returns 404 when step not found", async () => {
      const { completeWorkflowStep } = await import("../src/api/routes/workflows/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/workflows/run_1/steps/step_1/complete", {});
      const res = await completeWorkflowStep(req, env as any, "run_1", "step_1");
      expect(res.status).toBe(404);
    });

    it("returns 400 when step already completed", async () => {
      const { completeWorkflowStep } = await import("../src/api/routes/workflows/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM workflow_steps WHERE id") && query.includes("AND run_id")) {
          return makeMockStmt({ firstResult: { id: "step_1", status: "completed" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/workflows/run_1/steps/step_1/complete", {});
      const res = await completeWorkflowStep(req, env as any, "run_1", "step_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("already completed");
    });
  });

  describe("failWorkflowStep", () => {
    it("returns 404 when step not found", async () => {
      const { failWorkflowStep } = await import("../src/api/routes/workflows/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/workflows/run_1/steps/step_1/fail", {});
      const res = await failWorkflowStep(req, env as any, "run_1", "step_1");
      expect(res.status).toBe(404);
    });
  });
});

// ═════════════════════════════════════════════════════════
// ── Review & Boss Approval Tests ────────────────────────
// ═════════════════════════════════════════════════════════

describe("reviews/handlers", () => {
  describe("createReview", () => {
    it("returns 404 when product not found", async () => {
      const { createReview } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/products/nope/reviews", {
        reviewer_type: "boss",
      });
      const res = await createReview(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 for missing reviewer_type", async () => {
      const { createReview } = await import("../src/api/routes/reviews/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1", current_version: 1 } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/reviews", {});
      const res = await createReview(req, env as any, "prod_1");
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid reviewer_type", async () => {
      const { createReview } = await import("../src/api/routes/reviews/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1", current_version: 1 } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/reviews", {
        reviewer_type: "invalid",
      });
      const res = await createReview(req, env as any, "prod_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("reviewer_type");
    });

    it("creates review successfully", async () => {
      const { createReview } = await import("../src/api/routes/reviews/handlers");
      const created = { id: "rev_1", reviewer_type: "boss", approval_status: "pending" };
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1", current_version: 1 } });
        }
        if (query.includes("INSERT INTO reviews")) {
          return makeMockStmt();
        }
        if (query.includes("UPDATE products")) {
          return makeMockStmt();
        }
        if (query.includes("FROM reviews WHERE id")) {
          return makeMockStmt({ firstResult: created });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/reviews", {
        reviewer_type: "boss",
        feedback: "Looks good",
      });
      const res = await createReview(req, env as any, "prod_1");
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.data.approval_status).toBe("pending");
    });
  });

  describe("approveReview", () => {
    it("returns 404 when review not found", async () => {
      const { approveReview } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/reviews/nope/approve", {});
      const res = await approveReview(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 when already approved", async () => {
      const { approveReview } = await import("../src/api/routes/reviews/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM reviews WHERE id")) {
          return makeMockStmt({ firstResult: { id: "rev_1", approval_status: "approved" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/approve", {});
      const res = await approveReview(req, env as any, "rev_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("already approved");
    });
  });

  describe("rejectReview", () => {
    it("returns 404 when review not found", async () => {
      const { rejectReview } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/reviews/nope/reject", {
        feedback: "Not good",
      });
      const res = await rejectReview(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 for missing feedback", async () => {
      const { rejectReview } = await import("../src/api/routes/reviews/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM reviews WHERE id")) {
          return makeMockStmt({ firstResult: { id: "rev_1", approval_status: "pending" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/reject", {});
      const res = await rejectReview(req, env as any, "rev_1");
      expect(res.status).toBe(400);
    });
  });

  describe("requestRevision", () => {
    it("returns 404 when review not found", async () => {
      const { requestRevision } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/reviews/nope/revision", {
        feedback: "Please update",
      });
      const res = await requestRevision(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 for missing feedback", async () => {
      const { requestRevision } = await import("../src/api/routes/reviews/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM reviews WHERE id")) {
          return makeMockStmt({ firstResult: { id: "rev_1", approval_status: "pending", version: 1, product_id: "prod_1" } });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/revision", {});
      const res = await requestRevision(req, env as any, "rev_1");
      expect(res.status).toBe(400);
    });

    it("creates revision and bumps version", async () => {
      const { requestRevision } = await import("../src/api/routes/reviews/handlers");
      const revision = { id: "revn_1", version_from: 1, version_to: 2 };
      const stmtFn = (query: string) => {
        if (query.includes("FROM reviews WHERE id")) {
          return makeMockStmt({
            firstResult: { id: "rev_1", approval_status: "pending", version: 1, product_id: "prod_1" },
          });
        }
        if (query.includes("UPDATE reviews")) {
          return makeMockStmt();
        }
        if (query.includes("INSERT INTO revisions")) {
          return makeMockStmt();
        }
        if (query.includes("UPDATE products")) {
          return makeMockStmt();
        }
        if (query.includes("FROM revisions WHERE id")) {
          return makeMockStmt({ firstResult: revision });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/revision", {
        feedback: "Please update the description",
      });
      const res = await requestRevision(req, env as any, "rev_1");
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.message).toContain("Revision requested");
      expect(body.message).toContain("v2");
    });
  });

  describe("listPendingReviews", () => {
    it("returns pending reviews", async () => {
      const { listPendingReviews } = await import("../src/api/routes/reviews/handlers");
      const rows = [{ id: "rev_1", approval_status: "pending" }];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const req = makeRequest("GET", "http://localhost/api/reviews");
      const res = await listPendingReviews(req, env as any);
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
    });

    it("filters by reviewer_type", async () => {
      const { listPendingReviews } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest("GET", "http://localhost/api/reviews?reviewer_type=boss");
      await listPendingReviews(req, env as any);
      const query = env.DB.prepare.mock.calls[0][0] as string;
      expect(query).toContain("reviewer_type = ?");
    });
  });
});
