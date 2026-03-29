/**
 * Marketing AI Service — orchestrates the marketing optimization step.
 *
 * Takes prior workflow outputs (research, creation, platform variants)
 * and generates pricing suggestions, SEO optimization, persuasive
 * descriptions, high-converting copy, and marketing positioning.
 */

import type { Env } from "../shared/types";
import type { TaskLane } from "../config";
import { generateId } from "../shared/utils";
import { executeWithRouting } from "../providers";
import type { RoutingAttempt } from "../providers";
import { composePrompt } from "./prompt-composer";

// ── Marketing result schema ─────────────────────────────────

/** Structured marketing output matching architecture §8.5 / §19. */
export interface MarketingResult {
  price_suggestion: PriceSuggestion;
  seo: SeoOptimization;
  descriptions: MarketingDescriptions;
  copy: MarketingCopy;
  cta_options: CtaOptions;
  positioning: Positioning;
}

export interface PriceSuggestion {
  recommended_price: string;
  price_tier: "budget" | "mid_range" | "premium";
  pricing_model: string;
  justification: string;
}

export interface SeoOptimization {
  seo_title_variations: string[];
  meta_description: string;
  primary_keywords: string[];
  secondary_keywords: string[];
  long_tail_keywords: string[];
}

export interface MarketingDescriptions {
  short_description: string;
  medium_description: string;
  long_description: string;
  bullet_benefits: string[];
}

export interface MarketingCopy {
  headline_variations: string[];
  subheadline_options: string[];
  hook_sentences: string[];
  objection_handlers: string[];
  social_proof_suggestions: string[];
  urgency_angles: string[];
}

export interface CtaOptions {
  primary_cta: string;
  secondary_cta: string;
  variations: string[];
}

export interface Positioning {
  usp: string;
  differentiators: string[];
  target_audience_message: string;
  brand_voice_notes: string;
}

// ── Marketing input ─────────────────────────────────────────

export interface MarketingInput {
  /** The product/service idea. */
  productIdea: string;
  /** Domain name or slug. */
  domain: string;
  /** Category name or slug (optional). */
  category?: string;
  /** Structured research output from the Researcher AI (optional). */
  researchContext?: unknown;
  /** Structured creator output (optional). */
  creatorOutput?: unknown;
  /** Platform variant outputs for platform-specific marketing (optional). */
  platformVariants?: unknown;
  /** Additional notes from the user (optional). */
  notes?: string;
}

// ── Marketing execution result ──────────────────────────────

export interface MarketingExecutionResult {
  success: boolean;
  /** The structured marketing data (null on failure). */
  marketing: MarketingResult | null;
  /** Raw text from the provider (for debugging). */
  rawContent: string | null;
  /** Provider routing log. */
  providerLog: RoutingAttempt[];
  /** Provider and model that produced the result. */
  provider: string | null;
  model: string | null;
  /** Prompt template metadata. */
  templateId: string | null;
  templateVersion: number | null;
  /** Error message if failed. */
  error: string | null;
}

// ── Output schema for structured JSON ──────────────────────

const MARKETING_OUTPUT_SCHEMA = `Return your marketing output as a JSON object with exactly this structure:
{
  "price_suggestion": {
    "recommended_price": "string",
    "price_tier": "budget | mid_range | premium",
    "pricing_model": "string (one-time, subscription, freemium, tiered)",
    "justification": "string"
  },
  "seo": {
    "seo_title_variations": ["string"],
    "meta_description": "string",
    "primary_keywords": ["string"],
    "secondary_keywords": ["string"],
    "long_tail_keywords": ["string"]
  },
  "descriptions": {
    "short_description": "string (1-2 sentences)",
    "medium_description": "string (paragraph)",
    "long_description": "string (full marketing copy)",
    "bullet_benefits": ["string"]
  },
  "copy": {
    "headline_variations": ["string (3-5 options)"],
    "subheadline_options": ["string"],
    "hook_sentences": ["string"],
    "objection_handlers": ["string"],
    "social_proof_suggestions": ["string"],
    "urgency_angles": ["string"]
  },
  "cta_options": {
    "primary_cta": "string",
    "secondary_cta": "string",
    "variations": ["string"]
  },
  "positioning": {
    "usp": "string",
    "differentiators": ["string"],
    "target_audience_message": "string",
    "brand_voice_notes": "string"
  }
}

Return ONLY the JSON object. No markdown fences, no commentary.`;

// ── Default marketing role prompt (fallback) ────────────────

