import { Env } from "../../../shared/types";
import {
  json,
  notFound,
  badRequest,
  serverError,
  generateId,
  parseJsonBody,
  validateFields,
} from "../../../shared/utils";

// ── List Products ──────────────────────────────────────────

export async function listProducts(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const domainId = url.searchParams.get("domain_id");
    const categoryId = url.searchParams.get("category_id");
    const status = url.searchParams.get("status");
    const active = url.searchParams.get("active");

    let query = "SELECT * FROM products";
    const conditions: string[] = [];
    const binds: unknown[] = [];

    if (domainId) {
      conditions.push("domain_id = ?");
      binds.push(domainId);
    }
    if (categoryId) {
      conditions.push("category_id = ?");
      binds.push(categoryId);
    }
    if (status) {
      conditions.push("status = ?");
      binds.push(status);
    }
    if (active === "true") {
      conditions.push("status != 'archived'");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY created_at DESC";

    const stmt = env.DB.prepare(query);
    const result = binds.length > 0
      ? await stmt.bind(...binds).all()
      : await stmt.all();

    return json({ data: result.results, total: result.results.length });
  } catch (err) {
    console.error("[products/list]", err);
    return serverError("Failed to list products.");
  }
}

// ── Get Product ────────────────────────────────────────────

export async function getProduct(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const product = await env.DB.prepare(
      "SELECT * FROM products WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!product) return notFound(`Product not found: ${id}`);

    // Fetch variants for this product
    const variants = await env.DB.prepare(
      "SELECT * FROM product_variants WHERE product_id = ? ORDER BY variant_type ASC, version DESC",
    )
      .bind(id)
      .all();

    // Fetch latest workflow run
    const latestRun = await env.DB.prepare(
      "SELECT * FROM workflow_runs WHERE product_id = ? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(id)
      .first();

    return json({
      data: {
        ...product,
        variants: variants.results,
        latest_run: latestRun,
      },
    });
  } catch (err) {
    console.error("[products/get]", err);
    return serverError("Failed to get product.");
  }
}

// ── Create Product ─────────────────────────────────────────

export async function createProduct(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = await parseJsonBody(request);
    if (!body) return badRequest("Invalid or empty JSON body.");

    const errors = validateFields(body, [
      { field: "idea", required: true, type: "string", maxLength: 2000 },
      { field: "domain_id", required: true, type: "string" },
    ]);
    if (errors.length > 0) return badRequest(errors.join(" "));

    // Validate domain exists
    const domain = await env.DB.prepare(
      "SELECT id FROM domains WHERE id = ?",
    )
      .bind(body.domain_id as string)
      .first();
    if (!domain) return badRequest("Parent domain not found.");

    // Validate category if provided
    if (body.category_id) {
      const category = await env.DB.prepare(
        "SELECT id FROM categories WHERE id = ?",
      )
        .bind(body.category_id as string)
        .first();
      if (!category) return badRequest("Category not found.");
    }

    // Validate workflow template if provided
    if (body.workflow_template_id) {
      const template = await env.DB.prepare(
        "SELECT id FROM workflow_templates WHERE id = ?",
      )
        .bind(body.workflow_template_id as string)
        .first();
      if (!template) return badRequest("Workflow template not found.");
    }

    // Validate target platforms if provided
    if (body.target_platforms_json) {
      if (typeof body.target_platforms_json === "string") {
        try {
          JSON.parse(body.target_platforms_json as string);
        } catch {
          return badRequest("target_platforms_json must be valid JSON.");
        }
      } else if (Array.isArray(body.target_platforms_json)) {
        body.target_platforms_json = JSON.stringify(body.target_platforms_json);
      }
    }

    // Validate target social channels if provided
    if (body.target_social_json) {
      if (typeof body.target_social_json === "string") {
        try {
          JSON.parse(body.target_social_json as string);
        } catch {
          return badRequest("target_social_json must be valid JSON.");
        }
      } else if (Array.isArray(body.target_social_json)) {
        body.target_social_json = JSON.stringify(body.target_social_json);
      }
    }

    const id = generateId("prod_");
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO products (id, domain_id, category_id, idea, notes, status, current_version,
        workflow_template_id, target_platforms_json, social_enabled, target_social_json,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        body.domain_id as string,
        (body.category_id as string) || null,
        body.idea as string,
        (body.notes as string) || null,
        (body.workflow_template_id as string) || null,
        (body.target_platforms_json as string) || null,
        body.social_enabled ? 1 : 0,
        (body.target_social_json as string) || null,
        now,
        now,
      )
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM products WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: created, message: `Product ${id} created.` }, 201);
  } catch (err) {
    console.error("[products/create]", err);
    return serverError("Failed to create product.");
  }
}

