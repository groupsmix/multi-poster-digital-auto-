import { Env } from "../../../shared/types";
import {
  json,
  notFound,
  badRequest,
  serverError,
  generateId,
} from "../../../shared/utils";
import { EXPORT_FORMATS } from "../../../config";

/** Type-safe check for whether a string is a valid export format. */
function isValidExportFormat(value: string): boolean {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}

// ── Types ────────────────────────────────────────────────

interface ProductRow {
  id: string;
  domain_id: string;
  category_id: string | null;
  idea: string;
  notes: string | null;
  status: string;
  current_version: number;
  approved_version: number | null;
  workflow_template_id: string | null;
  target_platforms_json: string | null;
  social_enabled: number;
  target_social_json: string | null;
  created_at: string;
  updated_at: string;
}

interface VariantRow {
  id: string;
  product_id: string;
  version: number;
  platform_id: string | null;
  social_channel_id: string | null;
  variant_type: string;
  title: string | null;
  description: string | null;
  price_suggestion: string | null;
  seo_json: string | null;
  content_json: string | null;
  asset_refs_json: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  platform_name?: string | null;
  social_channel_name?: string | null;
}

interface AssetRow {
  id: string;
  product_id: string | null;
  type: string;
  storage_key: string;
  provider: string | null;
  filename: string | null;
  file_size: number | null;
  mime_type: string | null;
  metadata_json: string | null;
  created_at: string;
}

interface ExportPackage {
  export_id: string;
  exported_at: string;
  format: string;
  product: {
    id: string;
    idea: string;
    notes: string | null;
    status: string;
    current_version: number;
    approved_version: number | null;
    domain: { id: string; name: string; slug: string } | null;
    category: { id: string; name: string; slug: string } | null;
    target_platforms_json: unknown | null;
    social_enabled: boolean;
    target_social_json: unknown | null;
    created_at: string;
    updated_at: string;
  };
  variants: {
    base: VariantExport[];
    platform: VariantExport[];
    social: VariantExport[];
  };
  pricing: PricingSuggestion[];
  seo: SeoEntry[];
  assets: AssetExport[];
}

interface VariantExport {
  id: string;
  variant_type: string;
  version: number;
  platform_name: string | null;
  social_channel_name: string | null;
  title: string | null;
  description: string | null;
  price_suggestion: string | null;
  seo: unknown | null;
  content: unknown | null;
  asset_refs: unknown | null;
  status: string;
}

interface PricingSuggestion {
  variant_id: string;
  variant_type: string;
  platform_name: string | null;
  social_channel_name: string | null;
  price_suggestion: string | null;
}

interface SeoEntry {
  variant_id: string;
  variant_type: string;
  platform_name: string | null;
  seo: unknown | null;
}

interface AssetExport {
  id: string;
  type: string;
  filename: string | null;
  storage_key: string;
  mime_type: string | null;
  file_size: number | null;
  provider: string | null;
  metadata: unknown | null;
}

// ── Helpers ──────────────────────────────────────────────

function safeJsonParse(raw: string | null): unknown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function mapVariant(v: VariantRow): VariantExport {
  return {
    id: v.id,
    variant_type: v.variant_type,
    version: v.version,
    platform_name: v.platform_name ?? null,
    social_channel_name: v.social_channel_name ?? null,
    title: v.title,
    description: v.description,
    price_suggestion: v.price_suggestion,
    seo: safeJsonParse(v.seo_json),
    content: safeJsonParse(v.content_json),
    asset_refs: safeJsonParse(v.asset_refs_json),
    status: v.status,
  };
}

/**
 * Gather the full export package for an approved product.
 * Shared by all format handlers.
 */
