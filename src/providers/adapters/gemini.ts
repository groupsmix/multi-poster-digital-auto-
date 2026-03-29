/**
 * Google Gemini free-tier adapter.
 *
 * Uses the Gemini REST API (generativelanguage.googleapis.com).
 * Free tier provides access to gemini-2.0-flash and other models.
 * Docs: https://ai.google.dev/gemini-api/docs
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

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.0-flash";

export class GeminiAdapter implements ProviderAdapter {
  readonly id = "gemini";
  readonly displayName = "Google Gemini (free tier)";
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

    const contents: Array<Record<string, unknown>> = [];

    if (request.systemPrompt) {
      contents.push({
        role: "user",
        parts: [{ text: request.systemPrompt }],
      });
      contents.push({
        role: "model",
        parts: [{ text: "Understood. I will follow these instructions." }],
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: request.prompt }],
    });

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
      },
    };

    if (request.responseSchema) {
      (body.generationConfig as Record<string, unknown>).responseMimeType =
        "application/json";
    }

    const url = `${GEMINI_API_BASE}/${modelId}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
    const firstCandidate = candidates?.[0];
    const contentObj = firstCandidate?.content as Record<string, unknown> | undefined;
    const parts = contentObj?.parts as Array<Record<string, unknown>> | undefined;
    const textContent = (parts?.[0]?.text as string) ?? "";

    const usageMeta = data.usageMetadata as Record<string, unknown> | undefined;

    return {
      provider: this.id,
      model: modelId,
      content: textContent,
      structured: request.responseSchema ? tryParseJson(textContent) : undefined,
      usage: usageMeta
        ? {
            promptTokens: usageMeta.promptTokenCount as number | undefined,
            completionTokens: usageMeta.candidatesTokenCount as number | undefined,
            totalTokens: usageMeta.totalTokenCount as number | undefined,
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
