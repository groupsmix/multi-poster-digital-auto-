/**
 * Groq API adapter.
 *
 * Free tier with generous rate limits on open models.
 * Uses the OpenAI-compatible chat completions endpoint.
 * Docs: https://console.groq.com/docs/api-reference
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

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export class GroqAdapter implements ProviderAdapter {
  readonly id = "groq";
  readonly displayName = "Groq";
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

    const messages: Array<Record<string, string>> = [];

    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }

    messages.push({ role: "user", content: request.prompt });

    const body: Record<string, unknown> = {
      model: modelId,
      messages,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
    };

    if (request.responseSchema) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
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
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const message = choices?.[0]?.message as Record<string, unknown> | undefined;
    const textContent = (message?.content as string) ?? "";

    const usage = data.usage as Record<string, unknown> | undefined;

    return {
      provider: this.id,
      model: modelId,
      content: textContent,
      structured: request.responseSchema ? tryParseJson(textContent) : undefined,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens as number | undefined,
            completionTokens: usage.completion_tokens as number | undefined,
            totalTokens: usage.total_tokens as number | undefined,
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