// ── Update Product ─────────────────────────────────────────

export async function updateProduct(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const existing = await env.DB.prepare(
      "SELECT * FROM products WHERE id = ?",
    )
      .bind(id)
      .first();
    if (!existing) return notFound(`Product not found: ${id}`);

    const body = await parseJsonBody(request);
    if (!body) return badRequest("Invalid or empty JSON body.");

    const updatableFields = [
      "idea", "notes", "status", "category_id",
      "workflow_template_id", "target_platforms_json",
      "social_enabled", "target_social_json",
    ];

    const setClauses: string[] = [];
    const binds: unknown[] = [];

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        if (field === "target_platforms_json" || field === "target_social_json") {
          const val = body[field];
          if (Array.isArray(val)) {
            setClauses.push(`${field} = ?`);
            binds.push(JSON.stringify(val));
          } else if (typeof val === "string") {
            setClauses.push(`${field} = ?`);
            binds.push(val);
          } else if (val === null) {
            setClauses.push(`${field} = ?`);
            binds.push(null);
          }
        } else if (field === "social_enabled") {
          setClauses.push(`${field} = ?`);
          binds.push(body[field] ? 1 : 0);
        } else {
          setClauses.push(`${field} = ?`);
          binds.push(body[field] as string);
        }
      }
    }

    if (setClauses.length === 0) {
      return badRequest("No updatable fields provided.");
    }

    setClauses.push("updated_at = ?");
    binds.push(new Date().toISOString());
    binds.push(id);

    await env.DB.prepare(
      `UPDATE products SET ${setClauses.join(", ")} WHERE id = ?`,
    )
      .bind(...binds)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM products WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: updated, message: `Product ${id} updated.` });
  } catch (err) {
    console.error("[products/update]", err);
    return serverError("Failed to update product.");
  }
}

// ── Delete Product (soft) ──────────────────────────────────

export async function deleteProduct(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM products WHERE id = ?",
    )
      .bind(id)
      .first();
    if (!existing) return notFound(`Product not found: ${id}`);

    await env.DB.prepare(
      "UPDATE products SET status = 'archived', updated_at = ? WHERE id = ?",
    )
      .bind(new Date().toISOString(), id)
      .run();

    return json({ message: `Product ${id} archived.` });
  } catch (err) {
    console.error("[products/delete]", err);
    return serverError("Failed to archive product.");
  }
}

// ── List Product Variants ──────────────────────────────────

export async function listProductVariants(
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    const product = await env.DB.prepare(
      "SELECT id FROM products WHERE id = ?",
    )
      .bind(productId)
      .first();
    if (!product) return notFound(`Product not found: ${productId}`);

    const variants = await env.DB.prepare(
      "SELECT * FROM product_variants WHERE product_id = ? ORDER BY variant_type ASC, version DESC",
    )
      .bind(productId)
      .all();

    return json({ data: variants.results, total: variants.results.length });
  } catch (err) {
    console.error("[products/variants/list]", err);
    return serverError("Failed to list product variants.");
  }
}

// ── Create Product Variant ─────────────────────────────────

