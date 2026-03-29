import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Bulk config/analytics export and CSV product export tests.
 *
 * Tests bulk config export (JSON + CSV), bulk analytics export (JSON + CSV),
 * and product-level CSV export.
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

function makeMockEnv(
  stmtOrFn?: ReturnType<typeof makeMockStmt> | ((query: string) => ReturnType<typeof makeMockStmt>),
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
    ASSETS_BUCKET: {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
      head: vi.fn().mockResolvedValue(null),
    },
    WORKFLOW_COORDINATOR: {},
    PROVIDER_ROUTER: {},
    ENVIRONMENT: "test",
    APP_NAME: "NEXUS",
  };
}

function makeRequest(method: string, url: string): Request {
  return new Request(url, { method });
}

// ── Shared test data ─────────────────────────────────────

const MOCK_PRODUCT: MockRow = {
  id: "prod_abc123",
  domain_id: "dom_1",
  category_id: "cat_1",
  idea: "Test Product Idea",
  notes: "Some notes",
  status: "approved",
  current_version: 2,
  approved_version: 2,
  workflow_template_id: null,
  target_platforms_json: '["plt_1"]',
  social_enabled: 1,
  target_social_json: '["sc_1"]',
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-02T00:00:00.000Z",
};

const MOCK_DOMAIN: MockRow = {
  id: "dom_1",
  name: "Digital Art",
  slug: "digital-art",
};

const MOCK_CATEGORY: MockRow = {
  id: "cat_1",
  name: "Illustrations",
  slug: "illustrations",
};

const MOCK_VARIANT_BASE: MockRow = {
  id: "var_base1",
  product_id: "prod_abc123",
  version: 2,
  platform_id: null,
  social_channel_id: null,
  variant_type: "base",
  title: "Base Title",
  description: "Base description",
  price_suggestion: "$9.99",
  seo_json: '{"keywords":["art","digital"]}',
  content_json: '{"body":"content here"}',
  asset_refs_json: '["ast_1"]',
  status: "draft",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  platform_name: null,
  social_channel_name: null,
};

const MOCK_VARIANT_PLATFORM: MockRow = {
  id: "var_plt1",
  product_id: "prod_abc123",
  version: 2,
  platform_id: "plt_1",
  social_channel_id: null,
  variant_type: "platform",
  title: "Etsy Title",
  description: "Etsy description",
  price_suggestion: "$12.99",
  seo_json: '{"tags":["etsy","art"]}',
  content_json: null,
  asset_refs_json: null,
  status: "draft",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  platform_name: "Etsy",
  social_channel_name: null,
};

const MOCK_ASSET: MockRow = {
  id: "ast_1",
  product_id: "prod_abc123",
  type: "image",
  storage_key: "prod_abc123/ast_1/logo.png",
  provider: null,
  filename: "logo.png",
  file_size: 1024,
  mime_type: "image/png",
  metadata_json: null,
  is_active: 1,
  created_at: "2025-01-01T00:00:00.000Z",
};

function makeExportStmtFn() {
  return (query: string) => {
    if (query.includes("FROM products") && query.includes("WHERE id")) {
      return makeMockStmt({ firstResult: MOCK_PRODUCT });
    }
    if (query.includes("FROM domains")) {
      return makeMockStmt({ firstResult: MOCK_DOMAIN });
    }
    if (query.includes("FROM categories")) {
      return makeMockStmt({ firstResult: MOCK_CATEGORY });
    }
    if (query.includes("FROM product_variants")) {
      return makeMockStmt({
        allResults: [MOCK_VARIANT_BASE, MOCK_VARIANT_PLATFORM],
      });
    }
    if (query.includes("FROM assets")) {
      return makeMockStmt({ allResults: [MOCK_ASSET] });
    }
    return makeMockStmt();
  };
}

// ═════════════════════════════════════════════════════════
// ── Bulk Config Export Tests ────────────────────────────
// ═════════════════════════════════════════════════════════

