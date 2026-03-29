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

// ── Valid states and lanes (kept in sync with shared/types) ──

const VALID_STATES = [
  "active",
  "sleeping",
  "cooldown",
  "rate_limited",
  "error",
  "disabled",
] as const;

const VALID_TASK_LANES = [
  "search",
  "planning",
  "build",
  "structured_output",
  "review",
] as const;

// ── Validation rules ──────────────────────────────────────

const PROVIDER_CREATE_RULES: FieldRule[] = [
  { field: "name", required: true, type: "string", maxLength: 200 },
  { field: "provider", required: true, type: "string", maxLength: 100 },
  { field: "task_lane", required: true, type: "string", maxLength: 50 },
  { field: "model", type: "string", maxLength: 200 },
  { field: "tier", type: "number" },
  { field: "priority", type: "number" },
  { field: "notes", type: "string", maxLength: 2000 },
];

const PROVIDER_UPDATE_RULES: FieldRule[] = [
  { field: "name", type: "string", maxLength: 200 },
  { field: "provider", type: "string", maxLength: 100 },
  { field: "model", type: "string", maxLength: 200 },
  { field: "task_lane", type: "string", maxLength: 50 },
  { field: "tier", type: "number" },
  { field: "priority", type: "number" },
  { field: "notes", type: "string", maxLength: 2000 },
  { field: "is_active", type: "number" },
];

// ── LIST ──────────────────────────────────────────────────

export async function listProviders(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const taskLane = url.searchParams.get("task_lane");
    const state = url.searchParams.get("state");
    const activeOnly = url.searchParams.get("active");

    let query = "SELECT * FROM provider_configs";
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (taskLane) {
      conditions.push("task_lane = ?");
      params.push(taskLane);
    }
    if (state) {
      conditions.push("state = ?");
      params.push(state);
    }
    if (activeOnly === "true") {
      conditions.push("is_active = 1");
    } else if (activeOnly === "false") {
      conditions.push("is_active = 0");
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY task_lane ASC, tier ASC, priority ASC";

    const result = await env.DB.prepare(query).bind(...params).all();
    return json({ data: result.results, total: result.results.length });
  } catch (err) {
    console.error("[providers/list]", err);
    return serverError("Failed to list providers.");
  }
}

// ── GET ONE ───────────────────────────────────────────────

export async function getProvider(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const row = await env.DB.prepare(
      "SELECT * FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!row) return notFound(`Provider not found: ${id}`);

    // Check if cooldown has expired and auto-resolve
    const enriched = resolveProviderCooldown(row);
    return json({ data: enriched });
  } catch (err) {
    console.error("[providers/get]", err);
    return serverError("Failed to fetch provider.");
  }
}

// ── CREATE ────────────────────────────────────────────────

export async function createProvider(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const errors = validateFields(body, PROVIDER_CREATE_RULES);
  if (errors.length) return badRequest(errors.join(" "));

  const taskLane = body.task_lane as string;
  if (!VALID_TASK_LANES.includes(taskLane as typeof VALID_TASK_LANES[number])) {
    return badRequest(
      `Invalid task_lane "${taskLane}". Must be one of: ${VALID_TASK_LANES.join(", ")}`,
    );
  }

  const name = body.name as string;
  const provider = body.provider as string;
  const model = (body.model as string) || null;
  const tier = typeof body.tier === "number" ? body.tier : 0;
  const priority = typeof body.priority === "number" ? body.priority : 0;
  const notes = (body.notes as string) || null;
  const configJson = body.config_json
    ? JSON.stringify(body.config_json)
    : null;

  // Determine initial state: paid providers (tier >= 2) start sleeping
  const initialState = tier >= 2 ? "sleeping" : "active";

  try {
    const id = generateId("prov_");
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO provider_configs
         (id, name, provider, model, task_lane, tier, priority, state, has_api_key, config_json, notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?, ?)`,
    )
      .bind(
        id, name, provider, model, taskLane,
        tier, priority, initialState, configJson, notes,
        now, now,
      )
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: created }, 201);
  } catch (err) {
    console.error("[providers/create]", err);
    return serverError("Failed to create provider.");
  }
}

// ── UPDATE ────────────────────────────────────────────────

export async function updateProvider(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const errors = validateFields(body, PROVIDER_UPDATE_RULES);
  if (errors.length) return badRequest(errors.join(" "));

  try {
    const existing = await env.DB.prepare(
      "SELECT * FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Provider not found: ${id}`);

    const sets: string[] = [];
    const values: unknown[] = [];

    if (typeof body.name === "string") {
      sets.push("name = ?");
      values.push(body.name);
    }
    if (typeof body.provider === "string") {
      sets.push("provider = ?");
      values.push(body.provider);
    }
    if (typeof body.model === "string") {
      sets.push("model = ?");
      values.push(body.model);
    }
    if (typeof body.task_lane === "string") {
      if (
        !VALID_TASK_LANES.includes(
          body.task_lane as typeof VALID_TASK_LANES[number],
        )
      ) {
        return badRequest(
          `Invalid task_lane "${body.task_lane}". Must be one of: ${VALID_TASK_LANES.join(", ")}`,
        );
      }
      sets.push("task_lane = ?");
      values.push(body.task_lane);
    }
    if (typeof body.tier === "number") {
      sets.push("tier = ?");
      values.push(body.tier);
    }
    if (typeof body.priority === "number") {
      sets.push("priority = ?");
      values.push(body.priority);
    }
    if (typeof body.notes === "string") {
      sets.push("notes = ?");
      values.push(body.notes);
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
      `UPDATE provider_configs SET ${sets.join(", ")} WHERE id = ?`,
    )
      .bind(...values)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: updated });
  } catch (err) {
    console.error("[providers/update]", err);
    return serverError("Failed to update provider.");
  }
}

