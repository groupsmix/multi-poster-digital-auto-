import { Env } from "../../../shared/types";
import {
  json,
  badRequest,
  notFound,
  serverError,
  generateId,
  validateFields,
  parseJsonBody,
} from "../../../shared/utils";
import type { FieldRule } from "../../../shared/utils";

// ── Validation rules ──────────────────────────────────────

const SOCIAL_CREATE_RULES: FieldRule[] = [
  { field: "name", required: true, type: "string", maxLength: 200 },
  { field: "caption_rules", type: "string" },
  { field: "hashtag_rules", type: "string" },
  { field: "length_rules", type: "string" },
  { field: "audience_style", type: "string" },
  { field: "tone_profile", type: "string" },
];

const SOCIAL_UPDATE_RULES: FieldRule[] = [
  { field: "name", type: "string", maxLength: 200 },
  { field: "caption_rules", type: "string" },
  { field: "hashtag_rules", type: "string" },
  { field: "length_rules", type: "string" },
  { field: "audience_style", type: "string" },
  { field: "tone_profile", type: "string" },
  { field: "sort_order", type: "number" },
  { field: "is_active", type: "number" },
];

// ── LIST ──────────────────────────────────────────────────

export async function listSocialChannels(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("active");

    let query = "SELECT * FROM social_channels";
    if (activeOnly === "true") {
      query += " WHERE is_active = 1";
    } else if (activeOnly === "false") {
      query += " WHERE is_active = 0";
    }
    query += " ORDER BY sort_order ASC, name ASC";

    const result = await env.DB.prepare(query).all();
    return json({ data: result.results, total: result.results.length });
  } catch (err) {
    console.error("[social-channels/list]", err);
    return serverError("Failed to list social channels.");
  }
}

// ── GET ONE ───────────────────────────────────────────────

export async function getSocialChannel(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const row = await env.DB.prepare(
      "SELECT * FROM social_channels WHERE id = ?",
    )
      .bind(id)
      .first();
    if (!row) return notFound(`Social channel not found: ${id}`);
    return json({ data: row });
  } catch (err) {
    console.error("[social-channels/get]", err);
    return serverError("Failed to fetch social channel.");
  }
}

// ── CREATE ────────────────────────────────────────────────

export async function createSocialChannel(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const errors = validateFields(body, SOCIAL_CREATE_RULES);
  if (errors.length) return badRequest(errors.join(" "));

  const name = body.name as string;

  try {
    // Check name uniqueness
    const existing = await env.DB.prepare(
      "SELECT id FROM social_channels WHERE name = ?",
    )
      .bind(name)
      .first();

    if (existing) {
      return badRequest(
        `A social channel with name "${name}" already exists.`,
      );
    }

    const id = generateId("sc_");
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO social_channels
         (id, name, caption_rules, hashtag_rules, length_rules, audience_style,
          tone_profile, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
      .bind(
        id,
        name,
        (body.caption_rules as string) || null,
        (body.hashtag_rules as string) || null,
        (body.length_rules as string) || null,
        (body.audience_style as string) || null,
        (body.tone_profile as string) || null,
        typeof body.sort_order === "number" ? body.sort_order : 0,
        now,
        now,
      )
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM social_channels WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: created }, 201);
  } catch (err) {
    console.error("[social-channels/create]", err);
    return serverError("Failed to create social channel.");
  }
}

// ── UPDATE ────────────────────────────────────────────────

export async function updateSocialChannel(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const errors = validateFields(body, SOCIAL_UPDATE_RULES);
  if (errors.length) return badRequest(errors.join(" "));

  try {
    const existing = await env.DB.prepare(
      "SELECT * FROM social_channels WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Social channel not found: ${id}`);

    const sets: string[] = [];
    const values: unknown[] = [];

    const stringFields = [
      "name",
      "caption_rules",
      "hashtag_rules",
      "length_rules",
      "audience_style",
      "tone_profile",
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
        "SELECT id FROM social_channels WHERE name = ? AND id != ?",
      )
        .bind(body.name as string, id)
        .first();
      if (nameConflict) {
        return badRequest(
          `A social channel with name "${body.name}" already exists.`,
        );
      }
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
      `UPDATE social_channels SET ${sets.join(", ")} WHERE id = ?`,
    )
      .bind(...values)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM social_channels WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: updated });
  } catch (err) {
    console.error("[social-channels/update]", err);
    return serverError("Failed to update social channel.");
  }
}

// ── DELETE (soft-delete) ──────────────────────────────────

export async function deleteSocialChannel(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM social_channels WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Social channel not found: ${id}`);

    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE social_channels SET is_active = 0, updated_at = ? WHERE id = ?",
    )
      .bind(now, id)
      .run();

    return json({ message: "Social channel deactivated.", id });
  } catch (err) {
    console.error("[social-channels/delete]", err);
    return serverError("Failed to delete social channel.");
  }
}