describe("exports/bulk — exportBulkConfig", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports domains as JSON", async () => {
    const { exportBulkConfig } = await import("../src/api/routes/exports/bulk");
    const env = makeMockEnv(makeMockStmt({
      allResults: [
        { id: "dom_1", name: "Digital Products", slug: "digital-products", is_active: 1 },
        { id: "dom_2", name: "Print on Demand", slug: "pod", is_active: 1 },
      ],
    }));

    const req = makeRequest("GET", "http://localhost/api/exports/config?type=domains&format=json");
    const res = await exportBulkConfig(req, env as any);
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.export_type).toBe("domains");
    expect(body.format).toBe("json");
    expect(body.count).toBe(2);
    expect(body.data).toHaveLength(2);
    expect(body.exported_at).toBeDefined();
  });

  it("exports platforms as CSV", async () => {
    const { exportBulkConfig } = await import("../src/api/routes/exports/bulk");
    const env = makeMockEnv(makeMockStmt({
      allResults: [
        { id: "plt_1", name: "Etsy", slug: "etsy", title_limit: 140 },
        { id: "plt_2", name: "Gumroad", slug: "gumroad", title_limit: 200 },
      ],
    }));

    const req = makeRequest("GET", "http://localhost/api/exports/config?type=platforms&format=csv");
    const res = await exportBulkConfig(req, env as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("platforms_export.csv");

    const csv = await res.text();
    expect(csv).toContain("id,name,slug,title_limit");
    expect(csv).toContain("plt_1,Etsy,etsy,140");
    expect(csv).toContain("plt_2,Gumroad,gumroad,200");
  });

  it("rejects invalid export type", async () => {
    const { exportBulkConfig } = await import("../src/api/routes/exports/bulk");
    const env = makeMockEnv();

    const req = makeRequest("GET", "http://localhost/api/exports/config?type=invalid&format=json");
    const res = await exportBulkConfig(req, env as any);
    expect(res.status).toBe(400);

    const body = await res.json() as any;
    expect(body.error).toContain("Invalid export type");
  });

  it("rejects invalid format", async () => {
    const { exportBulkConfig } = await import("../src/api/routes/exports/bulk");
    const env = makeMockEnv();

    const req = makeRequest("GET", "http://localhost/api/exports/config?type=domains&format=xml");
    const res = await exportBulkConfig(req, env as any);
    expect(res.status).toBe(400);

    const body = await res.json() as any;
    expect(body.error).toContain("Invalid format");
  });

  it("exports empty dataset as JSON", async () => {
    const { exportBulkConfig } = await import("../src/api/routes/exports/bulk");
    const env = makeMockEnv(makeMockStmt({ allResults: [] }));

    const req = makeRequest("GET", "http://localhost/api/exports/config?type=categories&format=json");
    const res = await exportBulkConfig(req, env as any);
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.count).toBe(0);
    expect(body.data).toHaveLength(0);
  });

  it("handles CSV fields with commas and quotes", async () => {
    const { exportBulkConfig } = await import("../src/api/routes/exports/bulk");
    const env = makeMockEnv(makeMockStmt({
      allResults: [
        { id: "dom_1", name: 'Digital "Products"', slug: "digital,products", description: "Line\nbreak" },
      ],
    }));

    const req = makeRequest("GET", "http://localhost/api/exports/config?type=domains&format=csv");
    const res = await exportBulkConfig(req, env as any);
    expect(res.status).toBe(200);

    const csv = await res.text();
    // Fields with special chars should be escaped
    expect(csv).toContain('"Digital ""Products"""');
    expect(csv).toContain('"digital,products"');
  });
});

// ═════════════════════════════════════════════════════════
// ── Bulk Analytics Export Tests ─────────────────────────
// ═════════════════════════════════════════════════════════