// ── DELETE (soft-delete) ──────────────────────────────────

export async function deleteProvider(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Provider not found: ${id}`);

    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE provider_configs SET is_active = 0, state = 'disabled', updated_at = ? WHERE id = ?",
    )
      .bind(now, id)
      .run();

    return json({ message: "Provider deactivated.", id });
  } catch (err) {
    console.error("[providers/delete]", err);
    return serverError("Failed to delete provider.");
  }
}

// ── SLEEP ─────────────────────────────────────────────────

export async function sleepProvider(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const existing = await env.DB.prepare(
      "SELECT * FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Provider not found: ${id}`);

    if (existing.state === "sleeping") {
      return json({
        message: "Provider is already sleeping.",
        data: existing,
      });
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE provider_configs SET state = 'sleeping', cooldown_until = NULL, updated_at = ? WHERE id = ?",
    )
      .bind(now, id)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({
      message: "Provider put to sleep.",
      data: updated,
    });
  } catch (err) {
    console.error("[providers/sleep]", err);
    return serverError("Failed to sleep provider.");
  }
}

// ── WAKE ──────────────────────────────────────────────────

export async function wakeProvider(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const existing = await env.DB.prepare(
      "SELECT * FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Provider not found: ${id}`);

    if (existing.state === "active") {
      return json({
        message: "Provider is already active.",
        data: existing,
      });
    }

    // Paid providers without API key cannot be woken
    if (
      (existing.tier as number) >= 2 &&
      !(existing.has_api_key as number)
    ) {
      return badRequest(
        "Cannot wake a paid provider without an API key. Add an API key first.",
      );
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE provider_configs SET state = 'active', cooldown_until = NULL, last_error = NULL, updated_at = ? WHERE id = ?",
    )
      .bind(now, id)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({
      message: "Provider woken up.",
      data: updated,
    });
  } catch (err) {
    console.error("[providers/wake]", err);
    return serverError("Failed to wake provider.");
  }
}

// ── COOLDOWN ──────────────────────────────────────────────

