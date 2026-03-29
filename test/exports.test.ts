import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Export handler tests.
 *
 * Tests export functionality (JSON, markdown, ZIP manifest)
 * and the ready_to_publish status transition in isolation.
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

const MOCK_VARIANT_SOCIAL: MockRow = {
  id: "var_soc1",
  product_id: "prod_abc123",
  version: 2,
  platform_id: null,
  social_channel_id: "sc_1",
  variant_type: "social",
  title: null,
  description: "Instagram caption",
  price_suggestion: null,
  seo_json: null,
  content_json: '{"caption":"Check this out!"}',
  asset_refs_json: null,
  status: "draft",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  platform_name: null,
  social_channel_name: "Instagram",
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

/**
 * Build a stmtFn that returns specific data based on query content.
 */
function makeExportStmtFn() {
  return (query: string) => {
    // Product lookup
    if (query.includes("FROM products") && query.includes("WHERE id")) {
      return makeMockStmt({ firstResult: MOCK_PRODUCT });
    }
    // Domain lookup
    if (query.includes("FROM domains")) {
      return makeMockStmt({ firstResult: MOCK_DOMAIN });
    }
    // Category lookup
    if (query.includes("FROM categories")) {
      return makeMockStmt({ firstResult: MOCK_CATEGORY });
    }
    // Variants lookup
    if (query.includes("FROM product_variants")) {
      return makeMockStmt({
        allResults: [MOCK_VARIANT_BASE, MOCK_VARIANT_PLATFORM, MOCK_VARIANT_SOCIAL],
      });
    }
    // Assets lookup
    if (query.includes("FROM assets")) {
      return makeMockStmt({ allResults: [MOCK_ASSET] });
    }
    return makeMockStmt();
  };
}

// ── Tests ────────────────────────────────────────────────

describe("exports/handlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── exportProduct (format router) ─────────────────────

  describe("exportProduct", () => {
    it("defaults to JSON format when no format specified", async () => {
      const { exportProduct } = await import("../src/api/routes/exports/handlers");
      const env = makeMockEnv(makeExportStmtFn());
      const req = makeRequest("GET", "http://localhost/api/products/prod_abc123/export");

      const res = await exportProduct(req, env as never, "prod_abc123");
      expect(res.status).toBe(200);

      const data = await res.json() as { data: { format: string } };
      expect(data.data.format).toBe("json");
    });

    it("rejects invalid format", async () => {
      const { exportProduct } = await import("../src/api/routes/exports/handlers");
      const env = makeMockEnv();
      const req = makeRequest("GET", "http://localhost/api/products/prod_abc123/export?format=xml");

      const res = await exportProduct(req, env as never, "prod_abc123");
      expect(res.status).toBe(400);

      const body = await res.json() as { error: string };
      expect(body.error).toContain("Invalid export format");
    });
  });

  // ── exportProductJson ─────────────────────────────────

  describe("exportProductJson", () => {
    it("returns full export package for approved product", async () => {
      const { exportProductJson } = await import("../src/api/routes/exports/handlers");
      const env = makeMockEnv(makeExportStmtFn());

      const res = await exportProductJson(env as never, "prod_abc123");
      expect(res.status).toBe(200);

      const body = await res.json() as { data: {
        export_id: string;
        format: string;
        product: { id: string; idea: string; domain: { name: string }; category: { name: string }; social_enabled: boolean };
        variants: { base: unknown[]; platform: unknown[]; social: unknown[] };
        pricing: unknown[];
        seo: unknown[];
        assets: unknown[];
      }};
      const pkg = body.data;

      expect(pkg.export_id).toMatch(/^exp_/);
      expect(pkg.format).toBe("json");
      expect(pkg.product.id).toBe("prod_abc123");
      expect(pkg.product.idea).toBe("Test Product Idea");
      expect(pkg.product.domain.name).toBe("Digital Art");
      expect(pkg.product.category.name).toBe("Illustrations");
      expect(pkg.product.social_enabled).toBe(true);

      // Variants grouped correctly
      expect(pkg.variants.base).toHaveLength(1);
      expect(pkg.variants.platform).toHaveLength(1);
      expect(pkg.variants.social).toHaveLength(1);

      // Pricing extracted from variants with price_suggestion
      expect(pkg.pricing).toHaveLength(2); // base + platform have prices

      // SEO extracted from variants with seo_json
      expect(pkg.seo).toHaveLength(2); // base + platform have SEO

      // Assets included
      expect(pkg.assets).toHaveLength(1);
      expect(pkg.assets[0]).toHaveProperty("filename", "logo.png");
    });

    it("rejects non-approved product", async () => {
      const { exportProductJson } = await import("../src/api/routes/exports/handlers");
      const draftProduct = { ...MOCK_PRODUCT, status: "draft" };
      const env = makeMockEnv(makeMockStmt({ firstResult: draftProduct }));

      const res = await exportProductJson(env as never, "prod_abc123");
      expect(res.status).toBe(400);

      const body = await res.json() as { error: string };
      expect(body.error).toContain("not approved");
    });

    it("allows ready_to_publish products to be exported", async () => {
      const { exportProductJson } = await import("../src/api/routes/exports/handlers");
      const readyProduct = { ...MOCK_PRODUCT, status: "ready_to_publish" };
      const stmtFn = (query: string) => {
        if (query.includes("FROM products") && query.includes("WHERE id")) {
          return makeMockStmt({ firstResult: readyProduct });
        }
        if (query.includes("FROM domains")) {
          return makeMockStmt({ firstResult: MOCK_DOMAIN });
        }
        if (query.includes("FROM categories")) {
          return makeMockStmt({ firstResult: MOCK_CATEGORY });
        }
        if (query.includes("FROM product_variants")) {
          return makeMockStmt({ allResults: [] });
        }
        if (query.includes("FROM assets")) {
          return makeMockStmt({ allResults: [] });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);

      const res = await exportProductJson(env as never, "prod_abc123");
      expect(res.status).toBe(200);
    });

    it("returns 404 for missing product", async () => {
      const { exportProductJson } = await import("../src/api/routes/exports/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));

      const res = await exportProductJson(env as never, "prod_missing");
      expect(res.status).toBe(404);
    });
  });

  // ── exportProductMarkdown ─────────────────────────────

  describe("exportProductMarkdown", () => {
    it("returns markdown content with correct headers", async () => {
      const { exportProductMarkdown } = await import("../src/api/routes/exports/handlers");
      const env = makeMockEnv(makeExportStmtFn());

      const res = await exportProductMarkdown(env as never, "prod_abc123");
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/markdown");
      expect(res.headers.get("Content-Disposition")).toContain("prod_abc123_export.md");

      const md = await res.text();
      expect(md).toContain("# Product Export: Test Product Idea");
      expect(md).toContain("## Product Core");
      expect(md).toContain("## Variants");
      expect(md).toContain("## Pricing Suggestions");
      expect(md).toContain("## SEO Metadata");
      expect(md).toContain("## Asset References");
      expect(md).toContain("logo.png");
      expect(md).toContain("Digital Art");
      expect(md).toContain("Illustrations");
    });

    it("includes variant platform/social names", async () => {
      const { exportProductMarkdown } = await import("../src/api/routes/exports/handlers");
      const env = makeMockEnv(makeExportStmtFn());

      const res = await exportProductMarkdown(env as never, "prod_abc123");
      const md = await res.text();

      expect(md).toContain("Platform: Etsy");
      expect(md).toContain("Social: Instagram");
    });
  });

  // ── exportProductZipManifest ──────────────────────────

  describe("exportProductZipManifest", () => {
    it("returns file manifest with correct structure", async () => {
      const { exportProductZipManifest } = await import("../src/api/routes/exports/handlers");
      const env = makeMockEnv(makeExportStmtFn());

      const res = await exportProductZipManifest(env as never, "prod_abc123");
      expect(res.status).toBe(200);

      const body = await res.json() as { data: {
        format: string;
        total_files: number;
        files: { path: string; type: string; source: string }[];
        package_data: unknown;
      }};
      const manifest = body.data;

      expect(manifest.format).toBe("zip_manifest");
      expect(manifest.total_files).toBeGreaterThan(0);

      // Should contain product.json, README.md, variant files, asset references
      const paths = manifest.files.map((f) => f.path);
      expect(paths).toContain("product.json");
      expect(paths).toContain("README.md");

      // Variant files
      const variantFiles = paths.filter((p) => p.startsWith("variants/"));
      expect(variantFiles).toHaveLength(3); // base, platform, social

      // SEO files
      const seoFiles = paths.filter((p) => p.startsWith("seo/"));
      expect(seoFiles).toHaveLength(2); // base, platform

      // Pricing file
      expect(paths).toContain("pricing.json");

      // Asset files
      const assetFiles = manifest.files.filter((f) => f.path.startsWith("assets/"));
      expect(assetFiles).toHaveLength(1);
      expect(assetFiles[0].source).toContain("r2://");
    });

    it("includes package_data in manifest", async () => {
      const { exportProductZipManifest } = await import("../src/api/routes/exports/handlers");
      const env = makeMockEnv(makeExportStmtFn());

      const res = await exportProductZipManifest(env as never, "prod_abc123");
      const body = await res.json() as { data: { package_data: { product: { id: string } } } };

      expect(body.data.package_data).toBeDefined();
      expect(body.data.package_data.product.id).toBe("prod_abc123");
    });
  });

  // ── markReadyToPublish ────────────────────────────────

  describe("markReadyToPublish", () => {
    it("transitions approved product to ready_to_publish", async () => {
      const { markReadyToPublish } = await import("../src/api/routes/exports/handlers");
      const updatedProduct = { ...MOCK_PRODUCT, status: "ready_to_publish" };
      const stmtFn = (query: string) => {
        if (query.includes("UPDATE")) {
          return makeMockStmt({ runMeta: { changes: 1 } });
        }
        if (query.includes("SELECT")) {
          // First call returns approved product, second returns updated
          const stmt = makeMockStmt({ firstResult: MOCK_PRODUCT });
          let callCount = 0;
          stmt.first = vi.fn().mockImplementation(() => {
            callCount++;
            return callCount === 1
              ? Promise.resolve(MOCK_PRODUCT)
              : Promise.resolve(updatedProduct);
          });
          return stmt;
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);

      const res = await markReadyToPublish(env as never, "prod_abc123");
      expect(res.status).toBe(200);

      const body = await res.json() as { message: string; data: { status: string } };
      expect(body.message).toContain("ready_to_publish");
    });

    it("rejects non-approved product", async () => {
      const { markReadyToPublish } = await import("../src/api/routes/exports/handlers");
      const draftProduct = { ...MOCK_PRODUCT, status: "draft" };
      const env = makeMockEnv(makeMockStmt({ firstResult: draftProduct }));

      const res = await markReadyToPublish(env as never, "prod_abc123");
      expect(res.status).toBe(400);

      const body = await res.json() as { error: string };
      expect(body.error).toContain("must be in \"approved\" status");
    });

    it("returns 404 for missing product", async () => {
      const { markReadyToPublish } = await import("../src/api/routes/exports/handlers");
      const env = makeMockEnv(makeMockStmt({ firstResult: null }));

      const res = await markReadyToPublish(env as never, "prod_missing");
      expect(res.status).toBe(404);
    });

    it("rejects ready_to_publish (already transitioned)", async () => {
      const { markReadyToPublish } = await import("../src/api/routes/exports/handlers");
      const readyProduct = { ...MOCK_PRODUCT, status: "ready_to_publish" };
      const env = makeMockEnv(makeMockStmt({ firstResult: readyProduct }));

      const res = await markReadyToPublish(env as never, "prod_abc123");
      expect(res.status).toBe(400);

      const body = await res.json() as { error: string };
      expect(body.error).toContain("must be in \"approved\" status");
    });
  });

  // ── Edge cases ────────────────────────────────────────

  describe("edge cases", () => {
    it("handles product with no variants or assets", async () => {
      const { exportProductJson } = await import("../src/api/routes/exports/handlers");
      const stmtFn = (query: string) => {
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
          return makeMockStmt({ allResults: [] });
        }
        if (query.includes("FROM assets")) {
          return makeMockStmt({ allResults: [] });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);

      const res = await exportProductJson(env as never, "prod_abc123");
      expect(res.status).toBe(200);

      const body = await res.json() as { data: {
        variants: { base: unknown[]; platform: unknown[]; social: unknown[] };
        pricing: unknown[];
        seo: unknown[];
        assets: unknown[];
      }};
      expect(body.data.variants.base).toHaveLength(0);
      expect(body.data.variants.platform).toHaveLength(0);
      expect(body.data.variants.social).toHaveLength(0);
      expect(body.data.pricing).toHaveLength(0);
      expect(body.data.seo).toHaveLength(0);
      expect(body.data.assets).toHaveLength(0);
    });

    it("handles product with no category", async () => {
      const { exportProductJson } = await import("../src/api/routes/exports/handlers");
      const noCatProduct = { ...MOCK_PRODUCT, category_id: null };
      const stmtFn = (query: string) => {
        if (query.includes("FROM products") && query.includes("WHERE id")) {
          return makeMockStmt({ firstResult: noCatProduct });
        }
        if (query.includes("FROM domains")) {
          return makeMockStmt({ firstResult: MOCK_DOMAIN });
        }
        if (query.includes("FROM product_variants")) {
          return makeMockStmt({ allResults: [] });
        }
        if (query.includes("FROM assets")) {
          return makeMockStmt({ allResults: [] });
        }
        return makeMockStmt();
      };
      const env = makeMockEnv(stmtFn);

      const res = await exportProductJson(env as never, "prod_abc123");
      expect(res.status).toBe(200);

      const body = await res.json() as { data: { product: { category: unknown } } };
      expect(body.data.product.category).toBeNull();
    });
  });
});