describe("exports/bulk — exportBulkAnalytics", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports analytics events as JSON", async () => {
    const { exportBulkAnalytics } = await import("../src/api/routes/exports/bulk");
    const env = makeMockEnv(makeMockStmt({
      allResults: [
        { id: "evt_1", event_type: "workflow_completed", product_id: "prod_1", created_at: "2026-01-01" },
      ],
    }));

    const req = makeRequest("GET", "http://localhost/api/exports/analytics?type=events&format=json");
    const res = await exportBulkAnalytics(req, env as any);
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.export_type).toBe("analytics_events");
    expect(body.count).toBe(1);
    expect(body.data).toHaveLength(1);
  });

  it("exports cost events as CSV", async () => {
    const { exportBulkAnalytics } = await import("../src/api/routes/exports/bulk");
    const env = makeMockEnv(makeMockStmt({
      allResults: [
        { id: "ce_1", provider: "gemini", model: "gemini-2.0-flash", cost: 0.001, tokens: 300 },
      ],
    }));

    const req = makeRequest("GET", "http://localhost/api/exports/analytics?type=cost_events&format=csv");
    const res = await exportBulkAnalytics(req, env as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("analytics_cost_events_export.csv");

    const csv = await res.text();
    expect(csv).toContain("id,provider,model,cost,tokens");
    expect(csv).toContain("gemini");
  });

  it("rejects invalid analytics type", async () => {
    const { exportBulkAnalytics } = await import("../src/api/routes/exports/bulk");
    const env = makeMockEnv();

    const req = makeRequest("GET", "http://localhost/api/exports/analytics?type=invalid");
    const res = await exportBulkAnalytics(req, env as any);
    expect(res.status).toBe(400);

    const body = await res.json() as any;
    expect(body.error).toContain("Invalid analytics type");
  });

  it("defaults to JSON format", async () => {
    const { exportBulkAnalytics } = await import("../src/api/routes/exports/bulk");
    const env = makeMockEnv(makeMockStmt({ allResults: [] }));

    const req = makeRequest("GET", "http://localhost/api/exports/analytics?type=events");
    const res = await exportBulkAnalytics(req, env as any);
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.format).toBe("json");
  });
});

// ═════════════════════════════════════════════════════════
// ── Product CSV Export Tests ────────────────────────────
// ═════════════════════════════════════════════════════════

describe("exports/handlers — CSV export", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports product as CSV with correct headers", async () => {
    const { exportProductCsv } = await import("../src/api/routes/exports/handlers");
    const env = makeMockEnv(makeExportStmtFn());

    const res = await exportProductCsv(env as never, "prod_abc123");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("prod_abc123_export.csv");

    const csv = await res.text();
    // Check header row
    expect(csv).toContain("product_id");
    expect(csv).toContain("product_idea");
    expect(csv).toContain("variant_id");
    expect(csv).toContain("variant_type");
    expect(csv).toContain("title");
    expect(csv).toContain("description");
    expect(csv).toContain("price_suggestion");

    // Check data rows
    expect(csv).toContain("prod_abc123");
    expect(csv).toContain("Base Title");
    expect(csv).toContain("Etsy Title");
  });

  it("routes CSV format through exportProduct", async () => {
    const { exportProduct } = await import("../src/api/routes/exports/handlers");
    const env = makeMockEnv(makeExportStmtFn());
    const req = makeRequest("GET", "http://localhost/api/products/prod_abc123/export?format=csv");

    const res = await exportProduct(req, env as never, "prod_abc123");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
  });

  it("returns 404 for missing product in CSV export", async () => {
    const { exportProductCsv } = await import("../src/api/routes/exports/handlers");
    const env = makeMockEnv(makeMockStmt({ firstResult: null }));

    const res = await exportProductCsv(env as never, "prod_missing");
    expect(res.status).toBe(404);
  });

  it("rejects non-approved product in CSV export", async () => {
    const { exportProductCsv } = await import("../src/api/routes/exports/handlers");
    const draftProduct = { ...MOCK_PRODUCT, status: "draft" };
    const env = makeMockEnv(makeMockStmt({ firstResult: draftProduct }));

    const res = await exportProductCsv(env as never, "prod_abc123");
    expect(res.status).toBe(400);

    const body = await res.json() as any;
    expect(body.error).toContain("not approved");
  });
});
