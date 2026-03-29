/**
 * Exa Search API adapter.
 *
 * Free tier: neural search with content extraction.
 * Docs: https://docs.exa.ai
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

const EXA_API_URL = "https://api.exa.ai/search";

export class ExaAdapter implements ProviderAdapter {
  readonly id = "exa";
  readonly displayName = "Exa Search";
  readonly capabilities: readonly ProviderCapability[] = ["search"];

  private apiKey: string | undefined;

  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey;
  }

  hasCredentials(): boolean {
    return !!this.apiKey;
  }

  async execute(
    request: ProviderRequest,
    _model?: string,
  ): Promise<ProviderResponse> {
    if (!this.apiKey) {
      throw new ProviderMissingKeyError(this.id);
    }

    const start = Date.now();

    const body = {
      query: request.prompt,
      num_results: 5,
      contents: { text: true },
      ...(request.extras ?? {}),
    };

    const res = await fetch(EXA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    const latencyMs = Date.now() - start;

    if (res.status === 429) {
      throw new ProviderRateLimitError(this.id, 60);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ProviderCallError(this.id, `HTTP ${res.status}: ${text}`, res.status);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const results = data.results as Array<Record<string, unknown>> | undefined;

    const content = (results ?? [])
      .map((r) => `${r.title}\n${r.text ?? r.url}`)
      .join("\n\n");

    return {
      provider: this.id,
      model: "exa-search",
      content,
      structured: data,
      latencyMs,
    };
  }
}
