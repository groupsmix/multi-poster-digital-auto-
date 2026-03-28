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

const PLATFORM_CREATE_RULES: FieldRule[] = [
  { field: "name", required: true, type: "string", maxLength: 200 },
  { field: "type", type: "string", maxLength: 100 },
  { field: "title_limit", type: "number" },
  { field: "description_rules", type: "string" },
  { field: "tag_rules", type: "string" },
  { field: "seo_rules", type: "string" },
  { field: "audience_profile", type: "string" },
  { field: "tone_profile", type: "string" },
  { field: "cta_style", type: "string" },
];

const PLATFORM_UPDATE_RULES: FieldRule[] = [
  { field: "name", type: "string", maxLength: 200 },
  { field: "type", type: "string", maxLength: 100 },
  { field: "title_limit", type: "number" },
  { field: "description_rules", type: "string" },
  { field: "tag_rules", type: "string" },
  { field: "seo_rules", type: "string" },
  { field: "audience_profile", type: "string" },
  { field: "tone_profile", type: "string" },
  { field: "cta_style", type: "string" },
  { field: "sort_order", type: "number" },
  { field: "is_active", type: "number" },
];

// ── LIST ──────────────────────────────────────────────────

export async function listPlatforms(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("active");

    let query = "SELECT * FROM platforms";
    if (activeOnly === "true") {
      query += " WHERE is_active = 1";
    } else if (activeOnly === "false") {
      query += " WHERE is_active = 0";
    }
    query += " ORDER BY sort_order ASC, name ASC";

    const result = await env.DB.prepare(query).all();
    return json({ data: result.results, total: result.results.length });
  } catch (err) {
    console.error("[platforms/list]", err);
    return serverError("Failed to list platforms.");
  }
}

// ── GET ONE ───────────────────────────────────────────────

export async function getPlatform(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const row = await env.DB.prepare("SELECT * FROM platforms WHERE id = ?")
      .bind(id)
      .first();
    if (!row) return notFound(`Platform not found: ${id}`);
    return json({ data: row });
  } catch (err) {
    console.error("[platforms/get]", err);
    return serverError("Failed to fetch platform.");
  }
}

// ── CREATE ────────────────────────────────────────────────

export async function createPlatform(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const errors = validateFields(body, PLATFORM_CREATE_RULES);
  if (errors.length) return badRequest(errors.join(" "));

  const name = body.name as string;

  // Check name uniqueness (platforms use name, not slug, as the unique key)
  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM platforms WHERE name = ?",
    )
      .bind(name)
      .first();

    if (existing) {
      return badRequest(`A platform with name "${name}" already exists.`);
    }

    const id = generateId("plat_");
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO platforms
         (id, name, type, title_limit, description_rules, tag_rules, seo_rules,
          audience_profile, tone_profile, cta_style, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
      .bind(
        id,
        name,
        (body.type as string) || null,
        typeof body.title_limit === "number" ? body.title_limit : null,
        (body.description_rules as string) || null,
        (body.tag_rules as string) || null,
        (body.seo_rules as string) || null,
        (body.audience_profile as string) || null,
        (body.tone_profile as string) || null,
        (body.cta_style as string) || null,
        typeof body.sort_order === "number" ? body.sort_order : 0,
        now,
        now,
      )
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM platforms WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: created }, 201);
  } catch (err) {
    console.error("[platforms/create]", err);
    return serverError("Failed to create platform.");
  }
}

// ── UPDATE ────────────────────────────────────────────────

export async function updatePlatform(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const errors = validateFields(body, PLATFORM_UPDATE_RULES);
  if (errors.length) return badRequest(errors.join(" "));

  try {
    const existing = await env.DB.prepare(
      "SELECT * FROM platforms WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Platform not found: ${id}`);

    const sets: string[] = [];
    const values: unknown[] = [];

    const stringFields = [
      "name",
      "type",
      "description_rules",
      "tag_rules",
      "seo_rules",
      "audience_profile",
      "tone_profile",
      "cta_style",
    ] as const;

    for (const field of stringFields) {
      if (typeof body[field] === "string") {
        sets.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    // Check name uniqueness if changing name
    if (typeof body.name === "string") {
      const nameConflict = await env.DB.prepare(
        "SELECT id FROM platforms WHERE name = ? AND id != ?",
      )
        .bind(body.name as string, id)
        .first();
      if (nameConflict) {
        return badRequest(
          `A platform with name "${body.name}" already exists.`,
        );
      }
    }

    if (typeof body.title_limit === "number") {
      sets.push("title_limit = ?");
      values.push(body.title_limit);
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
      `UPDATE platforms SET ${sets.join(", ")} WHERE id = ?`,
    )
      .bind(...values)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM platforms WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: updated });
  } catch (err) {
    console.error("[platforms/update]", err);
    return serverError("Failed to update platform.");
  }
}

// ── DELETE (soft-delete) ──────────────────────────────────

export async function deletePlatform(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM platforms WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Platform not found: ${id}`);

    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE platforms SET is_active = 0, updated_at = ? WHERE id = ?",
    )
      .bind(now, id)
      .run();

    return json({ message: "Platform deactivated.", id });
  } catch (err) {
    console.error("[platforms/delete]", err);
    return serverError("Failed to delete platform.");
  }
}