async function gatherExportData(
  env: Env,
  productId: string,
): Promise<{ error: Response | null; pkg: ExportPackage | null }> {
  // Fetch product
  const product = (await env.DB.prepare(
    "SELECT * FROM products WHERE id = ?",
  )
    .bind(productId)
    .first()) as ProductRow | null;

  if (!product) {
    return { error: notFound(`Product not found: ${productId}`), pkg: null };
  }

  if (product.status !== "approved" && product.status !== "ready_to_publish") {
    return {
      error: badRequest(
        `Product "${productId}" is not approved (status: ${product.status}). Only approved or ready_to_publish products can be exported.`,
      ),
      pkg: null,
    };
  }

  // Fetch domain
  const domain = await env.DB.prepare(
    "SELECT id, name, slug FROM domains WHERE id = ?",
  )
    .bind(product.domain_id)
    .first();

  // Fetch category (optional)
  let category: Record<string, unknown> | null = null;
  if (product.category_id) {
    category = await env.DB.prepare(
      "SELECT id, name, slug FROM categories WHERE id = ?",
    )
      .bind(product.category_id)
      .first();
  }

  // Fetch variants for approved version (with platform/social names)
  const exportVersion = product.approved_version ?? product.current_version;
  const variantsResult = await env.DB.prepare(
    `SELECT pv.*, pl.name as platform_name, sc.name as social_channel_name
     FROM product_variants pv
     LEFT JOIN platforms pl ON pv.platform_id = pl.id
     LEFT JOIN social_channels sc ON pv.social_channel_id = sc.id
     WHERE pv.product_id = ? AND pv.version = ?
     ORDER BY pv.variant_type ASC`,
  )
    .bind(productId, exportVersion)
    .all();

  const variants = variantsResult.results as unknown as VariantRow[];

  // Fetch assets linked to this product
  const assetsResult = await env.DB.prepare(
    "SELECT * FROM assets WHERE product_id = ? AND is_active = 1 ORDER BY type ASC, created_at DESC",
  )
    .bind(productId)
    .all();

  const assets = assetsResult.results as unknown as AssetRow[];

  // Build grouped variants
  const grouped = {
    base: variants.filter((v) => v.variant_type === "base").map(mapVariant),
    platform: variants.filter((v) => v.variant_type === "platform").map(mapVariant),
    social: variants.filter((v) => v.variant_type === "social").map(mapVariant),
  };

  // Extract pricing suggestions from all variants that have one
  const pricing: PricingSuggestion[] = variants
    .filter((v) => v.price_suggestion)
    .map((v) => ({
      variant_id: v.id,
      variant_type: v.variant_type,
      platform_name: v.platform_name ?? null,
      social_channel_name: v.social_channel_name ?? null,
      price_suggestion: v.price_suggestion,
    }));

  // Extract SEO metadata from all variants that have it
  const seo: SeoEntry[] = variants
    .filter((v) => v.seo_json)
    .map((v) => ({
      variant_id: v.id,
      variant_type: v.variant_type,
      platform_name: v.platform_name ?? null,
      seo: safeJsonParse(v.seo_json),
    }));

  // Map assets
  const assetExports: AssetExport[] = assets.map((a) => ({
    id: a.id,
    type: a.type,
    filename: a.filename,
    storage_key: a.storage_key,
    mime_type: a.mime_type,
    file_size: a.file_size,
    provider: a.provider,
    metadata: safeJsonParse(a.metadata_json),
  }));

  const exportId = generateId("exp_");

  const pkg: ExportPackage = {
    export_id: exportId,
    exported_at: new Date().toISOString(),
    format: "json",
    product: {
      id: product.id,
      idea: product.idea,
      notes: product.notes,
      status: product.status,
      current_version: product.current_version,
      approved_version: product.approved_version,
      domain: domain as { id: string; name: string; slug: string } | null,
      category: category as { id: string; name: string; slug: string } | null,
      target_platforms_json: safeJsonParse(product.target_platforms_json),
      social_enabled: product.social_enabled === 1,
      target_social_json: safeJsonParse(product.target_social_json),
      created_at: product.created_at,
      updated_at: product.updated_at,
    },
    variants: grouped,
    pricing,
    seo,
    assets: assetExports,
  };

  return { error: null, pkg };
}

// ── EXPORT (JSON) ────────────────────────────────────────

export async function exportProductJson(
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    const { error, pkg } = await gatherExportData(env, productId);
    if (error) return error;
    if (!pkg) return serverError("Failed to gather export data.");

    pkg.format = "json";
    return json({ data: pkg });
  } catch (err) {
    console.error("[exports/json]", err);
    return serverError("Failed to export product as JSON.");
  }
}

// ── EXPORT (Markdown) ────────────────────────────────────

