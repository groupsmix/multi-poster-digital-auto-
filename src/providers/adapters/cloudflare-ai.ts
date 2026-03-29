/**
 * Cloudflare Workers AI adapter.
 *
 * Uses the Workers AI binding (env.AI) when available,
 * or falls back to the REST API.
 * Free tier included with Workers paid plan.
 * Docs: https://developers.cloudflare.com/workers-ai/
 */

import type {
  ProviderAdapter,
  ProviderCapability,
  ProviderRequest,
  ProviderResponse,
} from "../types";
import {
  ProviderRateLimitError,
  ProviderCallError,
} from "../types";

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

/**
 * Minimal interface for the Workers AI binding.
 * The real binding has more methods, but we only need `run`.
 */
interface AiBinding {
  run(
    model: string,
    inputs: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}

export class CloudflareAiAdapter implements ProviderAdapter {
  readonly id = "cloudflare_ai";
  readonly displayName = "Cloudflare Workers AI";
  readonly capabilities: readonly ProviderCapability[] = [
    "chat",
    "structured_output",
  ];

  private aiBinding: AiBinding | undefined;

  constructor(aiBinding: unknown) {
    this.aiBinding = aiBinding as AiBinding | undefined;
  }

  hasCredentials(): boolean {
    return !!this.aiBinding;
  }

  async execute(
    request: ProviderRequest,
    model?: string,
  ): Promise<ProviderResponse> {
    if (!this.aiBinding) {
      // Cloudflare Workers AI requires the AI binding — no separate API key.
      // If binding is missing, the adapter is unavailable.
      throw new ProviderCallError(
        this.id,
        "AI binding not available in this environment",
      );
    }

    const modelId = model ?? DEFAULT_MODEL;
    const start = Date.now();

    const messages: Array<Record<string, string>> = [];

    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }

    messages.push({ role: "user", content: request.prompt });

    try {
      const result = await this.aiBinding.run(modelId, {
        messages,
        max_tokens: request.maxTokens ?? 2048,
        temperature: request.temperature ?? 0.7,
      });

      const latencyMs = Date.now() - start;

      const textContent = (result.response as string) ?? "";

      return {
        provider: this.id,
        model: modelId,
        content: textContent,
        structured: request.responseSchema
          ? tryParseJson(textContent)
          : undefined,
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes("rate limit") || message.includes("429")) {
        throw new ProviderRateLimitError(this.id, 30);
      }

      throw new ProviderCallError(this.id, message);
    }
  }
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
