/**
 * Partial Regeneration Service — regenerates only selected parts of a product.
 *
 * Per architecture §16, the system must support selective regeneration:
 *   - title only
 *   - price only
 *   - description only
 *   - platform variant (specific platform)
 *   - social variant (specific channel)
 *   - SEO section only
 *
 * Each regeneration:
 *   1. Preserves the previous version in regeneration_history
 *   2. Calls the appropriate AI role via free-first routing
 *   3. Stores the new output
 *   4. Links the regeneration to the review/revision that triggered it
 */

import type { Env } from "../shared/types";
import type { TaskLane } from "../config";
import { generateId } from "../shared/utils";
import { executeWithRouting } from "../providers";
import type { RoutingAttempt } from "../providers";
import { composePrompt } from "./prompt-composer";

// ── Regeneration target types ─────────────────────────────

/** The specific parts that can be regenerated individually. */
export const REGENERATION_TARGETS = [
  "title",
  "price",
  "description",
  "platform_variant",
  "social_variant",
  "seo",
] as const;

export type RegenerationTarget = (typeof REGENERATION_TARGETS)[number];

// ── Regeneration input ────────────────────────────────────

export interface RegenerationInput {
  /** Which part to regenerate. */
  target: RegenerationTarget;
  /** Product ID. */
  productId: string;
  /** Current product version. */
  version: number;
  /** The product idea for context. */
  productIdea: string;
  /** Domain name or slug. */
  domain: string;
  /** Category name or slug (optional). */
  category?: string;
  /**
   * Reference ID for the target (e.g., platform_id for platform_variant,
   * social_channel_id for social_variant). Optional for title/price/description/seo.
   */
  targetRef?: string;
  /** The current value being replaced (for history). */
  previousValue?: unknown;
  /** Boss notes / revision feedback guiding the regeneration. */
  bossNotes?: string;
  /** Review ID that triggered this regeneration (optional). */
  reviewId?: string;
  /** Revision ID that triggered this regeneration (optional). */
  revisionId?: string;
  /** Additional context from prior workflow outputs. */
  priorContext?: unknown;
}

// ── Regeneration result ───────────────────────────────────

export interface RegenerationResult {
  success: boolean;
  /** The regenerated content. */
  content: unknown;
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
  /** The regeneration history record ID. */
  historyId: string | null;
  /** Error message if failed. */
  error: string | null;
}

// ── Lane and role mapping ─────────────────────────────────

/** Map regeneration targets to the appropriate task lane and AI role. */
const TARGET_CONFIG: Record<
  RegenerationTarget,
  { lane: TaskLane; role: "creator" | "marketing" | "adapter" | "social"; outputSchema: string }
> = {
  title: {
    lane: "build",
    role: "creator",
    outputSchema: `Return a JSON object: { "title": "new compelling product title" }
Return ONLY the JSON object. No markdown fences, no commentary.`,
  },
  price: {
    lane: "build",
    role: "marketing",
    outputSchema: `Return a JSON object: { "price_suggestion": { "amount": "string", "currency": "USD", "tier": "budget | mid_range | premium", "reasoning": "string" } }
Return ONLY the JSON object. No markdown fences, no commentary.`,
  },
  description: {
    lane: "build",
    role: "creator",
    outputSchema: `Return a JSON object: { "description": "new detailed, benefit-driven product description" }
Return ONLY the JSON object. No markdown fences, no commentary.`,
  },
  platform_variant: {
    lane: "build",
    role: "adapter",
    outputSchema: `Return a JSON object: { "title": "platform-adapted title", "description": "platform-adapted description", "tags": ["tag1", "tag2"], "seo_json": { "meta_title": "string", "meta_description": "string", "keywords": ["string"] } }
Return ONLY the JSON object. No markdown fences, no commentary.`,
  },
  social_variant: {
    lane: "build",
    role: "social",
    outputSchema: `Return a JSON object: { "caption": "social post content", "hashtags": ["tag1", "tag2"], "hook": "attention-grabbing opening", "cta": "call to action" }
Return ONLY the JSON object. No markdown fences, no commentary.`,
  },
  seo: {
    lane: "structured_output",
    role: "marketing",
    outputSchema: `Return a JSON object: { "seo": { "meta_title": "string", "meta_description": "string", "keywords": ["string"], "slug_suggestion": "string", "og_title": "string", "og_description": "string" } }
Return ONLY the JSON object. No markdown fences, no commentary.`,
  },
};

// ── Main execution function ────────────────────────────────

/**
 * Execute a partial regeneration for a specific target.
 *
 * 1. Validate the target type
 * 2. Compose the prompt for the appropriate AI role
 * 3. Build a focused user prompt for just the target section
 * 4. Call the provider chain (free-first routing)
 * 5. Parse the result
 * 6. Save to regeneration_history
 * 7. Return the result
 */
