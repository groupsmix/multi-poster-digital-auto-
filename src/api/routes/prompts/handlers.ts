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

// ── Valid role types (from architecture doc Section 9) ────

const VALID_ROLE_TYPES = [
  "master",
  "researcher",
  "planner",
  "creator",
  "adapter",
  "marketing",
  "social",
  "reviewer",
] as const;

type RoleType = (typeof VALID_ROLE_TYPES)[number];

function isValidRoleType(value: unknown): value is RoleType {
  return (
    typeof value === "string" &&
    (VALID_ROLE_TYPES as readonly string[]).includes(value)
  );
}

// ── Validation rules ──────────────────────────────────────

const PROMPT_CREATE_RULES: FieldRule[] = [
  { field: "name", required: true, type: "string", maxLength: 200 },
  { field: "role_type", required: true, type: "string" },
  { field: "scope_type", type: "string", maxLength: 100 },
  { field: "scope_ref", type: "string", maxLength: 200 },
  { field: "system_prompt", type: "string" },
  { field: "domain_prompt", type: "string" },
  { field: "platform_prompt", type: "string" },
  { field: "social_prompt", type: "string" },
  { field: "category_prompt", type: "string" },
  { field: "quality_rules", type: "string" },
  { field: "output_schema", type: "string" },
  { field: "revision_prompt", type: "string" },
  { field: "notes", type: "string" },
];

const PROMPT_UPDATE_RULES: FieldRule[] = [
  { field: "name", type: "string", maxLength: 200 },
  { field: "role_type", type: "string" },
  { field: "scope_type", type: "string", maxLength: 100 },
  { field: "scope_ref", type: "string", maxLength: 200 },
  { field: "system_prompt", type: "string" },
  { field: "domain_prompt", type: "string" },
  { field: "platform_prompt", type: "string" },
  { field: "social_prompt", type: "string" },
  { field: "category_prompt", type: "string" },
  { field: "quality_rules", type: "string" },
  { field: "output_schema", type: "string" },
  { field: "revision_prompt", type: "string" },
  { field: "notes", type: "string" },
  { field: "is_active", type: "number" },
];

// ── LIST ──────────────────────────────────────────────────

export async function listPromptTemplates(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const roleType = url.searchParams.get("role_type");
    const activeOnly = url.searchParams.get("active");
    const name = url.searchParams.get("name");

    let query = "SELECT * FROM prompt_templates";
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (roleType) {
      conditions.push("role_type = ?");
      params.push(roleType);
    }

    if (activeOnly === "true") {
      conditions.push("is_active = 1");
    } else if (activeOnly === "false") {
      conditions.push("is_active = 0");
    }

    if (name) {
      conditions.push("name = ?");
      params.push(name);
    }

    if (conditions.length) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY name ASC, version DESC";

    const result = await env.DB.prepare(query).bind(...params).all();
    return json({ data: result.results, total: result.results.length });
  } catch (err) {
    console.error("[prompts/list]", err);
    return serverError("Failed to list prompt templates.");
  }
}

// ── GET ONE ───────────────────────────────────────────────

export async function getPromptTemplate(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const row = await env.DB.prepare(
      "SELECT * FROM prompt_templates WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!row) return notFound(`Prompt template not found: ${id}`);
    return json({ data: row });
  } catch (err) {
    console.error("[prompts/get]", err);
    return serverError("Failed to fetch prompt template.");
  }
}

// ── CREATE ────────────────────────────────────────────────

export async function createPromptTemplate(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const errors = validateFields(body, PROMPT_CREATE_RULES);
  if (errors.length) return badRequest(errors.join(" "));

  if (!isValidRoleType(body.role_type)) {
    return badRequest(
      `Invalid role_type "${body.role_type}". Must be one of: ${VALID_ROLE_TYPES.join(", ")}`,
    );
  }

  const name = body.name as string;
  const roleType = body.role_type as string;

  try {
    // Determine version: max existing version for this name + 1
    const maxVersionRow = await env.DB.prepare(
      "SELECT MAX(version) as max_v FROM prompt_templates WHERE name = ?",
    )
      .bind(name)
      .first();

    const nextVersion =
      maxVersionRow && typeof maxVersionRow.max_v === "number"
        ? maxVersionRow.max_v + 1
        : 1;

    const id = generateId("pt_");
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO prompt_templates
         (id, name, role_type, version, scope_type, scope_ref,
          system_prompt, domain_prompt, platform_prompt, social_prompt,
          category_prompt, quality_rules, output_schema, revision_prompt,
          is_active, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    )
      .bind(
        id,
        name,
        roleType,
        nextVersion,
        (body.scope_type as string) || null,
        (body.scope_ref as string) || null,
        (body.system_prompt as string) || null,
        (body.domain_prompt as string) || null,
        (body.platform_prompt as string) || null,
        (body.social_prompt as string) || null,
        (body.category_prompt as string) || null,
        (body.quality_rules as string) || null,
        (body.output_schema as string) || null,
        (body.revision_prompt as string) || null,
        (body.notes as string) || null,
        now,
        now,
      )
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM prompt_templates WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: created }, 201);
  } catch (err) {
    console.error("[prompts/create]", err);
    return serverError("Failed to create prompt template.");
  }
}

// ── CREATE NEW VERSION ────────────────────────────────────

/**
 * POST /api/prompts/:id/version
 *
 * Creates a new version of an existing prompt template.
 * Copies all fields from the source, allows overrides via request body,
 * and bumps the version number.
 */