function renderMarkdown(pkg: ExportPackage): string {
  const lines: string[] = [];
  const p = pkg.product;

  lines.push(`# Product Export: ${p.idea}`);
  lines.push("");
  lines.push(`**Export ID:** ${pkg.export_id}`);
  lines.push(`**Exported at:** ${pkg.exported_at}`);
  lines.push(`**Format:** markdown`);
  lines.push("");

  // Core data
  lines.push("## Product Core");
  lines.push("");
  lines.push(`- **ID:** ${p.id}`);
  lines.push(`- **Status:** ${p.status}`);
  lines.push(`- **Version:** ${p.current_version}`);
  if (p.approved_version) {
    lines.push(`- **Approved Version:** ${p.approved_version}`);
  }
  if (p.domain) {
    lines.push(`- **Domain:** ${p.domain.name} (\`${p.domain.slug}\`)`);
  }
  if (p.category) {
    lines.push(`- **Category:** ${p.category.name} (\`${p.category.slug}\`)`);
  }
  if (p.notes) {
    lines.push(`- **Notes:** ${p.notes}`);
  }
  lines.push(`- **Social Enabled:** ${p.social_enabled ? "Yes" : "No"}`);
  lines.push(`- **Created:** ${p.created_at}`);
  lines.push(`- **Updated:** ${p.updated_at}`);
  lines.push("");

  // Variants
  const allVariants = [
    ...pkg.variants.base,
    ...pkg.variants.platform,
    ...pkg.variants.social,
  ];

  if (allVariants.length > 0) {
    lines.push("## Variants");
    lines.push("");

    for (const v of allVariants) {
      const label =
        v.variant_type === "platform"
          ? `Platform: ${v.platform_name || "unknown"}`
          : v.variant_type === "social"
            ? `Social: ${v.social_channel_name || "unknown"}`
            : "Base";

      lines.push(`### ${label} (${v.id})`);
      lines.push("");
      if (v.title) lines.push(`- **Title:** ${v.title}`);
      if (v.description) lines.push(`- **Description:** ${v.description}`);
      if (v.price_suggestion) lines.push(`- **Price:** ${v.price_suggestion}`);
      lines.push(`- **Status:** ${v.status}`);
      lines.push(`- **Version:** ${v.version}`);

      if (v.seo) {
        lines.push(`- **SEO:** \`${JSON.stringify(v.seo)}\``);
      }
      if (v.content) {
        lines.push(`- **Content:** \`${JSON.stringify(v.content)}\``);
      }
      if (v.asset_refs) {
        lines.push(`- **Asset Refs:** \`${JSON.stringify(v.asset_refs)}\``);
      }
      lines.push("");
    }
  }

  // Pricing
  if (pkg.pricing.length > 0) {
    lines.push("## Pricing Suggestions");
    lines.push("");
    for (const pr of pkg.pricing) {
      const ctx =
        pr.platform_name || pr.social_channel_name || pr.variant_type;
      lines.push(`- **${ctx}** (${pr.variant_id}): ${pr.price_suggestion}`);
    }
    lines.push("");
  }

  // SEO
  if (pkg.seo.length > 0) {
    lines.push("## SEO Metadata");
    lines.push("");
    for (const s of pkg.seo) {
      const ctx = s.platform_name || s.variant_type;
      lines.push(`### ${ctx} (${s.variant_id})`);
      lines.push("");
      lines.push("```json");
      lines.push(JSON.stringify(s.seo, null, 2));
      lines.push("```");
      lines.push("");
    }
  }

  // Assets
  if (pkg.assets.length > 0) {
    lines.push("## Asset References");
    lines.push("");
    for (const a of pkg.assets) {
      lines.push(
        `- **${a.filename || a.id}** (${a.type}) — \`${a.storage_key}\`${a.mime_type ? ` [${a.mime_type}]` : ""}${a.file_size ? ` (${a.file_size} bytes)` : ""}`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Generated by NEXUS export engine*`);
  lines.push("");

  return lines.join("\n");
}

export async function exportProductMarkdown(
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    const { error, pkg } = await gatherExportData(env, productId);
    if (error) return error;
    if (!pkg) return serverError("Failed to gather export data.");

    pkg.format = "markdown";
    const markdown = renderMarkdown(pkg);

    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${productId}_export.md"`,
      },
    });
  } catch (err) {
    console.error("[exports/markdown]", err);
    return serverError("Failed to export product as markdown.");
  }
}

// ── EXPORT (ZIP Manifest) ────────────────────────────────
// Returns a JSON manifest describing what would go in a ZIP.
// Actual ZIP generation is deferred (optional future enhancement).

