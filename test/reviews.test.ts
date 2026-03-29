import { describe, it, expect, vi } from "vitest";

/**
 * Review & Revision Loop tests.
 *
 * Tests for review CRUD, approve/reject/revision flow,
 * review comments, version history, and revision records.
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
// ── Create Review Tests ─────────────────────────────────
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
      const created = { id: "rev_1", product_id: "prod_1", version: 1, reviewer_type: "boss", approval_status: "pending" };
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
        if (query.includes("SELECT * FROM reviews WHERE id")) {
          return makeMockStmt({ firstResult: created });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/products/prod_1/reviews", {
        reviewer_type: "boss",
      });
      const res = await createReview(req, env as any, "prod_1");
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.data.approval_status).toBe("pending");
    });
  });

  // ═════════════════════════════════════════════════════════
  // ── Approve Review Tests ──────────────────────────────
  // ═════════════════════════════════════════════════════════

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
      const env = makeMockEnv(makeMockStmt({
        firstResult: { id: "rev_1", approval_status: "approved" },
      }));
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/approve", {});
      const res = await approveReview(req, env as any, "rev_1");
      expect(res.status).toBe(400);
    });

    it("approves review (boss) and updates product to approved", async () => {
      const { approveReview } = await import("../src/api/routes/reviews/handlers");
      const review = {
        id: "rev_1", product_id: "prod_1", version: 1,
        reviewer_type: "boss", approval_status: "pending",
      };
      const updated = { ...review, approval_status: "approved" };
      const stmtFn = (query: string) => {
        if (query.includes("SELECT * FROM reviews WHERE id") && !query.includes("UPDATE")) {
          return makeMockStmt({ firstResult: review });
        }
        if (query.includes("UPDATE reviews")) {
          return makeMockStmt();
        }
        if (query.includes("UPDATE products SET status = 'approved'")) {
          return makeMockStmt();
        }
        if (query.includes("SELECT * FROM reviews WHERE id")) {
          return makeMockStmt({ firstResult: updated });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/approve", {});
      const res = await approveReview(req, env as any, "rev_1");
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.message).toContain("approved by Boss");
    });

    it("approves with notes — stores feedback as comment", async () => {
      const { approveReview } = await import("../src/api/routes/reviews/handlers");
      const review = {
        id: "rev_1", product_id: "prod_1", version: 1,
        reviewer_type: "boss", approval_status: "pending",
      };
      let insertedComment = false;
      let selectCount = 0;
      const stmtFn = (query: string) => {
        if (query.includes("SELECT * FROM reviews WHERE id")) {
          selectCount++;
          if (selectCount === 1) return makeMockStmt({ firstResult: review });
          return makeMockStmt({ firstResult: { ...review, approval_status: "approved" } });
        }
        if (query.includes("UPDATE reviews")) {
          return makeMockStmt();
        }
        if (query.includes("INSERT INTO review_comments")) {
          insertedComment = true;
          return makeMockStmt();
        }
        if (query.includes("UPDATE products")) {
          return makeMockStmt();
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/approve", {
        feedback: "Looks good, just fix pricing later",
      });
      const res = await approveReview(req, env as any, "rev_1");
      expect(res.status).toBe(200);
      expect(insertedComment).toBe(true);
    });

    it("AI approval keeps product in waiting_for_review", async () => {
      const { approveReview } = await import("../src/api/routes/reviews/handlers");
      const review = {
        id: "rev_1", product_id: "prod_1", version: 1,
        reviewer_type: "ai", approval_status: "pending",
      };
      let selectCount = 0;
      const stmtFn = (query: string) => {
        if (query.includes("SELECT * FROM reviews WHERE id")) {
          selectCount++;
          if (selectCount === 1) return makeMockStmt({ firstResult: review });
          return makeMockStmt({ firstResult: { ...review, approval_status: "approved" } });
        }
        if (query.includes("UPDATE reviews")) {
          return makeMockStmt();
        }
        if (query.includes("UPDATE products")) {
          return makeMockStmt();
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/approve", {});
      const res = await approveReview(req, env as any, "rev_1");
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.message).toContain("Awaiting Boss approval");
    });
  });

  // ═════════════════════════════════════════════════════════
  // ── Reject Review Tests ───────────────────────────────
  // ═════════════════════════════════════════════════════════

  describe("rejectReview", () => {
    it("returns 404 when review not found", async () => {
      const { rejectReview } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/reviews/nope/reject", {
        feedback: "Bad output",
      });
      const res = await rejectReview(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 when feedback missing", async () => {
      const { rejectReview } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({
        firstResult: { id: "rev_1", approval_status: "pending", reviewer_type: "boss" },
      }));
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/reject", {});
      const res = await rejectReview(req, env as any, "rev_1");
      expect(res.status).toBe(400);
    });

    it("rejects review and stores notes as comment", async () => {
      const { rejectReview } = await import("../src/api/routes/reviews/handlers");
      const review = {
        id: "rev_1", product_id: "prod_1", version: 1,
        reviewer_type: "boss", approval_status: "pending",
      };
      let commentInserted = false;
      const stmtFn = (query: string) => {
        if (query.includes("SELECT * FROM reviews WHERE id")) {
          return makeMockStmt({ firstResult: { ...review, approval_status: "rejected" } });
        }
        if (query.includes("UPDATE reviews")) {
          return makeMockStmt();
        }
        if (query.includes("INSERT INTO review_comments")) {
          commentInserted = true;
          return makeMockStmt();
        }
        if (query.includes("UPDATE products")) {
          return makeMockStmt();
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/reject", {
        feedback: "Title is off-brand",
        issues_found: "branding",
      });
      const res = await rejectReview(req, env as any, "rev_1");
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.message).toContain("rejected");
      expect(commentInserted).toBe(true);
    });
  });

  // ═════════════════════════════════════════════════════════
  // ── Request Revision Tests ────────────────────────────
  // ═════════════════════════════════════════════════════════

  describe("requestRevision", () => {
    it("returns 404 when review not found", async () => {
      const { requestRevision } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/reviews/nope/revision", {
        feedback: "Fix description",
      });
      const res = await requestRevision(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 when feedback missing", async () => {
      const { requestRevision } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({
        firstResult: { id: "rev_1", approval_status: "pending", version: 1 },
      }));
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/revision", {});
      const res = await requestRevision(req, env as any, "rev_1");
      expect(res.status).toBe(400);
    });

    it("creates revision record and bumps version", async () => {
      const { requestRevision } = await import("../src/api/routes/reviews/handlers");
      const review = {
        id: "rev_1", product_id: "prod_1", version: 1,
        reviewer_type: "boss", approval_status: "pending",
      };
      const revisionRecord = {
        id: "revn_1", product_id: "prod_1",
        version_from: 1, version_to: 2,
        revision_reason: "Revision requested",
        boss_notes: "Fix the description",
        review_id: "rev_1",
      };
      let revisionInserted = false;
      let commentInserted = false;
      let versionBumped = false;
      const stmtFn = (query: string) => {
        if (query.includes("SELECT * FROM reviews WHERE id")) {
          return makeMockStmt({ firstResult: review });
        }
        if (query.includes("UPDATE reviews")) {
          return makeMockStmt();
        }
        if (query.includes("INSERT INTO review_comments")) {
          commentInserted = true;
          return makeMockStmt();
        }
        if (query.includes("INSERT INTO revisions")) {
          revisionInserted = true;
          return makeMockStmt();
        }
        if (query.includes("UPDATE products SET status = 'revision_requested'")) {
          versionBumped = true;
          return makeMockStmt();
        }
        if (query.includes("SELECT * FROM revisions WHERE id")) {
          return makeMockStmt({ firstResult: revisionRecord });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/revision", {
        feedback: "Fix the description",
        regenerate_targets_json: '["description", "etsy_variant"]',
      });
      const res = await requestRevision(req, env as any, "rev_1");
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.message).toContain("Version bumped to v2");
      expect(body.data.revision.version_from).toBe(1);
      expect(body.data.revision.version_to).toBe(2);
      expect(revisionInserted).toBe(true);
      expect(commentInserted).toBe(true);
      expect(versionBumped).toBe(true);
    });
  });

  // ═════════════════════════════════════════════════════════
  // ── List Pending Reviews Tests ────────────────────────
  // ═════════════════════════════════════════════════════════

  describe("listPendingReviews", () => {
    it("returns pending reviews", async () => {
      const { listPendingReviews } = await import("../src/api/routes/reviews/handlers");
      const rows = [
        { id: "rev_1", approval_status: "pending", idea: "Product 1" },
        { id: "rev_2", approval_status: "pending", idea: "Product 2" },
      ];
      const env = makeMockEnv(makeMockStmt({ allResults: rows }));
      const req = makeRequest("GET", "http://localhost/api/reviews");
      const res = await listPendingReviews(req, env as any);
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(2);
    });

    it("filters by reviewer_type", async () => {
      const { listPendingReviews } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest("GET", "http://localhost/api/reviews?reviewer_type=boss");
      await listPendingReviews(req, env as any);
      const query = env.DB.prepare.mock.calls[0][0] as string;
      expect(query).toContain("r.reviewer_type = ?");
    });

    it("filters by status", async () => {
      const { listPendingReviews } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ allResults: [] }));
      const req = makeRequest("GET", "http://localhost/api/reviews?status=rejected");
      await listPendingReviews(req, env as any);
      const query = env.DB.prepare.mock.calls[0][0] as string;
      expect(query).toContain("r.approval_status = ?");
    });
  });

  // ═════════════════════════════════════════════════════════
  // ── Review Comments Tests ─────────────────────────────
  // ═════════════════════════════════════════════════════════

  describe("addReviewComment", () => {
    it("returns 404 when review not found", async () => {
      const { addReviewComment } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const req = makeRequest("POST", "http://localhost/api/reviews/nope/comments", {
        comment: "Test comment",
      });
      const res = await addReviewComment(req, env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns 400 when comment missing", async () => {
      const { addReviewComment } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: { id: "rev_1" } }));
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/comments", {});
      const res = await addReviewComment(req, env as any, "rev_1");
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid author_type", async () => {
      const { addReviewComment } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: { id: "rev_1" } }));
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/comments", {
        comment: "Test",
        author_type: "invalid",
      });
      const res = await addReviewComment(req, env as any, "rev_1");
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toContain("author_type");
    });

    it("adds comment successfully", async () => {
      const { addReviewComment } = await import("../src/api/routes/reviews/handlers");
      const created = { id: "rc_1", review_id: "rev_1", author_type: "boss", comment: "Check pricing" };
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM reviews")) {
          return makeMockStmt({ firstResult: { id: "rev_1" } });
        }
        if (query.includes("INSERT INTO review_comments")) {
          return makeMockStmt();
        }
        if (query.includes("SELECT * FROM review_comments WHERE id")) {
          return makeMockStmt({ firstResult: created });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const req = makeRequest("POST", "http://localhost/api/reviews/rev_1/comments", {
        comment: "Check pricing",
        author_type: "boss",
      });
      const res = await addReviewComment(req, env as any, "rev_1");
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.data.comment).toBe("Check pricing");
    });
  });

  describe("listReviewComments", () => {
    it("returns 404 when review not found", async () => {
      const { listReviewComments } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await listReviewComments(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns comments for review", async () => {
      const { listReviewComments } = await import("../src/api/routes/reviews/handlers");
      const comments = [
        { id: "rc_1", comment: "Fix pricing" },
        { id: "rc_2", comment: "Update title" },
      ];
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM reviews")) {
          return makeMockStmt({ firstResult: { id: "rev_1" } });
        }
        if (query.includes("FROM review_comments")) {
          return makeMockStmt({ allResults: comments });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await listReviewComments(env as any, "rev_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(2);
    });
  });

  // ═════════════════════════════════════════════════════════
  // ── Get Single Review Tests ───────────────────────────
  // ═════════════════════════════════════════════════════════

  describe("getReview", () => {
    it("returns 404 when review not found", async () => {
      const { getReview } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getReview(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns review with comments, revision, and variants", async () => {
      const { getReview } = await import("../src/api/routes/reviews/handlers");
      const review = {
        id: "rev_1", product_id: "prod_1", version: 1,
        reviewer_type: "boss", approval_status: "pending",
        product_idea: "Test product", product_status: "waiting_for_review",
      };
      const stmtFn = (query: string) => {
        if (query.includes("FROM reviews r") && query.includes("JOIN products p")) {
          return makeMockStmt({ firstResult: review });
        }
        if (query.includes("FROM review_comments")) {
          return makeMockStmt({ allResults: [{ id: "rc_1", comment: "Note" }] });
        }
        if (query.includes("FROM revisions WHERE review_id")) {
          return makeMockStmt({ firstResult: null });
        }
        if (query.includes("FROM product_variants")) {
          return makeMockStmt({ allResults: [{ id: "var_1", variant_type: "base" }] });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await getReview(env as any, "rev_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data.review.id).toBe("rev_1");
      expect(body.data.comments).toHaveLength(1);
      expect(body.data.variants).toHaveLength(1);
    });
  });

  // ═════════════════════════════════════════════════════════
  // ── List Product Revisions Tests ──────────────────────
  // ═════════════════════════════════════════════════════════

  describe("listProductRevisions", () => {
    it("returns 404 when product not found", async () => {
      const { listProductRevisions } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await listProductRevisions(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns revisions for product", async () => {
      const { listProductRevisions } = await import("../src/api/routes/reviews/handlers");
      const revisions = [
        { id: "revn_1", version_from: 1, version_to: 2 },
        { id: "revn_2", version_from: 2, version_to: 3 },
      ];
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM products")) {
          return makeMockStmt({ firstResult: { id: "prod_1" } });
        }
        if (query.includes("FROM revisions")) {
          return makeMockStmt({ allResults: revisions });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await listProductRevisions(env as any, "prod_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(2);
    });
  });

  // ═════════════════════════════════════════════════════════
  // ── Product Version History Tests ─────────────────────
  // ═════════════════════════════════════════════════════════

  describe("getProductVersionHistory", () => {
    it("returns 404 when product not found", async () => {
      const { getProductVersionHistory } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await getProductVersionHistory(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns version timeline grouped by version", async () => {
      const { getProductVersionHistory } = await import("../src/api/routes/reviews/handlers");
      const product = { id: "prod_1", current_version: 2, approved_version: null };
      const reviews = [
        { id: "rev_1", version: 1, approval_status: "revision_requested" },
        { id: "rev_2", version: 2, approval_status: "pending" },
      ];
      const revisions = [
        { id: "revn_1", version_from: 1, version_to: 2 },
      ];
      const variants = [
        { id: "var_1", version: 1, variant_type: "base" },
        { id: "var_2", version: 2, variant_type: "base" },
      ];
      const stmtFn = (query: string) => {
        if (query.includes("SELECT * FROM products WHERE id")) {
          return makeMockStmt({ firstResult: product });
        }
        if (query.includes("FROM reviews WHERE product_id")) {
          return makeMockStmt({ allResults: reviews });
        }
        if (query.includes("FROM revisions WHERE product_id")) {
          return makeMockStmt({ allResults: revisions });
        }
        if (query.includes("FROM product_variants")) {
          return makeMockStmt({ allResults: variants });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await getProductVersionHistory(env as any, "prod_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data.current_version).toBe(2);
      expect(body.data.versions["1"]).toBeDefined();
      expect(body.data.versions["2"]).toBeDefined();
      expect(body.data.versions["1"].reviews).toHaveLength(1);
      expect(body.data.versions["1"].revisions).toHaveLength(1);
      expect(body.data.versions["2"].reviews).toHaveLength(1);
    });
  });

  // ═════════════════════════════════════════════════════════
  // ── List Product Reviews Tests ────────────────────────
  // ═════════════════════════════════════════════════════════

  describe("listProductReviews", () => {
    it("returns 404 when product not found", async () => {
      const { listProductReviews } = await import("../src/api/routes/reviews/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));
      const res = await listProductReviews(env as any, "nope");
      expect(res.status).toBe(404);
    });

    it("returns reviews for product", async () => {
      const { listProductReviews } = await import("../src/api/routes/reviews/handlers");
      const rows = [{ id: "rev_1" }, { id: "rev_2" }];
      const stmtFn = (query: string) => {
        if (query.includes("SELECT id FROM products")) {
          return makeMockStmt({ firstResult: { id: "prod_1" } });
        }
        if (query.includes("FROM reviews WHERE product_id")) {
          return makeMockStmt({ allResults: rows });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);
      const res = await listProductReviews(env as any, "prod_1");
      const body = await res.json() as any;
      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(2);
    });
  });
});
