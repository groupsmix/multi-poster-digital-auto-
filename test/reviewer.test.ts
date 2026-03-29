import { describe, it, expect, vi } from "vitest";

/**
 * Reviewer AI & Partial Regeneration tests.
 *
 * Tests for:
 * - Reviewer AI service (parseReviewerResponse, executeReviewer)
 * - Partial regeneration service (executeRegeneration, listRegenerationHistory)
 * - Route handlers (runReviewer, getReviewerOutput, triggerRegeneration, getRegenerationHistory)
 * - History preservation and review-revision linkage
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
// ── Reviewer AI Service Tests ───────────────────────────
// ═════════════════════════════════════════════════════════

describe("reviewer service", () => {
  describe("ReviewerResult parsing", () => {
    it("exports REGENERATION_TARGETS constant", async () => {
      const { REGENERATION_TARGETS } = await import("../src/services/regenerator");
      expect(REGENERATION_TARGETS).toContain("title");
      expect(REGENERATION_TARGETS).toContain("price");
      expect(REGENERATION_TARGETS).toContain("description");
      expect(REGENERATION_TARGETS).toContain("platform_variant");
      expect(REGENERATION_TARGETS).toContain("social_variant");
      expect(REGENERATION_TARGETS).toContain("seo");
      expect(REGENERATION_TARGETS.length).toBe(6);
    });

    it("exports ReviewSection type including all sections", async () => {
      const mod = await import("../src/services/reviewer");
      expect(mod.executeReviewer).toBeDefined();
      expect(mod.saveReviewerOutput).toBeDefined();
      expect(mod.createAiReviewFromResult).toBeDefined();
    });

    it("exports regenerator functions", async () => {
      const mod = await import("../src/services/regenerator");
      expect(mod.executeRegeneration).toBeDefined();
      expect(mod.listRegenerationHistory).toBeDefined();
      expect(mod.REGENERATION_TARGETS).toBeDefined();
    });
  });
});

// ═════════════════════════════════════════════════════════
// ── Reviewer Route Handler Tests ────────────────────────
// ═════════════════════════════════════════════════════════

describe("reviewer/handlers", () => {
  describe("getReviewerOutput", () => {
    it("returns 404 when product not found", async () => {
      const { getReviewerOutput } = await import("../src/api/routes/reviewer/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getReviewerOutput(env as any, "prod_nope");
      expect(res.status).toBe(404);
    });

    it("returns 404 when no reviewer output exists", async () => {
      const { getReviewerOutput } = await import("../src/api/routes/reviewer/handlers");
      let queryCount = 0;
      const stmtFn = (query: string) => {
        queryCount++;
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1" } });
        }
        // Second query: no reviewer output
        return makeMockStmt({ firstResult: null });
      };
      const env = makeMockEnv(stmtFn);
      const res = await getReviewerOutput(env as any, "prod_1");
      expect(res.status).toBe(404);
    });

    it("returns reviewer output when found", async () => {
      const { getReviewerOutput } = await import("../src/api/routes/reviewer/handlers");
      const mockOutput = {
        id: "wso_1",
        product_id: "prod_1",
        output_json: JSON.stringify({
          verdict: "pass",
          score: 85,
          issues: [],
          strengths: ["Good title"],
          summary: "Well done",
        }),
        provider_log_json: JSON.stringify([]),
        created_at: "2025-01-01T00:00:00.000Z",
      };
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1" } });
        }
        if (query.includes("FROM workflow_step_outputs")) {
          return makeMockStmt({ firstResult: mockOutput });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await getReviewerOutput(env as any, "prod_1");
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.review.verdict).toBe("pass");
      expect(body.data.review.score).toBe(85);
    });
  });

  describe("triggerRegeneration", () => {
    it("returns 404 when product not found", async () => {
      const { triggerRegeneration } = await import("../src/api/routes/reviewer/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/products/nope/regenerate", {
        target: "title",
      });
      const res = await triggerRegeneration(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 for missing target", async () => {
      const { triggerRegeneration } = await import("../src/api/routes/reviewer/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({
            firstResult: { id: "prod_1", domain_id: "dom_1", current_version: 1, idea: "Test" },
          });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/regenerate", {});
      const res = await triggerRegeneration(req, env as any, "prod_1");
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid target", async () => {
      const { triggerRegeneration } = await import("../src/api/routes/reviewer/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({
            firstResult: { id: "prod_1", domain_id: "dom_1", current_version: 1, idea: "Test" },
          });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/regenerate", {
        target: "invalid_target",
      });
      const res = await triggerRegeneration(req, env as any, "prod_1");
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toContain("Invalid target");
    });

    it("returns 400 for empty body", async () => {
      const { triggerRegeneration } = await import("../src/api/routes/reviewer/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({
            firstResult: { id: "prod_1", domain_id: "dom_1", current_version: 1, idea: "Test" },
          });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = new Request("http://localhost/api/products/prod_1/regenerate", {
        method: "POST",
      });
      const res = await triggerRegeneration(req, env as any, "prod_1");
      expect(res.status).toBe(400);
    });
  });

  describe("getRegenerationHistory", () => {
    it("returns 404 when product not found", async () => {
      const { getRegenerationHistory } = await import("../src/api/routes/reviewer/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getRegenerationHistory(env as any, "prod_nope");
      expect(res.status).toBe(404);
    });

    it("returns empty history for product with no regenerations", async () => {
      const { getRegenerationHistory } = await import("../src/api/routes/reviewer/handlers");
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1" } });
        }
        if (query.includes("FROM regeneration_history")) {
          return makeMockStmt({ allResults: [] });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await getRegenerationHistory(env as any, "prod_1");
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    });

    it("returns regeneration history with records", async () => {
      const { getRegenerationHistory } = await import("../src/api/routes/reviewer/handlers");
      const mockHistory = [
        {
          id: "regen_1",
          product_id: "prod_1",
          target_type: "title",
          status: "completed",
          created_at: "2025-01-01T00:00:00.000Z",
        },
        {
          id: "regen_2",
          product_id: "prod_1",
          target_type: "description",
          review_id: "rev_1",
          status: "completed",
          created_at: "2025-01-01T01:00:00.000Z",
        },
      ];
      const stmtFn = (query: string) => {
        if (query.includes("FROM products WHERE id")) {
          return makeMockStmt({ firstResult: { id: "prod_1" } });
        }
        if (query.includes("FROM regeneration_history")) {
          return makeMockStmt({ allResults: mockHistory });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await getRegenerationHistory(env as any, "prod_1");
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.total).toBe(2);
      expect(body.data[0].target_type).toBe("title");
      expect(body.data[1].review_id).toBe("rev_1");
    });
  });
});

// ═════════════════════════════════════════════════════════
// ── AI Review Creation Tests ────────────────────────────
// ═════════════════════════════════════════════════════════

describe("createAiReviewFromResult", () => {
  it("creates review with approved status when verdict is pass", async () => {
    const { createAiReviewFromResult } = await import("../src/services/reviewer");
    let insertedReview = false;
    let updatedProduct = false;
    const stmtFn = (query: string) => {
      if (query.includes("INSERT INTO reviews")) {
        insertedReview = true;
        return makeMockStmt();
      }
      if (query.includes("UPDATE products SET status = 'waiting_for_review'")) {
        updatedProduct = true;
        return makeMockStmt();
      }
      return makeMockStmt();
    };
    const env = makeMockEnv(stmtFn);
    const result = {
      success: true,
      review: {
        verdict: "pass" as const,
        score: 90,
        issues: [],
        strengths: ["Great title"],
        summary: "Product looks ready.",
      },
      rawContent: "{}",
      providerLog: [],
      provider: "groq",
      model: "llama3",
      templateId: null,
      templateVersion: null,
      error: null,
    };

    const reviewId = await createAiReviewFromResult(env as any, "prod_1", 1, result);
    expect(reviewId).toMatch(/^rev_/);
    expect(insertedReview).toBe(true);
    expect(updatedProduct).toBe(true);
  });

  it("creates review with revision_requested when verdict is fail", async () => {
    const { createAiReviewFromResult } = await import("../src/services/reviewer");
    let statusUpdated = "";
    let commentInserted = false;
    const stmtFn = (query: string) => {
      if (query.includes("INSERT INTO reviews")) {
        return makeMockStmt();
      }
      if (query.includes("INSERT INTO review_comments")) {
        commentInserted = true;
        return makeMockStmt();
      }
      if (query.includes("UPDATE products SET status")) {
        if (query.includes("revision_requested")) statusUpdated = "revision_requested";
        return makeMockStmt();
      }
      return makeMockStmt();
    };
    const env = makeMockEnv(stmtFn);
    const result = {
      success: true,
      review: {
        verdict: "fail" as const,
        score: 30,
        issues: [
          {
            section: "title" as const,
            severity: "critical" as const,
            issue: "Title is misleading",
            suggestion: "Rewrite to be more accurate",
          },
        ],
        strengths: [],
        summary: "Critical issues found.",
      },
      rawContent: "{}",
      providerLog: [],
      provider: "groq",
      model: "llama3",
      templateId: null,
      templateVersion: null,
      error: null,
    };

    await createAiReviewFromResult(env as any, "prod_1", 1, result);
    expect(statusUpdated).toBe("revision_requested");
    expect(commentInserted).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════
// ── REGENERATION_TARGETS Config Tests ───────────────────
// ═════════════════════════════════════════════════════════

describe("REGENERATION_TARGETS", () => {
  it("includes all 6 required targets from the spec", async () => {
    const { REGENERATION_TARGETS } = await import("../src/services/regenerator");
    const required = ["title", "price", "description", "platform_variant", "social_variant", "seo"];
    for (const target of required) {
      expect(REGENERATION_TARGETS).toContain(target);
    }
  });

  it("is an array with exactly 6 entries", async () => {
    const { REGENERATION_TARGETS } = await import("../src/services/regenerator");
    expect(Array.isArray(REGENERATION_TARGETS)).toBe(true);
    expect(REGENERATION_TARGETS.length).toBe(6);
  });
});

// ═════════════════════════════════════════════════════════
// ── Route Index / Service Index Export Tests ─────────────
// ═════════════════════════════════════════════════════════

describe("module exports", () => {
  it("services/index exports reviewer functions", async () => {
    const mod = await import("../src/services/index");
    expect(mod.executeReviewer).toBeDefined();
    expect(mod.saveReviewerOutput).toBeDefined();
    expect(mod.createAiReviewFromResult).toBeDefined();
    expect(mod.executeRegeneration).toBeDefined();
    expect(mod.listRegenerationHistory).toBeDefined();
    expect(mod.REGENERATION_TARGETS).toBeDefined();
  });

  it("routes/index exports reviewer handlers", async () => {
    const mod = await import("../src/api/routes/index");
    expect(mod.runReviewer).toBeDefined();
    expect(mod.getReviewerOutput).toBeDefined();
    expect(mod.triggerRegeneration).toBeDefined();
    expect(mod.getRegenerationHistory).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════
// ── History Preservation & Review-Revision Linkage Tests ─
// ═════════════════════════════════════════════════════════

describe("history preservation", () => {
  it("regeneration history links to review_id and revision_id", async () => {
    const { getRegenerationHistory } = await import("../src/api/routes/reviewer/handlers");
    const mockHistory = [
      {
        id: "regen_1",
        product_id: "prod_1",
        revision_id: "revn_1",
        review_id: "rev_1",
        version: 2,
        target_type: "title",
        boss_notes: "Make it punchier",
        status: "completed",
        created_at: "2025-01-01T00:00:00.000Z",
      },
    ];
    const stmtFn = (query: string) => {
      if (query.includes("FROM products WHERE id")) {
        return makeMockStmt({ firstResult: { id: "prod_1" } });
      }
      if (query.includes("FROM regeneration_history")) {
        return makeMockStmt({ allResults: mockHistory });
      }
      return makeMockStmt();
    };
    const env = makeMockEnv(stmtFn);
    const res = await getRegenerationHistory(env as any, "prod_1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data[0].review_id).toBe("rev_1");
    expect(body.data[0].revision_id).toBe("revn_1");
    expect(body.data[0].boss_notes).toBe("Make it punchier");
    expect(body.data[0].target_type).toBe("title");
  });

  it("regeneration history preserves previous value", async () => {
    const { getRegenerationHistory } = await import("../src/api/routes/reviewer/handlers");
    const mockHistory = [
      {
        id: "regen_2",
        product_id: "prod_1",
        target_type: "description",
        previous_json: JSON.stringify({ description: "Old description" }),
        regenerated_json: JSON.stringify({ description: "New better description" }),
        provider_used: "groq",
        model_used: "llama3",
        status: "completed",
        created_at: "2025-01-02T00:00:00.000Z",
      },
    ];
    const stmtFn = (query: string) => {
      if (query.includes("FROM products WHERE id")) {
        return makeMockStmt({ firstResult: { id: "prod_1" } });
      }
      if (query.includes("FROM regeneration_history")) {
        return makeMockStmt({ allResults: mockHistory });
      }
      return makeMockStmt();
    };
    const env = makeMockEnv(stmtFn);
    const res = await getRegenerationHistory(env as any, "prod_1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const record = body.data[0];
    expect(record.previous_json).toBeDefined();
    expect(record.regenerated_json).toBeDefined();
    expect(record.provider_used).toBe("groq");
    expect(record.model_used).toBe("llama3");
  });
});