export async function exportProductZipManifest(
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    const { error, pkg } = await gatherExportData(env, productId);
    if (error) return error;
    if (!pkg) return serverError("Failed to gather export data.");

    pkg.format = "zip_manifest";

    // Build file manifest entries
    const files: { path: string; type: string; source: string }[] = [];

    // product.json
    files.push({
      path: "product.json",
      type: "application/json",
      source: "generated",
    });

    // variants/*.json
    const allVariants = [
      ...pkg.variants.base,
      ...pkg.variants.platform,
      ...pkg.variants.social,
    ];
    for (const v of allVariants) {
      files.push({
        path: `variants/${v.variant_type}_${v.id}.json`,
        type: "application/json",
        source: "generated",
      });
    }

    // seo/*.json
    for (const s of pkg.seo) {
      files.push({
        path: `seo/${s.variant_type}_${s.variant_id}.json`,
        type: "application/json",
        source: "generated",
      });
    }

    // pricing.json
    if (pkg.pricing.length > 0) {
      files.push({
        path: "pricing.json",
        type: "application/json",
        source: "generated",
      });
    }

    // assets/*
    for (const a of pkg.assets) {
      files.push({
        path: `assets/${a.filename || a.id}`,
        type: a.mime_type || "application/octet-stream",
        source: `r2://${a.storage_key}`,
      });
    }

    // README.md
    files.push({
      path: "README.md",
      type: "text/markdown",
      source: "generated",
    });

    return json({
      data: {
        export_id: pkg.export_id,
        exported_at: pkg.exported_at,
        format: "zip_manifest",
        product_id: pkg.product.id,
        product_idea: pkg.product.idea,
        total_files: files.length,
        files,
        package_data: pkg,
      },
    });
  } catch (err) {
    console.error("[exports/zip-manifest]", err);
    return serverError("Failed to generate ZIP manifest.");
  }
}

// ── EXPORT (CSV) ─────────────────────────────────────────

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function renderCsv(pkg: ExportPackage): string {
  const allVariants = [
    ...pkg.variants.base,
    ...pkg.variants.platform,
    ...pkg.variants.social,
  ];

  // CSV rows: one row per variant, with product info repeated
  const headers = [
    "product_id",
    "product_idea",
    "product_status",
    "product_version",
    "domain",
    "category",
    "variant_id",
    "variant_type",
    "variant_version",
    "platform",
    "social_channel",
    "title",
    "description",
    "price_suggestion",
    "seo",
    "status",
  ];

  const rows = allVariants.map((v) => [
    pkg.product.id,
    pkg.product.idea,
    pkg.product.status,
    pkg.product.current_version,
    pkg.product.domain?.name || "",
    pkg.product.category?.name || "",
    v.id,
    v.variant_type,
    v.version,
    v.platform_name || "",
    v.social_channel_name || "",
    v.title || "",
    v.description || "",
    v.price_suggestion || "",
    v.seo ? JSON.stringify(v.seo) : "",
    v.status,
  ]);

  // If no variants, output a single product row
  if (rows.length === 0) {
    rows.push([
      pkg.product.id,
      pkg.product.idea,
      pkg.product.status,
      pkg.product.current_version,
      pkg.product.domain?.name || "",
      pkg.product.category?.name || "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  }

  const header = headers.map(escapeCsvField).join(",");
  const dataRows = rows.map((row) =>
    row.map(escapeCsvField).join(","),
  );

  return [header, ...dataRows].join("\n");
}

export async function exportProductCsv(
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    const { error, pkg } = await gatherExportData(env, productId);
    if (error) return error;
    if (!pkg) return serverError("Failed to gather export data.");

    pkg.format = "csv";
    const csv = renderCsv(pkg);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${productId}_export.csv"`,
      },
    });
  } catch (err) {
    console.error("[exports/csv]", err);
    return serverError("Failed to export product as CSV.");
  }
}

// ── EXPORT (format router) ──────────────────────────────

export async function exportProduct(
  request: Request,
  env: Env,
  productId: string,
): Promise<Response> {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "json";

  if (!isValidExportFormat(format)) {
    return badRequest(
      `Invalid export format "${format}". Valid formats: ${EXPORT_FORMATS.join(", ")}`,
    );
  }

  switch (format) {
    case "json":
      return exportProductJson(env, productId);
    case "markdown":
      return exportProductMarkdown(env, productId);
    case "zip_manifest":
      return exportProductZipManifest(env, productId);
    case "csv":
      return exportProductCsv(env, productId);
    default:
      return badRequest(`Unsupported export format: ${format}`);
  }
}

// ── MARK READY TO PUBLISH ────────────────────────────────

export async function markReadyToPublish(
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    const product = await env.DB.prepare(
      "SELECT * FROM products WHERE id = ?",
    )
      .bind(productId)
      .first();

    if (!product) return notFound(`Product not found: ${productId}`);

    const status = product.status as string;
    if (status !== "approved") {
      return badRequest(
        `Product "${productId}" must be in "approved" status to mark as ready_to_publish (current: ${status}).`,
      );
    }

    const now = new Date().toISOString();

    await env.DB.prepare(
      "UPDATE products SET status = 'ready_to_publish', updated_at = ? WHERE id = ?",
    )
      .bind(now, productId)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM products WHERE id = ?",
    )
      .bind(productId)
      .first();

    return json({
      data: updated,
      message: `Product ${productId} marked as ready_to_publish.`,
    });
  } catch (err) {
    console.error("[exports/ready-to-publish]", err);
    return serverError("Failed to mark product as ready to publish.");
  }
}