export async function createPromptVersion(
  request: Request,
  env: Env,
  sourceId: string,
): Promise<Response> {
  try {
    const source = await env.DB.prepare(
      "SELECT * FROM prompt_templates WHERE id = ?",
    )
      .bind(sourceId)
      .first();

    if (!source) return notFound(`Prompt template not found: ${sourceId}`);

    const body = (await parseJsonBody(request)) ?? {};

    // Get next version for this prompt name
    const maxVersionRow = await env.DB.prepare(
      "SELECT MAX(version) as max_v FROM prompt_templates WHERE name = ?",
    )
      .bind(source.name)
      .first();

    const nextVersion =
      maxVersionRow && typeof maxVersionRow.max_v === "number"
        ? maxVersionRow.max_v + 1
        : 1;

    const id = generateId("pt_");
    const now = new Date().toISOString();

    // Merge: body overrides source fields
    const merged = {
      system_prompt: (body.system_prompt as string) ?? source.system_prompt,
      domain_prompt: (body.domain_prompt as string) ?? source.domain_prompt,
      platform_prompt:
        (body.platform_prompt as string) ?? source.platform_prompt,
      social_prompt: (body.social_prompt as string) ?? source.social_prompt,
      category_prompt:
        (body.category_prompt as string) ?? source.category_prompt,
      quality_rules: (body.quality_rules as string) ?? source.quality_rules,
      output_schema: (body.output_schema as string) ?? source.output_schema,
      revision_prompt:
        (body.revision_prompt as string) ?? source.revision_prompt,
      notes: (body.notes as string) ?? source.notes,
    };

    await env.DB.prepare(
      `INSERT INTO prompt_templates
         (id, name, role_type, version, scope_type, scope_ref,
          system_prompt, domain_prompt, platform_prompt, social_prompt,
          category_prompt, quality_rules, output_schema, revision_prompt,
          is_active, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    )
      .bind(
        id,
        source.name,
        source.role_type,
        nextVersion,
        source.scope_type,
        source.scope_ref,
        merged.system_prompt,
        merged.domain_prompt,
        merged.platform_prompt,
        merged.social_prompt,
        merged.category_prompt,
        merged.quality_rules,
        merged.output_schema,
        merged.revision_prompt,
        merged.notes,
        now,
        now,
      )
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM prompt_templates WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: created }, 201);
  } catch (err) {
    console.error("[prompts/create-version]", err);
    return serverError("Failed to create prompt version.");
  }
}

// ── ACTIVATE / DEACTIVATE ─────────────────────────────────

/**
 * POST /api/prompts/:id/activate
 *
 * Activates this version and deactivates all other versions
 * of the same prompt name, so only one version is active at a time.
 */
export async function activatePromptVersion(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const target = await env.DB.prepare(
      "SELECT * FROM prompt_templates WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!target) return notFound(`Prompt template not found: ${id}`);

    const now = new Date().toISOString();

    // Deactivate all versions of this prompt name
    await env.DB.prepare(
      "UPDATE prompt_templates SET is_active = 0, updated_at = ? WHERE name = ?",
    )
      .bind(now, target.name)
      .run();

    // Activate the target version
    await env.DB.prepare(
      "UPDATE prompt_templates SET is_active = 1, updated_at = ? WHERE id = ?",
    )
      .bind(now, id)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM prompt_templates WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: updated, message: "Version activated." });
  } catch (err) {
    console.error("[prompts/activate]", err);
    return serverError("Failed to activate prompt version.");
  }
}

// ── UPDATE ────────────────────────────────────────────────

export async function updatePromptTemplate(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const errors = validateFields(body, PROMPT_UPDATE_RULES);
  if (errors.length) return badRequest(errors.join(" "));

  if (body.role_type !== undefined && !isValidRoleType(body.role_type)) {
    return badRequest(
      `Invalid role_type "${body.role_type}". Must be one of: ${VALID_ROLE_TYPES.join(", ")}`,
    );
  }

  try {
    const existing = await env.DB.prepare(
      "SELECT * FROM prompt_templates WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Prompt template not found: ${id}`);

    const sets: string[] = [];
    const values: unknown[] = [];

    const stringFields = [
      "name",
      "role_type",
      "scope_type",
      "scope_ref",
      "system_prompt",
      "domain_prompt",
      "platform_prompt",
      "social_prompt",
      "category_prompt",
      "quality_rules",
      "output_schema",
      "revision_prompt",
      "notes",
    ] as const;

    for (const field of stringFields) {
      if (body[field] !== undefined) {
        sets.push(`${field} = ?`);
        values.push(typeof body[field] === "string" ? body[field] : null);
      }
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
      `UPDATE prompt_templates SET ${sets.join(", ")} WHERE id = ?`,
    )
      .bind(...values)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM prompt_templates WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: updated });
  } catch (err) {
    console.error("[prompts/update]", err);
    return serverError("Failed to update prompt template.");
  }
}

// ── DELETE (soft-delete) ──────────────────────────────────

export async function deletePromptTemplate(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM prompt_templates WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Prompt template not found: ${id}`);

    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE prompt_templates SET is_active = 0, updated_at = ? WHERE id = ?",
    )
      .bind(now, id)
      .run();

    return json({ message: "Prompt template deactivated.", id });
  } catch (err) {
    console.error("[prompts/delete]", err);
    return serverError("Failed to delete prompt template.");
  }
}
