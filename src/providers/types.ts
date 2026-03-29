/**
 * Unified provider interface and types for the AI provider layer.
 *
 * Every provider adapter implements `ProviderAdapter` so the router
 * can call any provider through the same contract.
 */

import type { TaskLane } from "../config";

// ── Provider capability categories ────────────────────────

/** The kind of work a provider can do in a single call. */
export type ProviderCapability = "search" | "chat" | "structured_output";

// ── Request / Response contracts ──────────────────────────

/** Unified request sent to any provider adapter. */
export interface ProviderRequest {
  /** The task lane that triggered this call (for logging). */
  lane: TaskLane;
  /** System-level prompt (optional). */
  systemPrompt?: string;
  /** User-facing prompt / query. */
  prompt: string;
  /** Desired max tokens in the response (hint, not enforced by all). */
  maxTokens?: number;
  /** Temperature (0–2 range, provider-specific default if omitted). */
  temperature?: number;
  /** Optional JSON schema the model should conform to. */
  responseSchema?: Record<string, unknown>;
  /** Arbitrary provider-specific overrides. */
  extras?: Record<string, unknown>;
}

/** Unified response returned from any provider adapter. */
export interface ProviderResponse {
  /** Provider identifier (e.g. "tavily", "gemini"). */
  provider: string;
  /** Model string used (e.g. "gemini-2.0-flash"). */
  model: string;
  /** The main text/content output. */
  content: string;
  /** Structured data if the provider returned JSON. */
  structured?: unknown;
  /** Token/usage metadata when available. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  /** Latency in milliseconds for the provider call. */
  latencyMs: number;
  /** Raw response for debugging (stripped in production). */
  raw?: unknown;
}

// ── Error types ───────────────────────────────────────────

/** Indicates the provider hit its rate limit. */
export class ProviderRateLimitError extends Error {
  /** Seconds to wait before retrying (from Retry-After or default). */
  retryAfterSecs: number;

  constructor(provider: string, retryAfterSecs = 60) {
    super(`${provider}: rate limited, retry after ${retryAfterSecs}s`);
    this.name = "ProviderRateLimitError";
    this.retryAfterSecs = retryAfterSecs;
  }
}

/** Indicates the provider has no API key configured. */
export class ProviderMissingKeyError extends Error {
  constructor(provider: string) {
    super(`${provider}: no API key configured — skipping`);
    this.name = "ProviderMissingKeyError";
  }
}

/** Generic provider error (timeout, bad response, etc.). */
export class ProviderCallError extends Error {
  statusCode?: number;

  constructor(provider: string, message: string, statusCode?: number) {
    super(`${provider}: ${message}`);
    this.name = "ProviderCallError";
    this.statusCode = statusCode;
  }
}

// ── Adapter interface ─────────────────────────────────────

/** Every provider adapter must implement this interface. */
export interface ProviderAdapter {
  /** Unique slug matching the `provider` column in provider_configs. */
  readonly id: string;
  /** Human-friendly display name. */
  readonly displayName: string;
  /** Capabilities this adapter can handle. */
  readonly capabilities: readonly ProviderCapability[];

  /**
   * Check whether the adapter has the credentials it needs.
   * Returns `true` if the adapter can make calls right now.
   */
  hasCredentials(): boolean;

  /**
   * Execute a provider call.
   *
   * Must throw:
   * - `ProviderMissingKeyError` if key is absent
   * - `ProviderRateLimitError` if 429 / quota hit
   * - `ProviderCallError` for all other failures
   */
  execute(
    request: ProviderRequest,
    model?: string,
  ): Promise<ProviderResponse>;
}

// ── Router result ─────────────────────────────────────────

/** Outcome of a single routing attempt through the provider chain. */
export interface RoutingResult {
  /** Whether a provider succeeded. */
  success: boolean;
  /** The response if successful. */
  response?: ProviderResponse;
  /** Ordered list of providers that were tried (including skipped). */
  attempts: RoutingAttempt[];
}

/** One entry in the routing attempt log. */
export interface RoutingAttempt {
  providerId: string;
  providerName: string;
  model: string | null;
  outcome: "success" | "skipped_no_key" | "skipped_sleeping" | "skipped_cooldown" | "skipped_disabled" | "rate_limited" | "error";
  error?: string;
  latencyMs?: number;
}
