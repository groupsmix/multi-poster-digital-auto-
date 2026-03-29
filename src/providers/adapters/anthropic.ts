/**
 * Anthropic adapter — PAID provider stub.
 *
 * Stays sleeping by default until an API key is configured.
 * Implements the full ProviderAdapter interface so the router
 * can include it in fallback chains when activated.
 */

import type {
  ProviderAdapter,
  ProviderCapability,
  ProviderRequest,
  ProviderResponse,
} from "../types";
import {
  ProviderMissingKeyError,
  ProviderRateLimitError,
  ProviderCallError,
} from "../types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export class AnthropicAdapter implements ProviderAdapter {
  readonly id = "anthropic";
  readonly displayName = "Anthropic (paid)";
  readonly capabilities: readonly ProviderCapability[] = [
    "chat",
    "structured_output",
  ];

  private apiKey: string | undefined;

  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey;
  }

  hasCredentials(): boolean {
    return !!this.apiKey;
  }

  async execute(
    request: ProviderRequest,
    model?: string,
  ): Promise<ProviderResponse> {
    if (!this.apiKey) {
      throw new ProviderMissingKeyError(this.id);
    }

    const modelId = model ?? DEFAULT_MODEL;
    const start = Date.now();

    const messages: Array<Record<string, string>> = [
      { role: "user", content: request.prompt },
    ];

    const body: Record<string, unknown> = {
      model: modelId,
      messages,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
    };

    if (request.systemPrompt) {
      body.system = request.systemPrompt;
    }

    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const latencyMs = Date.now() - start;

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "60", 10);
      throw new ProviderRateLimitError(this.id, retryAfter);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderCallError(this.id, `HTTP ${res.status}: ${text}`, res.status);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const contentBlocks = data.content as Array<Record<string, unknown>> | undefined;
    const textContent = contentBlocks
      ?.filter((b) => b.type === "text")
      .map((b) => b.text as string)
      .join("") ?? "";

    const usage = data.usage as Record<string, unknown> | undefined;

    return {
      provider: this.id,
      model: modelId,
      content: textContent,
      structured: request.responseSchema ? tryParseJson(textContent) : undefined,
      usage: usage
        ? {
            promptTokens: usage.input_tokens as number | undefined,
            completionTokens: usage.output_tokens as number | undefined,
          }
        : undefined,
      latencyMs,
    };
  }
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
