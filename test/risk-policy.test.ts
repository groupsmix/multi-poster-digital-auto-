import { describe, it, expect, vi } from "vitest";

/**
 * Risk/Policy layer tests.
 *
 * Tests policy rule CRUD, content scanning, violation categorization,
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
// ── Risk Policy Service Tests ───────────────────────────
// ═════════════════════════════════════════════════════════

describe("services/risk-policy — runPolicyCheck", () => {
  it("passes when no rules match content", async () => {
    const { runPolicyCheck } = await import("../src/services/risk-policy");

    const stmtFn = (query: string) => {
      if (query.includes("FROM policy_rules")) {
        return makeMockStmt({
          allResults: [{
            id: "pr_1",
            name: "No spam",
            rule_type: "spam",
            severity: "block",
            pattern: "buy now!!!",
            description: "Avoid spam language",
            is_active: 1,
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
          }],
        });
      }
      // INSERT into policy_checks
      return makeMockStmt();
    };

    const env = makeMockEnv(stmtFn);

    const result = await runPolicyCheck(env as any, {
      productId: "prod_1",
      content: { title: "Great Product Guide", description: "Learn digital marketing" },
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.check_id).toMatch(/^pck_/);
  });

  it("detects block-level violations", async () => {
    const { runPolicyCheck } = await import("../src/services/risk-policy");

    const stmtFn = (query: string) => {
      if (query.includes("FROM policy_rules")) {
        return makeMockStmt({
          allResults: [{
            id: "pr_1",
            name: "No guaranteed income claims",
            rule_type: "misleading_claims",
            severity: "block",
            pattern: "guaranteed income|guaranteed profit",
            description: "Avoid misleading income claims.",
            is_active: 1,
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
          }],
        });
      }
      return makeMockStmt();
    };

    const env = makeMockEnv(stmtFn);

    const result = await runPolicyCheck(env as any, {
      productId: "prod_1",
      content: { title: "Guaranteed Income System", description: "Make money online" },
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].rule_name).toBe("No guaranteed income claims");
    expect(result.violations[0].field).toBe("title");
    expect(result.violations[0].severity).toBe("block");
  });

  it("categorizes warnings separately from blocks", async () => {
    const { runPolicyCheck } = await import("../src/services/risk-policy");

    const stmtFn = (query: string) => {
      if (query.includes("FROM policy_rules")) {
        return makeMockStmt({
          allResults: [
            {
              id: "pr_1", name: "Trademark check", rule_type: "trademark",
              severity: "warn", pattern: "™|®",
              description: "Verify trademark usage.", is_active: 1,
              created_at: "2026-01-01", updated_at: "2026-01-01",
            },
            {
              id: "pr_2", name: "Copyright notice", rule_type: "copyright",
              severity: "info", pattern: "all rights reserved",
              description: "Ensure proper attribution.", is_active: 1,
              created_at: "2026-01-01", updated_at: "2026-01-01",
            },
          ],
        });
      }
      return makeMockStmt();
    };

    const env = makeMockEnv(stmtFn);

    const result = await runPolicyCheck(env as any, {
      productId: "prod_1",
      content: {
        title: "Premium™ Digital Guide",
        footer: "All rights reserved 2026",
      },
    });

    // No block violations, so check passes
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].rule_type).toBe("trademark");
    expect(result.info).toHaveLength(1);
    expect(result.info[0].rule_type).toBe("copyright");
  });

  it("handles invalid regex patterns with substring fallback", async () => {
    const { runPolicyCheck } = await import("../src/services/risk-policy");

    const stmtFn = (query: string) => {
      if (query.includes("FROM policy_rules")) {
        return makeMockStmt({
          allResults: [{
            id: "pr_1", name: "Bad pattern test", rule_type: "test",
            severity: "warn", pattern: "[invalid regex(",
            description: "Test invalid regex.", is_active: 1,
            created_at: "2026-01-01", updated_at: "2026-01-01",
          }],
        });
      }
      return makeMockStmt();
    };

    const env = makeMockEnv(stmtFn);

    // Should not crash, and should do substring match
    const result = await runPolicyCheck(env as any, {
      productId: "prod_1",
      content: { title: "Contains [invalid regex( text" },
    });

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].match).toBe("[invalid regex(");
  });
});

// ═════════════════════════════════════════════════════════
// ── Policy Rule CRUD Tests ──────────────────────────────
// ═════════════════════════════════════════════════════════

describe("services/risk-policy — CRUD", () => {
  it("listPolicyRules returns all rules", async () => {
    const { listPolicyRules } = await import("../src/services/risk-policy");
    const env = makeMockEnv(makeMockStmt({
      allResults: [
        { id: "pr_1", name: "Rule 1", rule_type: "test", severity: "block", pattern: "test", description: "Test", is_active: 1, created_at: "2026-01-01", updated_at: "2026-01-01" },
        { id: "pr_2", name: "Rule 2", rule_type: "test", severity: "warn", pattern: "warn", description: "Warn", is_active: 1, created_at: "2026-01-01", updated_at: "2026-01-01" },
      ],
    }));

    const rules = await listPolicyRules(env as any);
    expect(rules).toHaveLength(2);
    expect(rules[0].id).toBe("pr_1");
    expect(rules[1].id).toBe("pr_2");
  });

  it("createPolicyRule creates and returns a rule", async () => {
    const { createPolicyRule } = await import("../src/services/risk-policy");
    const env = makeMockEnv();

    const rule = await createPolicyRule(env as any, {
      name: "New Rule",
      rule_type: "custom",
      severity: "warn",
      pattern: "test pattern",
      description: "A new test rule",
    });

    expect(rule.id).toMatch(/^pr_/);
    expect(rule.name).toBe("New Rule");
    expect(rule.severity).toBe("warn");
    expect(rule.is_active).toBe(1);
  });

  it("updatePolicyRule returns null for non-existing rule", async () => {
    const { updatePolicyRule } = await import("../src/services/risk-policy");
    const env = makeMockEnv(makeMockStmt({ firstResult: null }));

    const result = await updatePolicyRule(env as any, "pr_nonexist", { name: "Updated" });
    expect(result).toBeNull();
  });

  it("deletePolicyRule returns true on successful delete", async () => {
    const { deletePolicyRule } = await import("../src/services/risk-policy");
    const env = makeMockEnv(makeMockStmt({ runMeta: { changes: 1 } }));

    const result = await deletePolicyRule(env as any, "pr_1");
    expect(result).toBe(true);
  });

  it("deletePolicyRule returns false when rule not found", async () => {
    const { deletePolicyRule } = await import("../src/services/risk-policy");
    const env = makeMockEnv(makeMockStmt({ runMeta: { changes: 0 } }));

    const result = await deletePolicyRule(env as any, "pr_nonexist");
    expect(result).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════
// ── Gather Product Content Tests ────────────────────────
// ═════════════════════════════════════════════════════════

describe("services/risk-policy — gatherProductContent", () => {
  it("gathers product idea, notes, and variant content", async () => {
    const { gatherProductContent } = await import("../src/services/risk-policy");

    const stmtFn = (query: string) => {
      if (query.includes("FROM products")) {
        return makeMockStmt({ firstResult: { idea: "Test Product", notes: "Some notes" } });
      }
      if (query.includes("FROM product_variants")) {
        return makeMockStmt({
          allResults: [
            { id: "v1", title: "Variant Title", description: "Variant Desc", content_json: '{"body":"Hello"}' },
            { id: "v2", title: null, description: "Social post", content_json: null },
          ],
        });
      }
      return makeMockStmt();
    };

    const env = makeMockEnv(stmtFn);
    const content = await gatherProductContent(env as any, "prod_1");

    expect(content["product_idea"]).toBe("Test Product");
    expect(content["product_notes"]).toBe("Some notes");
    expect(content["variant_v1_title"]).toBe("Variant Title");
    expect(content["variant_v1_description"]).toBe("Variant Desc");
    expect(content["variant_v1_content_body"]).toBe("Hello");
    expect(content["variant_v2_description"]).toBe("Social post");
    expect(content["variant_v2_title"]).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════
// ── Risk Policy API Handler Tests ───────────────────────
// ═════════════════════════════════════════════════════════

describe("risk-policy/handlers", () => {
  describe("handleListPolicyRules", () => {
    it("returns list of rules", async () => {
      const { handleListPolicyRules } = await import("../src/api/routes/risk-policy/handlers");
      const env = makeMockEnv(makeMockStmt({
        allResults: [
          { id: "pr_1", name: "Rule 1", rule_type: "test", severity: "block", pattern: "x", description: "Desc", is_active: 1, created_at: "2026-01-01", updated_at: "2026-01-01" },
        ],
      }));

      const res = await handleListPolicyRules(env as any);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data).toHaveLength(1);
    });
  });

  describe("handleCreatePolicyRule", () => {
    it("creates a rule and returns 201", async () => {
      const { handleCreatePolicyRule } = await import("../src/api/routes/risk-policy/handlers");
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/policy-rules", {
        name: "No spam",
        rule_type: "spam",
        severity: "block",
        pattern: "buy now",
        description: "Avoid spammy language",
      });

      const res = await handleCreatePolicyRule(req, env as any);
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.data.name).toBe("No spam");
    });

    it("returns 400 when required fields are missing", async () => {
      const { handleCreatePolicyRule } = await import("../src/api/routes/risk-policy/handlers");
      const env = makeMockEnv();
      const req = makeRequest("POST", "http://localhost/api/policy-rules", {
        name: "Missing fields",
      });

      const res = await handleCreatePolicyRule(req, env as any);
      expect(res.status).toBe(400);
    });
  });

  describe("handleDeletePolicyRule", () => {
    it("returns 200 on successful delete", async () => {
      const { handleDeletePolicyRule } = await import("../src/api/routes/risk-policy/handlers");
      const env = makeMockEnv(makeMockStmt({ runMeta: { changes: 1 } }));

      const res = await handleDeletePolicyRule(env as any, "pr_1");
      expect(res.status).toBe(200);
    });

    it("returns 404 when rule not found", async () => {
      const { handleDeletePolicyRule } = await import("../src/api/routes/risk-policy/handlers");
      const env = makeMockEnv(makeMockStmt({ runMeta: { changes: 0 } }));

      const res = await handleDeletePolicyRule(env as any, "pr_nonexist");
      expect(res.status).toBe(404);
    });
  });
});