const DEFAULT_MARKETING_PROMPT = `You are the Marketing AI in the NEXUS workflow.
Enhance the product with marketing intelligence: pricing suggestions,
SEO optimization, persuasive copy, and buyer psychology-driven content.
Make every word earn its place. Be specific, not generic.`;

// ── Main execution function ────────────────────────────────

/**
 * Execute the Marketing AI workflow step.
 *
 * 1. Compose the marketing prompt from Prompt Studio templates
 * 2. Build the user prompt with product context + prior outputs
 * 3. Call the provider chain (build lane, free-first)
 * 4. Parse the structured response
 * 5. Return the result with provider log
 */
export async function executeMarketing(
  env: Env,
  input: MarketingInput,
): Promise<MarketingExecutionResult> {
  const lane: TaskLane = "build";

  try {
    // 1. Compose prompt from Prompt Studio
    const composed = await composePrompt(env, {
      role: "marketing",
      domainRef: input.domain,
      categoryRef: input.category,
    });

    // 2. Build the system prompt with output schema
    const systemPrompt = [
      composed.systemPrompt,
      DEFAULT_MARKETING_PROMPT,
      composed.outputSchema ?? MARKETING_OUTPUT_SCHEMA,
    ]
      .filter(Boolean)
      .join("\n\n---\n\n");

    // 3. Build the user prompt with product context + prior outputs
    const userPrompt = buildUserPrompt(input);

    // 4. Execute via provider chain (free-first routing)
    const routingResult = await executeWithRouting(env, lane, {
      lane,
      systemPrompt,
      prompt: userPrompt,
      maxTokens: 3000,
      temperature: 0.5,
    });

    if (!routingResult.success || !routingResult.response) {
      return {
        success: false,
        marketing: null,
        rawContent: null,
        providerLog: routingResult.attempts,
        provider: null,
        model: null,
        templateId: composed.templateId,
        templateVersion: composed.templateVersion,
        error: "All providers exhausted. No marketing result produced.",
      };
    }

    const { response } = routingResult;

    // 5. Parse structured response
    const marketing = parseMarketingResponse(response.content);

    return {
      success: marketing !== null,
      marketing,
      rawContent: response.content,
      providerLog: routingResult.attempts,
      provider: response.provider,
      model: response.model,
      templateId: composed.templateId,
      templateVersion: composed.templateVersion,
      error: marketing === null
        ? "Failed to parse structured marketing from provider response."
        : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[marketing/execute]", message);
    return {
      success: false,
      marketing: null,
      rawContent: null,
      providerLog: [],
      provider: null,
      model: null,
      templateId: null,
      templateVersion: null,
      error: message,
    };
  }
}

/**
 * Save marketing result to D1 as a workflow step output.
 *
 * Also updates the product's base variant with the price suggestion.
 */
export async function saveMarketingOutput(
  env: Env,
  stepId: string,
  runId: string,
  productId: string,
  result: MarketingExecutionResult,
): Promise<string> {
  const outputId = generateId("wso_");
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO workflow_step_outputs
       (id, step_id, run_id, product_id, role_type, output_json, provider_log_json, created_at)
     VALUES (?, ?, ?, ?, 'marketing', ?, ?, ?)`,
  )
    .bind(
      outputId,
      stepId,
      runId,
      productId,
      JSON.stringify(result.marketing),
      JSON.stringify(result.providerLog),
      now,
    )
    .run();

  // Update base product variant with price suggestion if available
  if (result.marketing?.price_suggestion) {
    await env.DB.prepare(
      `UPDATE product_variants
       SET price_suggestion = ?, seo_json = ?, updated_at = ?
       WHERE product_id = ? AND variant_type = 'base' AND platform_id IS NULL AND social_channel_id IS NULL`,
    )
      .bind(
        result.marketing.price_suggestion.recommended_price,
        JSON.stringify(result.marketing.seo),
        now,
        productId,
      )
      .run();
  }

  // Update the workflow step's output_ref
  await env.DB.prepare(
    "UPDATE workflow_steps SET output_ref = ? WHERE id = ?",
  )
    .bind(outputId, stepId)
    .run();

  return outputId;
}

// ── Internal helpers ────────────────────────────────────────

function buildUserPrompt(input: MarketingInput): string {
  const parts = [
    `Product Idea: ${input.productIdea}`,
    `Domain: ${input.domain}`,
  ];

  if (input.category) {
    parts.push(`Category: ${input.category}`);
  }

  if (input.notes) {
    parts.push(`Additional Notes: ${input.notes}`);
  }

  // Include prior workflow context
  if (input.researchContext) {
    parts.push(
      "",
      "--- RESEARCH CONTEXT (from Researcher AI) ---",
      typeof input.researchContext === "string"
        ? input.researchContext
        : JSON.stringify(input.researchContext, null, 2),
    );
  }

  if (input.creatorOutput) {
    parts.push(
      "",
      "--- CREATOR OUTPUT (from Creator AI) ---",
      typeof input.creatorOutput === "string"
        ? input.creatorOutput
        : JSON.stringify(input.creatorOutput, null, 2),
    );
  }

  if (input.platformVariants) {
    parts.push(
      "",
      "--- PLATFORM VARIANTS (from Platform Adapter AI) ---",
      typeof input.platformVariants === "string"
        ? input.platformVariants
        : JSON.stringify(input.platformVariants, null, 2),
    );
  }

  parts.push(
    "",
    "Generate comprehensive marketing optimization for this product.",
    "Include pricing suggestion, SEO, descriptions, copy, CTAs, and positioning.",
    "Return your output as structured JSON matching the output schema.",
  );

  return parts.join("\n");
}

/**
 * Parse the provider response into a structured MarketingResult.
 */
function parseMarketingResponse(content: string): MarketingResult | null {
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);

    const result: MarketingResult = {
      price_suggestion: {
        recommended_price: parsed.price_suggestion?.recommended_price ?? "",
        price_tier: parsed.price_suggestion?.price_tier ?? "mid_range",
        pricing_model: parsed.price_suggestion?.pricing_model ?? "",
        justification: parsed.price_suggestion?.justification ?? "",
      },
      seo: {
        seo_title_variations: Array.isArray(parsed.seo?.seo_title_variations) ? parsed.seo.seo_title_variations : [],
        meta_description: parsed.seo?.meta_description ?? "",
        primary_keywords: Array.isArray(parsed.seo?.primary_keywords) ? parsed.seo.primary_keywords : [],
        secondary_keywords: Array.isArray(parsed.seo?.secondary_keywords) ? parsed.seo.secondary_keywords : [],
        long_tail_keywords: Array.isArray(parsed.seo?.long_tail_keywords) ? parsed.seo.long_tail_keywords : [],
      },
      descriptions: {
        short_description: parsed.descriptions?.short_description ?? "",
        medium_description: parsed.descriptions?.medium_description ?? "",
        long_description: parsed.descriptions?.long_description ?? "",
        bullet_benefits: Array.isArray(parsed.descriptions?.bullet_benefits) ? parsed.descriptions.bullet_benefits : [],
      },
      copy: {
        headline_variations: Array.isArray(parsed.copy?.headline_variations) ? parsed.copy.headline_variations : [],
        subheadline_options: Array.isArray(parsed.copy?.subheadline_options) ? parsed.copy.subheadline_options : [],
        hook_sentences: Array.isArray(parsed.copy?.hook_sentences) ? parsed.copy.hook_sentences : [],
        objection_handlers: Array.isArray(parsed.copy?.objection_handlers) ? parsed.copy.objection_handlers : [],
        social_proof_suggestions: Array.isArray(parsed.copy?.social_proof_suggestions) ? parsed.copy.social_proof_suggestions : [],
        urgency_angles: Array.isArray(parsed.copy?.urgency_angles) ? parsed.copy.urgency_angles : [],
      },
      cta_options: {
        primary_cta: parsed.cta_options?.primary_cta ?? "",
        secondary_cta: parsed.cta_options?.secondary_cta ?? "",
        variations: Array.isArray(parsed.cta_options?.variations) ? parsed.cta_options.variations : [],
      },
      positioning: {
        usp: parsed.positioning?.usp ?? "",
        differentiators: Array.isArray(parsed.positioning?.differentiators) ? parsed.positioning.differentiators : [],
        target_audience_message: parsed.positioning?.target_audience_message ?? "",
        brand_voice_notes: parsed.positioning?.brand_voice_notes ?? "",
      },
    };

    // Must have at least some meaningful marketing content
    const hasContent =
      result.price_suggestion.recommended_price.length > 0 ||
      result.descriptions.short_description.length > 0 ||
      result.copy.headline_variations.length > 0;

    return hasContent ? result : null;
  } catch {
    console.error("[marketing/parse] Failed to parse JSON from provider response");
    return null;
  }
}