export async function executeRegeneration(
  env: Env,
  input: RegenerationInput,
): Promise<RegenerationResult> {
  const config = TARGET_CONFIG[input.target];
  if (!config) {
    return {
      success: false,
      content: null,
      rawContent: null,
      providerLog: [],
      provider: null,
      model: null,
      templateId: null,
      templateVersion: null,
      historyId: null,
      error: `Invalid regeneration target: ${input.target}`,
    };
  }

  try {
    // 1. Compose prompt from Prompt Studio
    const composed = await composePrompt(env, {
      role: config.role,
      domainRef: input.domain,
      categoryRef: input.category,
      isRevision: !!input.bossNotes,
      revisionNotes: input.bossNotes,
    });

    // 2. Build the system prompt
    const systemPrompt = [
      composed.systemPrompt,
      buildRoleInstruction(input.target),
      composed.outputSchema ?? config.outputSchema,
    ]
      .filter(Boolean)
      .join("\n\n---\n\n");

    // 3. Build the user prompt
    const userPrompt = buildRegenerationPrompt(input);

    // 4. Execute via provider chain
    const routingResult = await executeWithRouting(env, config.lane, {
      lane: config.lane,
      systemPrompt,
      prompt: userPrompt,
      maxTokens: 1500,
      temperature: 0.5,
    });

    if (!routingResult.success || !routingResult.response) {
      return {
        success: false,
        content: null,
        rawContent: null,
        providerLog: routingResult.attempts,
        provider: null,
        model: null,
        templateId: composed.templateId,
        templateVersion: composed.templateVersion,
        historyId: null,
        error: "All providers exhausted. No regeneration result produced.",
      };
    }

    const { response } = routingResult;

    // 5. Parse result
    const content = parseRegenerationResponse(response.content);

    // 6. Save to regeneration_history
    const historyId = await saveRegenerationHistory(env, input, {
      content,
      provider: response.provider,
      model: response.model,
      templateId: composed.templateId,
      success: content !== null,
    });

    return {
      success: content !== null,
      content,
      rawContent: response.content,
      providerLog: routingResult.attempts,
      provider: response.provider,
      model: response.model,
      templateId: composed.templateId,
      templateVersion: composed.templateVersion,
      historyId,
      error: content === null
        ? "Failed to parse regenerated content from provider response."
        : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[regenerator/execute]", message);
    return {
      success: false,
      content: null,
      rawContent: null,
      providerLog: [],
      provider: null,
      model: null,
      templateId: null,
      templateVersion: null,
      historyId: null,
      error: message,
    };
  }
}

/**
 * Save a regeneration event to the history table.
 */
async function saveRegenerationHistory(
  env: Env,
  input: RegenerationInput,
  result: {
    content: unknown;
    provider: string;
    model: string;
    templateId: string | null;
    success: boolean;
  },
): Promise<string> {
  const id = generateId("regen_");
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO regeneration_history
       (id, product_id, revision_id, review_id, version, target_type, target_ref,
        previous_json, regenerated_json, provider_used, model_used,
        prompt_template_id, boss_notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.productId,
      input.revisionId ?? null,
      input.reviewId ?? null,
      input.version,
      input.target,
      input.targetRef ?? null,
      input.previousValue ? JSON.stringify(input.previousValue) : null,
      result.content ? JSON.stringify(result.content) : null,
      result.provider,
      result.model,
      result.templateId,
      input.bossNotes ?? null,
      result.success ? "completed" : "failed",
      now,
    )
    .run();

  return id;
}

/**
 * List regeneration history for a product.
 */
export async function listRegenerationHistory(
  env: Env,
  productId: string,
): Promise<unknown[]> {
  const result = await env.DB.prepare(
    `SELECT * FROM regeneration_history
     WHERE product_id = ?
     ORDER BY created_at DESC`,
  )
    .bind(productId)
    .all();

  return result.results;
}

// ── Internal helpers ────────────────────────────────────────

function buildRoleInstruction(target: RegenerationTarget): string {
  const instructions: Record<RegenerationTarget, string> = {
    title:
      "You are regenerating ONLY the product title. Create a new, compelling, SEO-friendly title that is different from the previous one.",
    price:
      "You are regenerating ONLY the pricing suggestion. Analyze the market and provide a well-reasoned pricing recommendation.",
    description:
      "You are regenerating ONLY the product description. Write a new, benefit-driven, detailed description.",
    platform_variant:
      "You are regenerating a platform-specific variant. Adapt the product for the specified platform following its rules and audience expectations.",
    social_variant:
      "You are regenerating a social media variant. Create channel-specific promotional content with appropriate tone, length, and hooks.",
    seo:
      "You are regenerating ONLY the SEO section. Optimize meta titles, descriptions, keywords, and other SEO elements for discoverability.",
  };

  return instructions[target];
}

function buildRegenerationPrompt(input: RegenerationInput): string {
  const parts = [
    `Product Idea: ${input.productIdea}`,
    `Domain: ${input.domain}`,
    `Regeneration Target: ${input.target}`,
  ];

  if (input.category) {
    parts.push(`Category: ${input.category}`);
  }

  if (input.targetRef) {
    parts.push(`Target Reference: ${input.targetRef}`);
  }

  if (input.previousValue) {
    parts.push(
      "",
      "--- PREVIOUS VALUE (to be replaced) ---",
      typeof input.previousValue === "string"
        ? input.previousValue
        : JSON.stringify(input.previousValue, null, 2),
    );
  }

  if (input.bossNotes) {
    parts.push(
      "",
      "--- BOSS FEEDBACK / REVISION NOTES ---",
      input.bossNotes,
    );
  }

  if (input.priorContext) {
    parts.push(
      "",
      "--- PRIOR WORKFLOW CONTEXT ---",
      typeof input.priorContext === "string"
        ? input.priorContext
        : JSON.stringify(input.priorContext, null, 2),
    );
  }

  parts.push(
    "",
    `Regenerate ONLY the ${input.target} based on the above context and feedback.`,
    "Return your output as structured JSON matching the output schema.",
  );

  return parts.join("\n");
}

/**
 * Parse the provider response into a structured object.
 */
function parseRegenerationResponse(content: string): unknown {
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("[regenerator/parse] Failed to parse JSON from provider response");
    return null;
  }
}
