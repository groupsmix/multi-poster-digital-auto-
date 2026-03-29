/**
 * Provider Executor — the free-first routing engine.
 *
 * Given a task lane, this module:
 *   1. Queries D1 for the ordered provider chain (tier ASC, priority ASC)
 *   2. Walks the chain, skipping providers that are sleeping / cooldown / no-key
 *   3. Attempts execution on each viable provider
 *   4. On rate-limit, puts the provider in cooldown and moves to next
 *   5. On success, records the provider used and returns the result
 *   6. Returns a full routing log for observability
 */

import type { Env } from "../shared/types";
import type { TaskLane } from "../config";
import { DEFAULTS } from "../config";
import type {
  ProviderAdapter,
  ProviderRequest,
  ProviderResponse,
  RoutingResult,
  RoutingAttempt,
} from "./types";
import {
  ProviderMissingKeyError,
  ProviderRateLimitError,
  ProviderCallError,
} from "./types";
import { buildAdapterRegistry } from "./registry";

/** Row shape from provider_configs table. */
interface ProviderConfigRow {
  id: string;
  name: string;
  provider: string;
  model: string | null;
  task_lane: string;
  tier: number;
  priority: number;
  state: string;
  has_api_key: number;
  cooldown_until: string | null;
  is_active: number;
}

/**
 * Execute a provider request using free-first routing.
 *
 * This is the main entry point for all AI calls in the system.
 */
export async function executeWithRouting(
  env: Env,
  lane: TaskLane,
  request: ProviderRequest,
): Promise<RoutingResult> {
  const adapters = buildAdapterRegistry(env);
  const attempts: RoutingAttempt[] = [];

  // 1. Query provider chain from D1
  const chain = await getProviderChain(env, lane);

  if (chain.length === 0) {
    return { success: false, attempts };
  }

  const now = new Date();

  // 2. Walk the chain in order
  for (const row of chain) {
    const adapter = adapters.get(row.provider);

    // Provider slug not registered — skip
    if (!adapter) {
      attempts.push({
        providerId: row.id,
        providerName: row.name,
        model: row.model,
        outcome: "skipped_disabled",
        error: `No adapter registered for provider "${row.provider}"`,
      });
      continue;
    }

    // Check effective state
    const effectiveState = computeEffectiveState(
      row.state,
      row.cooldown_until,
      now,
    );

    if (effectiveState === "sleeping" || effectiveState === "disabled") {
      attempts.push({
        providerId: row.id,
        providerName: row.name,
        model: row.model,
        outcome: "skipped_sleeping",
      });
      continue;
    }

    if (
      effectiveState === "cooldown" ||
      effectiveState === "rate_limited"
    ) {
      attempts.push({
        providerId: row.id,
        providerName: row.name,
        model: row.model,
        outcome: "skipped_cooldown",
        error: `In cooldown until ${row.cooldown_until}`,
      });
      continue;
    }

    // Check credentials at runtime
    if (!adapter.hasCredentials()) {
      attempts.push({
        providerId: row.id,
        providerName: row.name,
        model: row.model,
        outcome: "skipped_no_key",
      });

      // If the DB thinks has_api_key = 1 but adapter disagrees, update DB
      if (row.has_api_key === 1) {
        await updateProviderState(env, row.id, "sleeping", null, "API key missing at runtime");
      }
      continue;
    }

    // Attempt execution
    try {
      const response = await adapter.execute(request, row.model ?? undefined);

      // Record success: update last_used_at
      await markProviderUsed(env, row.id);

      attempts.push({
        providerId: row.id,
        providerName: row.name,
        model: row.model,
        outcome: "success",
        latencyMs: response.latencyMs,
      });

      return { success: true, response, attempts };
    } catch (err) {
      if (err instanceof ProviderMissingKeyError) {
        attempts.push({
          providerId: row.id,
          providerName: row.name,
          model: row.model,
          outcome: "skipped_no_key",
          error: err.message,
        });
        continue;
      }

      if (err instanceof ProviderRateLimitError) {
        const cooldownSecs = err.retryAfterSecs || DEFAULTS.PROVIDER_COOLDOWN_SECS;
        const cooldownUntil = new Date(
          now.getTime() + cooldownSecs * 1000,
        ).toISOString();

        await updateProviderState(
          env,
          row.id,
          "rate_limited",
          cooldownUntil,
          "rate_limited",
        );

        attempts.push({
          providerId: row.id,
          providerName: row.name,
          model: row.model,
          outcome: "rate_limited",
          error: err.message,
        });
        // Fall through to next provider
        continue;
      }

      // Generic error
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({
        providerId: row.id,
        providerName: row.name,
        model: row.model,
        outcome: "error",
        error: message,
      });
      // Fall through to next provider
      continue;
    }
  }

  // All providers exhausted
  return { success: false, attempts };
}

// ── Internal helpers ──────────────────────────────────────

async function getProviderChain(
  env: Env,
  lane: TaskLane,
): Promise<ProviderConfigRow[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT id, name, provider, model, task_lane, tier, priority,
              state, has_api_key, cooldown_until, is_active
       FROM provider_configs
       WHERE task_lane = ? AND is_active = 1
       ORDER BY tier ASC, priority ASC`,
    )
      .bind(lane)
      .all();

    return result.results as unknown as ProviderConfigRow[];
  } catch (err) {
    console.error("[executor/getProviderChain]", err);
    return [];
  }
}

function computeEffectiveState(
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

async function updateProviderState(
  env: Env,
  id: string,
  state: string,
  cooldownUntil: string | null,
  lastError: string | null,
): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE provider_configs
       SET state = ?, cooldown_until = ?, last_error = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(state, cooldownUntil, lastError, new Date().toISOString(), id)
      .run();
  } catch (err) {
    console.error("[executor/updateProviderState]", err);
  }
}

async function markProviderUsed(
  env: Env,
  id: string,
): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE provider_configs SET last_used_at = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(new Date().toISOString(), new Date().toISOString(), id)
      .run();
  } catch (err) {
    console.error("[executor/markProviderUsed]", err);
  }
}
