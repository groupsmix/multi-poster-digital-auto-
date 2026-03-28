import { Env } from "../shared/types";
import { notFound } from "../shared/utils";
import { handleHealth } from "./routes";

/**
 * API router — handles all requests under /api/*.
 *
 * Uses a simple URL + method match so we stay dependency-free.
 * Swap this for itty-router or Hono later if route count grows.
 */
export async function handleApiRequest(
  request: Request,
  env: Env,
  path: string,
): Promise<Response> {
  const method = request.method.toUpperCase();

  // ── Health ────────────────────────────────────────────
  if (path === "/api/health" && method === "GET") {
    return handleHealth(env);
  }

  // ── Future API routes ─────────────────────────────────
  // POST /api/domains
  // GET  /api/domains
  // POST /api/categories
  // GET  /api/categories
  // POST /api/products
  // GET  /api/products
  // POST /api/workflow/run
  // GET  /api/workflow/runs
  // POST /api/reviews
  // GET  /api/assets
  // ... added in future tasks

  return notFound(`API route not found: ${method} ${path}`);
}
