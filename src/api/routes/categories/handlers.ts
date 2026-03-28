import { Env } from "../../../shared/types";
import {
  json,
  badRequest,
  notFound,
  serverError,
  generateId,
  toSlug,
  validateFields,
  parseJsonBody,
} from "../../../shared/utils";
import type { FieldRule } from "../../../shared/utils";

// ── Validation rules ──────────────────────────────────────

const CATEGORY_CREATE_RULES: FieldRule[] = [
  { field: "domain_id", required: true, type: "string" },
  { field: "name", required: true, type: "string", maxLength: 200 },
  { field: "slug", type: "string", maxLength: 200 },
  { field: "config_json", type: "string" },
];

const CATEGORY_UPDATE_RULES: FieldRule[] = [
  { field: "name", type: "string", maxLength: 200 },
  { field: "slug", type: "string", maxLength: 200 },
  { field: "config_json", type: "string" },
  { field: "sort_order", type: "number" },
  { field: "is_active", type: "number" },
];

// ── LIST ──────────────────────────────────────────────────

export async function listCategories(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const domainId = url.searchParams.get("domain_id");
    const activeOnly = url.searchParams.get("active");

    let query = "SELECT * FROM categories";
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (domainId) {
      conditions.push("domain_id = ?");
      params.push(domainId);
    }

    if (activeOnly === "true") {
      conditions.push("is_active = 1");
    } else if (activeOnly === "false") {
      conditions.push("is_active = 0");
    }

    if (conditions.length) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY sort_order ASC, name ASC";

    const result = await env.DB.prepare(query).bind(...params).all();
    return json({ data: result.results, total: result.results.length });
  } catch (err) {
    console.error("[categories/list]", err);
    return serverError("Failed to list categories.");
  }
}

// ── GET ONE ───────────────────────────────────────────────

export async function getCategory(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const row = await env.DB.prepare("SELECT * FROM categories WHERE id = ?")
      .bind(id)
      .first();

    if (!row) return notFound(`Category not found: ${id}`);
    return json({ data: row });
  } catch (err) {
    console.error("[categories/get]", err);
    return serverError("Failed to fetch category.");
  }
}

// ── CREATE ────────────────────────────────────────────────

export async function createCategory(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const errors = validateFields(body, CATEGORY_CREATE_RULES);
  if (errors.length) return badRequest(errors.join(" "));

  const domainId = body.domain_id as string;
  const name = body.name as string;
  const slug = typeof body.slug === "string" && body.slug ? toSlug(body.slug) : toSlug(name);
  const configJson = (body.config_json as string) || null;
  const sortOrder = typeof body.sort_order === "number" ? body.sort_order : 0;

  try {
    // Verify parent domain exists
    const domain = await env.DB.prepare("SELECT id FROM domains WHERE id = ?")
      .bind(domainId)
      .first();

    if (!domain) {
      return badRequest(`Parent domain not found: ${domainId}`);
    }

    // Check slug uniqueness within domain
    const existing = await env.DB.prepare(
      "SELECT id FROM categories WHERE domain_id = ? AND slug = ?",
    )
      .bind(domainId, slug)
      .first();

    if (existing) {
      return badRequest(
        `A category with slug "${slug}" already exists in this domain.`,
      );
    }

    const id = generateId("cat_");
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO categories (id, domain_id, name, slug, config_json, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
      .bind(id, domainId, name, slug, configJson, sortOrder, now, now)
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM categories WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: created }, 201);
  } catch (err) {
    console.error("[categories/create]", err);
    return serverError("Failed to create category.");
  }
}

// ── UPDATE ────────────────────────────────────────────────

export async function updateCategory(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const errors = validateFields(body, CATEGORY_UPDATE_RULES);
  if (errors.length) return badRequest(errors.join(" "));

  try {
    const existing = await env.DB.prepare(
      "SELECT * FROM categories WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Category not found: ${id}`);

    const domainId = existing.domain_id as string;

    const sets: string[] = [];
    const values: unknown[] = [];

    if (typeof body.name === "string") {
      sets.push("name = ?");
      values.push(body.name);
    }

    if (typeof body.slug === "string") {
      const newSlug = toSlug(body.slug);
      const slugConflict = await env.DB.prepare(
        "SELECT id FROM categories WHERE domain_id = ? AND slug = ? AND id != ?",
      )
        .bind(domainId, newSlug, id)
        .first();
      if (slugConflict) {
        return badRequest(
          `A category with slug "${newSlug}" already exists in this domain.`,
        );
      }
      sets.push("slug = ?");
      values.push(newSlug);
    }

    if (body.config_json !== undefined) {
      sets.push("config_json = ?");
      values.push(typeof body.config_json === "string" ? body.config_json : null);
    }

    if (typeof body.sort_order === "number") {
      sets.push("sort_order = ?");
      values.push(body.sort_order);
    }

    if (typeof body.is_active === "number") {
      sets.push("is_active = ?");
      values.push(body.is_active ? 1 : 0);
    }

    if (sets.length === 0) {
      return badRequest("No valid fields provided to update.");
    }

    sets.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);

    await env.DB.prepare(
      `UPDATE categories SET ${sets.join(", ")} WHERE id = ?`,
    )
      .bind(...values)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM categories WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: updated });
  } catch (err) {
    console.error("[categories/update]", err);
    return serverError("Failed to update category.");
  }
}

// ── DELETE (soft-delete) ──────────────────────────────────

export async function deleteCategory(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM categories WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Category not found: ${id}`);

    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE categories SET is_active = 0, updated_at = ? WHERE id = ?",
    )
      .bind(now, id)
      .run();

    return json({ message: "Category deactivated.", id });
  } catch (err) {
    console.error("[categories/delete]", err);
    return serverError("Failed to delete category.");
  }
}
