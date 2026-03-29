import { Env } from "../shared/types";

/**
 * ProviderRouter — Durable Object for AI provider state management.
 *
 * Responsibilities:
 * - Track provider cooldown timers in-memory (authoritative state)
 * - Resolve the best available provider for a given task lane
 * - Handle state transitions: active <-> sleeping, cooldown, rate_limited, error
 * - Persist state snapshots to durable storage for recovery
 *
 * The D1 provider_configs table is the source of truth for config.
 * This DO manages ephemeral runtime state (cooldowns, rate-limit windows).
 */

interface ProviderState {
  id: string;
  state: string;
  cooldown_until: string | null;
  last_error: string | null;
  updated_at: string;
}

export class ProviderRouter implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private providers: Map<string, ProviderState>;
  private initialized: boolean;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.providers = new Map();
    this.initialized = false;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Restore state from durable storage
    const stored = await this.state.storage.get<
      Map<string, ProviderState>
    >("providers");
    if (stored) {
      this.providers = new Map(stored);
    }
    this.initialized = true;
  }

  private async persist(): Promise<void> {
    await this.state.storage.put(
      "providers",
      Array.from(this.providers.entries()),
    );
  }

  async fetch(request: Request): Promise<Response> {
    await this.initialize();

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // ── GET /status — full state map ──────────────────────
    if (path === "/status" && method === "GET") {
      return this.handleStatus();
    }

    // ── POST /cooldown — put a provider in cooldown ───────
    if (path === "/cooldown" && method === "POST") {
      return this.handleCooldown(request);
    }

    // ── POST /report-error — mark provider as errored ─────
    if (path === "/report-error" && method === "POST") {
      return this.handleReportError(request);
    }

    // ── POST /report-rate-limit — mark rate limited ───────
    if (path === "/report-rate-limit" && method === "POST") {
      return this.handleReportRateLimit(request);
    }

    // ── POST /wake — wake a provider ──────────────────────
    if (path === "/wake" && method === "POST") {
      return this.handleWake(request);
    }

    // ── POST /sleep — sleep a provider ────────────────────
    if (path === "/sleep" && method === "POST") {
      return this.handleSleep(request);
    }

    // ── POST /sync — sync state from D1 ──────────────────
    if (path === "/sync" && method === "POST") {
      return this.handleSync(request);
    }

    // ── GET /resolve/:lane — resolve best provider ────────
    const resolveMatch = path.match(/^\/resolve\/([^/]+)$/);
    if (resolveMatch && method === "GET") {
      return this.handleResolve(resolveMatch[1]);
    }

    return new Response("ProviderRouter: unknown route", { status: 404 });
  }

  // ── Status ──────────────────────────────────────────────

  private handleStatus(): Response {
    const now = new Date();
    const entries: Record<string, unknown> = {};

    for (const [id, prov] of this.providers) {
      entries[id] = {
        ...prov,
        effective_state: this.effectiveState(prov, now),
        cooldown_expired: this.isCooldownExpired(prov, now),
      };
    }

    return this.jsonResponse({
      id: this.state.id.toString(),
      provider_count: this.providers.size,
      providers: entries,
      timestamp: now.toISOString(),
    });
  }

  // ── Cooldown ────────────────────────────────────────────

  private async handleCooldown(request: Request): Promise<Response> {
    const body = await this.parseBody(request);
    if (!body || !body.provider_id) {
      return this.jsonResponse(
        { error: "provider_id is required" },
        400,
      );
    }

    const providerId = body.provider_id as string;
    const durationSecs =
      typeof body.duration_secs === "number" ? body.duration_secs : 60;
    const reason =
      typeof body.reason === "string" ? body.reason : "cooldown";

    const now = new Date();
    const cooldownUntil = new Date(
      now.getTime() + durationSecs * 1000,
    ).toISOString();

    const existing = this.providers.get(providerId);
    const updated: ProviderState = {
      id: providerId,
      state: "cooldown",
      cooldown_until: cooldownUntil,
      last_error: reason,
      updated_at: now.toISOString(),
    };

    this.providers.set(providerId, updated);
    await this.persist();

    // Also update D1 for consistency
    try {
      await this.env.DB.prepare(
        "UPDATE provider_configs SET state = 'cooldown', cooldown_until = ?, last_error = ?, updated_at = ? WHERE id = ?",
      )
        .bind(cooldownUntil, reason, now.toISOString(), providerId)
        .run();
    } catch (err) {
      console.error("[ProviderRouter/cooldown] D1 sync error:", err);
    }

    return this.jsonResponse({
      message: `Provider ${providerId} in cooldown for ${durationSecs}s.`,
      provider: updated,
      cooldown_until: cooldownUntil,
    });
  }

  // ── Report Error ────────────────────────────────────────

  private async handleReportError(request: Request): Promise<Response> {
    const body = await this.parseBody(request);
    if (!body || !body.provider_id) {
      return this.jsonResponse(
        { error: "provider_id is required" },
        400,
      );
    }

    const providerId = body.provider_id as string;
    const errorMsg =
      typeof body.error === "string" ? body.error : "Unknown error";
    const now = new Date().toISOString();

    const updated: ProviderState = {
      id: providerId,
      state: "error",
      cooldown_until: null,
      last_error: errorMsg,
      updated_at: now,
    };

    this.providers.set(providerId, updated);
    await this.persist();

    try {
      await this.env.DB.prepare(
        "UPDATE provider_configs SET state = 'error', last_error = ?, updated_at = ? WHERE id = ?",
      )
        .bind(errorMsg, now, providerId)
        .run();
    } catch (err) {
      console.error("[ProviderRouter/report-error] D1 sync error:", err);
    }

    return this.jsonResponse({
      message: `Provider ${providerId} marked as error.`,
      provider: updated,
    });
  }

  // ── Report Rate Limit ───────────────────────────────────

  private async handleReportRateLimit(
    request: Request,
  ): Promise<Response> {
    const body = await this.parseBody(request);
    if (!body || !body.provider_id) {
      return this.jsonResponse(
        { error: "provider_id is required" },
        400,
      );
    }

    const providerId = body.provider_id as string;
    const durationSecs =
      typeof body.duration_secs === "number" ? body.duration_secs : 60;

    const now = new Date();
    const cooldownUntil = new Date(
      now.getTime() + durationSecs * 1000,
    ).toISOString();

    const updated: ProviderState = {
      id: providerId,
      state: "rate_limited",
      cooldown_until: cooldownUntil,
      last_error: "rate_limited",
      updated_at: now.toISOString(),
    };

    this.providers.set(providerId, updated);
    await this.persist();

    try {
      await this.env.DB.prepare(
        "UPDATE provider_configs SET state = 'rate_limited', cooldown_until = ?, last_error = 'rate_limited', updated_at = ? WHERE id = ?",
      )
        .bind(cooldownUntil, now.toISOString(), providerId)
        .run();
    } catch (err) {
      console.error(
        "[ProviderRouter/report-rate-limit] D1 sync error:",
        err,
      );
    }

    return this.jsonResponse({
      message: `Provider ${providerId} rate-limited for ${durationSecs}s.`,
      provider: updated,
      cooldown_until: cooldownUntil,
    });
  }

  // ── Wake ────────────────────────────────────────────────

  private async handleWake(request: Request): Promise<Response> {
    const body = await this.parseBody(request);
    if (!body || !body.provider_id) {
      return this.jsonResponse(
        { error: "provider_id is required" },
        400,
      );
    }

    const providerId = body.provider_id as string;
    const now = new Date().toISOString();

    const updated: ProviderState = {
      id: providerId,
      state: "active",
      cooldown_until: null,
      last_error: null,
      updated_at: now,
    };

    this.providers.set(providerId, updated);
    await this.persist();

    try {
      await this.env.DB.prepare(
        "UPDATE provider_configs SET state = 'active', cooldown_until = NULL, last_error = NULL, updated_at = ? WHERE id = ?",
      )
        .bind(now, providerId)
        .run();
    } catch (err) {
      console.error("[ProviderRouter/wake] D1 sync error:", err);
    }

    return this.jsonResponse({
      message: `Provider ${providerId} woken up.`,
      provider: updated,
    });
  }

  // ── Sleep ───────────────────────────────────────────────

  private async handleSleep(request: Request): Promise<Response> {
    const body = await this.parseBody(request);
    if (!body || !body.provider_id) {
      return this.jsonResponse(
        { error: "provider_id is required" },
        400,
      );
    }

    const providerId = body.provider_id as string;
    const now = new Date().toISOString();

    const updated: ProviderState = {
      id: providerId,
      state: "sleeping",
      cooldown_until: null,
      last_error: null,
      updated_at: now,
    };

    this.providers.set(providerId, updated);
    await this.persist();

    try {
      await this.env.DB.prepare(
        "UPDATE provider_configs SET state = 'sleeping', cooldown_until = NULL, updated_at = ? WHERE id = ?",
      )
        .bind(now, providerId)
        .run();
    } catch (err) {
      console.error("[ProviderRouter/sleep] D1 sync error:", err);
    }

    return this.jsonResponse({
      message: `Provider ${providerId} put to sleep.`,
      provider: updated,
    });
  }

  // ── Sync — load state from D1 into DO ───────────────────

  private async handleSync(request: Request): Promise<Response> {
    const body = await this.parseBody(request);
    const providers = body?.providers as Array<Record<string, unknown>> | undefined;

    if (providers && Array.isArray(providers)) {
      for (const p of providers) {
        const id = p.id as string;
        if (!id) continue;
        this.providers.set(id, {
          id,
          state: (p.state as string) || "sleeping",
          cooldown_until: (p.cooldown_until as string) || null,
          last_error: (p.last_error as string) || null,
          updated_at:
            (p.updated_at as string) || new Date().toISOString(),
        });
      }
      await this.persist();
    }

    return this.jsonResponse({
      message: "State synced.",
      provider_count: this.providers.size,
    });
  }

  // ── Resolve — pick best provider for a lane ─────────────

  private async handleResolve(lane: string): Promise<Response> {
    // Query D1 for the lane's providers in priority order
    let rows: Record<string, unknown>[];
    try {
      const result = await this.env.DB.prepare(
        `SELECT * FROM provider_configs
         WHERE task_lane = ? AND is_active = 1
         ORDER BY tier ASC, priority ASC`,
      )
        .bind(lane)
        .all();
      rows = result.results;
    } catch (err) {
      console.error("[ProviderRouter/resolve] D1 error:", err);
      return this.jsonResponse(
        { error: "Failed to query providers" },
        500,
      );
    }

    const now = new Date();
    const skipped: Array<{ id: string; name: string; reason: string }> = [];

    for (const row of rows) {
      const id = row.id as string;

      // Check DO state first (more current than D1)
      const doState = this.providers.get(id);
      const currentState = doState ? doState.state : (row.state as string);
      const cooldownUntil = doState
        ? doState.cooldown_until
        : (row.cooldown_until as string | null);

      const effective = this.computeEffectiveState(
        currentState,
        cooldownUntil,
        now,
      );

      if (
        effective === "sleeping" ||
        effective === "disabled" ||
        effective === "error"
      ) {
        skipped.push({
          id,
          name: row.name as string,
          reason: `state: ${effective}`,
        });
        continue;
      }

      if (
        effective === "cooldown" ||
        effective === "rate_limited"
      ) {
        skipped.push({
          id,
          name: row.name as string,
          reason: `cooldown until ${cooldownUntil}`,
        });
        continue;
      }

      // Skip paid providers without API key
      if (
        (row.tier as number) >= 2 &&
        !(row.has_api_key as number)
      ) {
        skipped.push({
          id,
          name: row.name as string,
          reason: "paid provider without API key",
        });
        continue;
      }

      // Found a viable provider
      return this.jsonResponse({
        lane,
        resolved: {
          id,
          name: row.name,
          provider: row.provider,
          model: row.model,
          tier: row.tier,
          state: effective,
        },
        skipped,
      });
    }

    return this.jsonResponse(
      {
        lane,
        resolved: null,
        message: "No available provider for this task lane.",
        skipped,
      },
      404,
    );
  }

  // ── Internal helpers ────────────────────────────────────

  private effectiveState(
    prov: ProviderState,
    now: Date,
  ): string {
    return this.computeEffectiveState(
      prov.state,
      prov.cooldown_until,
      now,
    );
  }

  private computeEffectiveState(
    state: string,
    cooldownUntil: string | null,
    now: Date,
  ): string {
    if (
      (state === "cooldown" || state === "rate_limited") &&
      cooldownUntil &&
      new Date(cooldownUntil) <= now
    ) {
      return "active";
    }
    return state;
  }

  private isCooldownExpired(
    prov: ProviderState,
    now: Date,
  ): boolean {
    if (
      (prov.state === "cooldown" || prov.state === "rate_limited") &&
      prov.cooldown_until
    ) {
      return new Date(prov.cooldown_until) <= now;
    }
    return false;
  }

  private async parseBody(
    request: Request,
  ): Promise<Record<string, unknown> | null> {
    try {
      const text = await request.text();
      if (!text) return null;
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
