/**
 * Cloudflare Worker environment bindings.
 *
 * Every Worker handler receives this as `env`.
 * Add new bindings here as they are provisioned in wrangler.toml.
 */
export interface Env {
  // ── D1 ────────────────────────────────────────────────
  DB: D1Database;

  // ── KV ────────────────────────────────────────────────
  CACHE: KVNamespace;

  // ── R2 ────────────────────────────────────────────────
  ASSETS_BUCKET: R2Bucket;

  // ── Durable Objects ───────────────────────────────────
  WORKFLOW_COORDINATOR: DurableObjectNamespace;

  // ── Vars (set in wrangler.toml [vars] or .dev.vars) ──
  ENVIRONMENT: string;
  APP_NAME: string;
}