export async function cooldownProvider(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const durationSecs =
    typeof body.duration_secs === "number" ? body.duration_secs : 60;

  try {
    const existing = await env.DB.prepare(
      "SELECT * FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Provider not found: ${id}`);

    const now = new Date();
    const cooldownUntil = new Date(
      now.getTime() + durationSecs * 1000,
    ).toISOString();

    const reason =
      typeof body.reason === "string" ? body.reason : "manual cooldown";

    await env.DB.prepare(
      "UPDATE provider_configs SET state = 'cooldown', cooldown_until = ?, last_error = ?, updated_at = ? WHERE id = ?",
    )
      .bind(cooldownUntil, reason, now.toISOString(), id)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({
      message: `Provider in cooldown for ${durationSecs}s.`,
      cooldown_until: cooldownUntil,
      data: updated,
    });
  } catch (err) {
    console.error("[providers/cooldown]", err);
    return serverError("Failed to set provider cooldown.");
  }
}

// ── REPORT ERROR ──────────────────────────────────────────

export async function reportProviderError(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const errorMessage =
    typeof body.error === "string" ? body.error : "Unknown error";

  try {
    const existing = await env.DB.prepare(
      "SELECT * FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Provider not found: ${id}`);

    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE provider_configs SET state = 'error', last_error = ?, updated_at = ? WHERE id = ?",
    )
      .bind(errorMessage, now, id)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({
      message: "Provider marked as error.",
      data: updated,
    });
  } catch (err) {
    console.error("[providers/report-error]", err);
    return serverError("Failed to report provider error.");
  }
}

// ── REPORT RATE LIMIT ─────────────────────────────────────

export async function reportProviderRateLimit(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await parseJsonBody(request);
  const durationSecs =
    body && typeof body.duration_secs === "number" ? body.duration_secs : 60;

  try {
    const existing = await env.DB.prepare(
      "SELECT * FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Provider not found: ${id}`);

    const now = new Date();
    const cooldownUntil = new Date(
      now.getTime() + durationSecs * 1000,
    ).toISOString();

    await env.DB.prepare(
      "UPDATE provider_configs SET state = 'rate_limited', cooldown_until = ?, last_error = 'rate_limited', updated_at = ? WHERE id = ?",
    )
      .bind(cooldownUntil, now.toISOString(), id)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM provider_configs WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({
      message: `Provider rate-limited for ${durationSecs}s.`,
      cooldown_until: cooldownUntil,
      data: updated,
    });
  } catch (err) {
    console.error("[providers/rate-limit]", err);
    return serverError("Failed to report rate limit.");
  }
}

// ── TASK LANES ────────────────────────────────────────────

export async function listTaskLanes(
  env: Env,
): Promise<Response> {
  try {
    const result = await env.DB.prepare(
      `SELECT * FROM provider_configs
       WHERE is_active = 1
       ORDER BY task_lane ASC, tier ASC, priority ASC`,
    ).all();

    const lanes: Record<string, unknown[]> = {};
    for (const row of result.results) {
      const lane = row.task_lane as string;
      if (!lanes[lane]) lanes[lane] = [];
      lanes[lane].push(resolveProviderCooldown(row));
    }

    return json({
      data: lanes,
      lanes: Object.keys(lanes),
      total_providers: result.results.length,
    });
  } catch (err) {
    console.error("[providers/lanes]", err);
    return serverError("Failed to list task lanes.");
  }
}

export async function getTaskLane(
  env: Env,
  lane: string,
): Promise<Response> {
  if (!VALID_TASK_LANES.includes(lane as typeof VALID_TASK_LANES[number])) {
    return badRequest(
      `Invalid task lane "${lane}". Must be one of: ${VALID_TASK_LANES.join(", ")}`,
    );
  }

  try {
    const result = await env.DB.prepare(
      `SELECT * FROM provider_configs
       WHERE task_lane = ? AND is_active = 1
       ORDER BY tier ASC, priority ASC`,
    )
      .bind(lane)
      .all();

    const providers = result.results.map(resolveProviderCooldown);

    return json({
      lane,
      providers,
      total: providers.length,
    });
  } catch (err) {
    console.error("[providers/lane]", err);
    return serverError("Failed to fetch task lane.");
  }
}

// ── RESOLVE (mock) — pick best available provider ─────────

export async function resolveTaskLane(
  env: Env,
  lane: string,
): Promise<Response> {
  if (!VALID_TASK_LANES.includes(lane as typeof VALID_TASK_LANES[number])) {
    return badRequest(
      `Invalid task lane "${lane}". Must be one of: ${VALID_TASK_LANES.join(", ")}`,
    );
  }

  try {
    const result = await env.DB.prepare(
      `SELECT * FROM provider_configs
       WHERE task_lane = ? AND is_active = 1
       ORDER BY tier ASC, priority ASC`,
    )
      .bind(lane)
      .all();

    const now = new Date();
    let selected: Record<string, unknown> | null = null;
    const skipped: Array<{ id: string; name: string; reason: string }> = [];

    for (const row of result.results) {
      const resolved = resolveProviderCooldown(row);

      // Skip sleeping, disabled, error providers
      if (
        resolved.effective_state === "sleeping" ||
        resolved.effective_state === "disabled" ||
        resolved.effective_state === "error"
      ) {
        skipped.push({
          id: resolved.id as string,
          name: resolved.name as string,
          reason: `state: ${resolved.effective_state as string}`,
        });
        continue;
      }

      // Skip if still in cooldown
      if (
        resolved.effective_state === "cooldown" ||
        resolved.effective_state === "rate_limited"
      ) {
        const cooldownUntil = resolved.cooldown_until as string | null;
        if (cooldownUntil && new Date(cooldownUntil) > now) {
          skipped.push({
            id: resolved.id as string,
            name: resolved.name as string,
            reason: `cooldown until ${cooldownUntil}`,
          });
          continue;
        }
      }

      // Skip paid providers without API key
      if (
        (resolved.tier as number) >= 2 &&
        !(resolved.has_api_key as number)
      ) {
        skipped.push({
          id: resolved.id as string,
          name: resolved.name as string,
          reason: "paid provider without API key",
        });
        continue;
      }

      selected = resolved;
      break;
    }

    if (!selected) {
      return json(
        {
          lane,
          resolved: null,
          message: "No available provider for this task lane.",
          skipped,
        },
        404,
      );
    }

    return json({
      lane,
      resolved: {
        id: selected.id,
        name: selected.name,
        provider: selected.provider,
        model: selected.model,
        tier: selected.tier,
        state: selected.effective_state,
      },
      skipped,
    });
  } catch (err) {
    console.error("[providers/resolve]", err);
    return serverError("Failed to resolve task lane.");
  }
}

// ── Helper — resolve cooldown expiry in-memory ────────────

function resolveProviderCooldown(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...row };
  const state = row.state as string;
  const cooldownUntil = row.cooldown_until as string | null;

  if (
    (state === "cooldown" || state === "rate_limited") &&
    cooldownUntil
  ) {
    const now = new Date();
    if (new Date(cooldownUntil) <= now) {
      // Cooldown has expired — report as active
      result.effective_state = "active";
      result.cooldown_expired = true;
    } else {
      result.effective_state = state;
      result.cooldown_expired = false;
    }
  } else {
    result.effective_state = state;
    result.cooldown_expired = false;
  }

  return result;
}
