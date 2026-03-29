/**
 * NEXUS — Main Worker entry point.
 *
 * Routes incoming requests to the appropriate handler:
 *   /api/*        → API router
 *   /dashboard/*  → Dashboard shell router
 *   /             → Root redirect / info
 *
 * Durable Object classes are re-exported so wrangler can discover them.
 */

import { Env } from "./shared/types";
import { json, notFound } from "./shared/utils";
import { APP } from "./config";
import { handleApiRequest } from "./api/router";
import { handleDashboardRequest } from "./dashboard/routes";

// Re-export Durable Object classes for wrangler binding discovery
export { WorkflowCoordinator } from "./durable-objects";
export { ProviderRouter } from "./durable-objects";

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ── API routes ──────────────────────────────────────
      if (path.startsWith("/api/")) {
        return handleApiRequest(request, env, path);
      }

      // ── Dashboard routes ────────────────────────────────
      if (path.startsWith("/dashboard")) {
        return handleDashboardRequest(request, env, path);
      }

      // ── Root ────────────────────────────────────────────
      if (path === "/" || path === "") {
        return json({
          app: APP.NAME,
          version: APP.VERSION,
          description: APP.DESCRIPTION,
          endpoints: {
            health: "/api/health",
            dashboard: "/dashboard",
          },
        });
      }

      return notFound(`No route matched: ${path}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      console.error(`[NEXUS] Unhandled error on ${path}:`, message);
      return json({ error: "Internal server error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
