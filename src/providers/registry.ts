/**
 * Provider adapter registry.
 *
 * Creates adapter instances from environment secrets.
 * The registry is built fresh per-request (Workers are stateless),
 * so it reads API keys from env each time.
 */

import type { Env } from "../shared/types";
import type { ProviderAdapter } from "./types";
import {
  TavilyAdapter,
  ExaAdapter,
  GeminiAdapter,
  GroqAdapter,
  CloudflareAiAdapter,
  OpenAiAdapter,
  AnthropicAdapter,
} from "./adapters";

/** Env keys that map to provider API keys (set in .dev.vars or wrangler secrets). */
interface ProviderSecrets {
  TAVILY_API_KEY?: string;
  EXA_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  /** Cloudflare Workers AI binding — not a secret string. */
  AI?: unknown;
}

/**
 * Build the full set of provider adapters from the current env.
 *
 * Returns a Map keyed by provider id (slug).
 * Adapters whose keys are missing will have `hasCredentials() === false`.
 */
export function buildAdapterRegistry(
  env: Env & Partial<ProviderSecrets>,
): Map<string, ProviderAdapter> {
  const adapters = new Map<string, ProviderAdapter>();

  // ── Free-tier providers (priority order) ──────────────
  adapters.set("tavily", new TavilyAdapter(env.TAVILY_API_KEY));
  adapters.set("exa", new ExaAdapter(env.EXA_API_KEY));
  adapters.set("gemini", new GeminiAdapter(env.GEMINI_API_KEY));
  adapters.set("groq", new GroqAdapter(env.GROQ_API_KEY));
  adapters.set("cloudflare_ai", new CloudflareAiAdapter(env.AI));

  // ── Paid providers (sleeping by default) ──────────────
  adapters.set("openai", new OpenAiAdapter(env.OPENAI_API_KEY));
  adapters.set("anthropic", new AnthropicAdapter(env.ANTHROPIC_API_KEY));

  return adapters;
}
