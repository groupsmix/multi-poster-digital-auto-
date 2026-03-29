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
  PROVIDER_ROUTER: DurableObjectNamespace;

  // ── Vars (set in wrangler.toml [vars] or .dev.vars) ──
  ENVIRONMENT: string;
  APP_NAME: string;

  // ── AI Provider secrets (set via wrangler secret or .dev.vars) ──
  TAVILY_API_KEY?: string;
  EXA_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;

  // ── Cloudflare Workers AI binding (optional) ────────────
  AI?: unknown;
}
