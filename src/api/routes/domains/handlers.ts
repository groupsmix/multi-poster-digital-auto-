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

const DOMAIN_CREATE_RULES: FieldRule[] = [
  { field: "name", required: true, type: "string", maxLength: 200 },
  { field: "slug", type: "string", maxLength: 200 },
  { field: "icon", type: "string", maxLength: 100 },
  { field: "description", type: "string", maxLength: 2000 },
];

const DOMAIN_UPDATE_RULES: FieldRule[] = [
  { field: "name", type: "string", maxLength: 200 },
  { field: "slug", type: "string", maxLength: 200 },
  { field: "icon", type: "string", maxLength: 100 },
  { field: "description", type: "string", maxLength: 2000 },
  { field: "sort_order", type: "number" },
  { field: "is_active", type: "number" },
];

// ── LIST ──────────────────────────────────────────────────

export async function listDomains(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("active");

    let query = "SELECT * FROM domains";
    const params: unknown[] = [];

    if (activeOnly === "true") {
      query += " WHERE is_active = 1";
    } else if (activeOnly === "false") {
      query += " WHERE is_active = 0";
    }

    query += " ORDER BY sort_order ASC, name ASC";

    const result = await env.DB.prepare(query).bind(...params).all();
    return json({ data: result.results, total: result.results.length });
  } catch (err) {
    console.error("[domains/list]", err);
    return serverError("Failed to list domains.");
  }
}

// ── GET ONE ───────────────────────────────────────────────

export async function getDomain(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const row = await env.DB.prepare("SELECT * FROM domains WHERE id = ?")
      .bind(id)
      .first();

    if (!row) return notFound(`Domain not found: ${id}`);
    return json({ data: row });
  } catch (err) {
    console.error("[domains/get]", err);
    return serverError("Failed to fetch domain.");
  }
}

// ── CREATE ────────────────────────────────────────────────

export async function createDomain(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const errors = validateFields(body, DOMAIN_CREATE_RULES);
  if (errors.length) return badRequest(errors.join(" "));

  const name = body.name as string;
  const slug = typeof body.slug === "string" && body.slug ? toSlug(body.slug) : toSlug(name);
  const icon = (body.icon as string) || null;
  const description = (body.description as string) || null;
  const sortOrder = typeof body.sort_order === "number" ? body.sort_order : 0;

  // Check slug uniqueness
  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM domains WHERE slug = ?",
    )
      .bind(slug)
      .first();

    if (existing) {
      return badRequest(`A domain with slug "${slug}" already exists.`);
    }

    const id = generateId("dom_");
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO domains (id, name, slug, icon, description, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
      .bind(id, name, slug, icon, description, sortOrder, now, now)
      .run();

    const created = await env.DB.prepare("SELECT * FROM domains WHERE id = ?")
      .bind(id)
      .first();

    return json({ data: created }, 201);
  } catch (err) {
    console.error("[domains/create]", err);
    return serverError("Failed to create domain.");
  }
}

// ── UPDATE ────────────────────────────────────────────────

export async function updateDomain(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const errors = validateFields(body, DOMAIN_UPDATE_RULES);
  if (errors.length) return badRequest(errors.join(" "));

  try {
    // Verify domain exists
    const existing = await env.DB.prepare("SELECT * FROM domains WHERE id = ?")
      .bind(id)
      .first();

    if (!existing) return notFound(`Domain not found: ${id}`);

    // Build dynamic SET clause
    const sets: string[] = [];
    const values: unknown[] = [];

    if (typeof body.name === "string") {
      sets.push("name = ?");
      values.push(body.name);
    }

    if (typeof body.slug === "string") {
      const newSlug = toSlug(body.slug);
      // Check uniqueness (exclude self)
      const slugConflict = await env.DB.prepare(
        "SELECT id FROM domains WHERE slug = ? AND id != ?",
      )
        .bind(newSlug, id)
        .first();
      if (slugConflict) {
        return badRequest(`A domain with slug "${newSlug}" already exists.`);
      }
      sets.push("slug = ?");
      values.push(newSlug);
    }

    if (body.icon !== undefined) {
      sets.push("icon = ?");
      values.push(typeof body.icon === "string" ? body.icon : null);
    }

    if (body.description !== undefined) {
      sets.push("description = ?");
      values.push(typeof body.description === "string" ? body.description : null);
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
      `UPDATE domains SET ${sets.join(", ")} WHERE id = ?`,
    )
      .bind(...values)
      .run();

    const updated = await env.DB.prepare("SELECT * FROM domains WHERE id = ?")
      .bind(id)
      .first();

    return json({ data: updated });
  } catch (err) {
    console.error("[domains/update]", err);
    return serverError("Failed to update domain.");
  }
}

// ── DELETE (soft-delete) ──────────────────────────────────

export async function deleteDomain(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const existing = await env.DB.prepare("SELECT id FROM domains WHERE id = ?")
      .bind(id)
      .first();

    if (!existing) return notFound(`Domain not found: ${id}`);

    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE domains SET is_active = 0, updated_at = ? WHERE id = ?",
    )
      .bind(now, id)
      .run();

    return json({ message: "Domain deactivated.", id });
  } catch (err) {
    console.error("[domains/delete]", err);
    return serverError("Failed to delete domain.");
  }
}
