import { Env } from "../../shared/types";
import { APP } from "../../config";
import { json } from "../../shared/utils";

/**
 * GET /api/health
 *
 * Returns basic service status and binding availability.
 * No business logic — just confirms the skeleton is wired.
 */
export async function handleHealth(env: Env): Promise<Response> {
  const checks: Record<string, boolean> = {
    d1: !!env.DB,
    kv: !!env.CACHE,
    r2: !!env.ASSETS_BUCKET,
    durable_objects: !!env.WORKFLOW_COORDINATOR,
  };

  const allHealthy = Object.values(checks).every(Boolean);

  return json({
    status: allHealthy ? "ok" : "degraded",
    app: APP.NAME,
    version: APP.VERSION,
    environment: env.ENVIRONMENT,
    bindings: checks,
    timestamp: new Date().toISOString(),
  });
}