export async function createProductVariant(
  request: Request,
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    const product = await env.DB.prepare(
      "SELECT id, current_version FROM products WHERE id = ?",
    )
      .bind(productId)
      .first();
    if (!product) return notFound(`Product not found: ${productId}`);

    const body = await parseJsonBody(request);
    if (!body) return badRequest("Invalid or empty JSON body.");

    const variantType = (body.variant_type as string) || "base";
    if (!["base", "platform", "social"].includes(variantType)) {
      return badRequest("variant_type must be one of: base, platform, social");
    }

    if (variantType === "platform" && !body.platform_id) {
      return badRequest("platform_id is required for platform variants.");
    }
    if (variantType === "social" && !body.social_channel_id) {
      return badRequest("social_channel_id is required for social variants.");
    }

    const id = generateId("var_");
    const version = (product.current_version as number) || 1;
    const now = new Date().toISOString();

    // Handle JSON fields
    const seoJson = body.seo_json
      ? (typeof body.seo_json === "string" ? body.seo_json : JSON.stringify(body.seo_json))
      : null;
    const contentJson = body.content_json
      ? (typeof body.content_json === "string" ? body.content_json : JSON.stringify(body.content_json))
      : null;
    const assetRefsJson = body.asset_refs_json
      ? (typeof body.asset_refs_json === "string" ? body.asset_refs_json : JSON.stringify(body.asset_refs_json))
      : null;

    await env.DB.prepare(
      `INSERT INTO product_variants
        (id, product_id, version, platform_id, social_channel_id, variant_type,
         title, description, price_suggestion, seo_json, content_json, asset_refs_json,
         status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    )
      .bind(
        id,
        productId,
        version,
        (body.platform_id as string) || null,
        (body.social_channel_id as string) || null,
        variantType,
        (body.title as string) || null,
        (body.description as string) || null,
        (body.price_suggestion as string) || null,
        seoJson,
        contentJson,
        assetRefsJson,
        now,
        now,
      )
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM product_variants WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: created, message: `Variant ${id} created.` }, 201);
  } catch (err) {
    console.error("[products/variants/create]", err);
    return serverError("Failed to create product variant.");
  }
}

// ── Update Product Variant ─────────────────────────────────

export async function updateVariant(
  request: Request,
  env: Env,
  variantId: string,
): Promise<Response> {
  try {
    const existing = await env.DB.prepare(
      "SELECT * FROM product_variants WHERE id = ?",
    )
      .bind(variantId)
      .first();
    if (!existing) return notFound(`Variant not found: ${variantId}`);

    const body = await parseJsonBody(request);
    if (!body) return badRequest("Invalid or empty JSON body.");

    const updatableFields = [
      "title", "description", "price_suggestion", "status",
    ];

    const setClauses: string[] = [];
    const binds: unknown[] = [];

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        binds.push(body[field] as string);
      }
    }

    // Handle JSON fields
    for (const jsonField of ["seo_json", "content_json", "asset_refs_json"]) {
      if (body[jsonField] !== undefined) {
        const val = body[jsonField];
        setClauses.push(`${jsonField} = ?`);
        binds.push(
          val === null ? null :
          typeof val === "string" ? val : JSON.stringify(val),
        );
      }
    }

    if (setClauses.length === 0) {
      return badRequest("No updatable fields provided.");
    }

    setClauses.push("updated_at = ?");
    binds.push(new Date().toISOString());
    binds.push(variantId);

    await env.DB.prepare(
      `UPDATE product_variants SET ${setClauses.join(", ")} WHERE id = ?`,
    )
      .bind(...binds)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM product_variants WHERE id = ?",
    )
      .bind(variantId)
      .first();

    return json({ data: updated, message: `Variant ${variantId} updated.` });
  } catch (err) {
    console.error("[products/variants/update]", err);
    return serverError("Failed to update variant.");
  }
}

// ── Delete Product Variant (soft) ──────────────────────────

export async function deleteVariant(
  env: Env,
  variantId: string,
): Promise<Response> {
  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM product_variants WHERE id = ?",
    )
      .bind(variantId)
      .first();
    if (!existing) return notFound(`Variant not found: ${variantId}`);

    await env.DB.prepare(
      "UPDATE product_variants SET status = 'archived', updated_at = ? WHERE id = ?",
    )
      .bind(new Date().toISOString(), variantId)
      .run();

    return json({ message: `Variant ${variantId} archived.` });
  } catch (err) {
    console.error("[products/variants/delete]", err);
    return serverError("Failed to archive variant.");
  }
}
