/**
 * Tavily Search API adapter.
 *
 * Free tier: search results with content extraction.
 * Docs: https://docs.tavily.com
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

const TAVILY_API_URL = "https://api.tavily.com/search";

export class TavilyAdapter implements ProviderAdapter {
  readonly id = "tavily";
  readonly displayName = "Tavily Search";
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
      api_key: this.apiKey,
      query: request.prompt,
      search_depth: "basic",
      include_answer: true,
      max_results: 5,
      ...(request.extras ?? {}),
    };

    const res = await fetch(TAVILY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const answer = (data.answer as string) ?? "";
    const results = data.results as Array<Record<string, unknown>> | undefined;

    const content = answer || (results ?? [])
      .map((r) => `${r.title}\n${r.content}`)
      .join("\n\n");

    return {
      provider: this.id,
      model: "tavily-search",
      content,
      structured: data,
      latencyMs,
    };
  }
}
