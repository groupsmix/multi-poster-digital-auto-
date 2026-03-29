/**
 * Platform Adapter AI Service — orchestrates the platform adaptation step.
 *
 * Takes the base creator output and adapts it for each selected platform.
 * Creates one variation per platform, each stored as a product_variant.
 *
 * Uses platform-specific rules from the platforms table (title_limit,
 * description_rules, tag_rules, seo_rules, audience_profile, tone_profile,
 * cta_style) to guide the adaptation.
 */

import type { Env } from "../shared/types";
import type { TaskLane } from "../config";
import { generateId } from "../shared/utils";
import { executeWithRouting } from "../providers";
import type { RoutingAttempt } from "../providers";
import { composePrompt } from "./prompt-composer";

// ── Platform adaptation result schema ───────────────────────

/** Structured output for one platform adaptation. */
export interface PlatformVariantResult {
  platform_id: string;
  platform_name: string;
  title: string;
  description: string;
  tags: string[];
  seo: SeoData;
  cta: string;
  content_json: Record<string, unknown>;
}

export interface SeoData {
  meta_title?: string;
  meta_description?: string;
  primary_keywords: string[];
  secondary_keywords: string[];
}

// ── Platform adapter input ──────────────────────────────────

export interface PlatformAdapterInput {
  /** The product/service idea. */
  productIdea: string;
  /** Domain name or slug. */
  domain: string;
  /** Category name or slug (optional). */
  category?: string;
  /** Base creator output to adapt. */
  creatorOutput: unknown;
  /** Research context for richer adaptation (optional). */
  researchContext?: unknown;
  /** Platform IDs to adapt for. */
  platformIds: string[];
  /** Current product version for variant versioning. */
  version: number;
}

// ── Single platform execution result ────────────────────────

export interface PlatformAdapterExecutionResult {
  success: boolean;
  /** The structured platform variant (null on failure). */
  variant: PlatformVariantResult | null;
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

// ── Batch execution result ──────────────────────────────────

export interface PlatformAdapterBatchResult {
  /** Total platforms attempted. */
  total: number;
  /** Number of successful adaptations. */
  succeeded: number;
  /** Number of failed adaptations. */
  failed: number;
  /** Per-platform results. */
  results: PlatformAdapterExecutionResult[];
}

// ── Platform row from D1 ────────────────────────────────────

interface PlatformRow {
  id: string;
  name: string;
  type: string | null;
  title_limit: number | null;
  description_rules: string | null;
  tag_rules: string | null;
  seo_rules: string | null;
  audience_profile: string | null;
  tone_profile: string | null;
  cta_style: string | null;
  is_active: number;
}

// ── Output schema for structured JSON ──────────────────────

const ADAPTER_OUTPUT_SCHEMA = `Return your platform adaptation as a JSON object with exactly this structure:
{
  "title": "string — platform-optimized title",
  "description": "string — platform-specific description",
  "tags": ["string — platform-specific tags"],
  "seo": {
    "meta_title": "string (optional)",
    "meta_description": "string (optional)",
    "primary_keywords": ["string"],
    "secondary_keywords": ["string"]
  },
  "cta": "string — platform-native call to action",
  "content_json": {
    "adapted_body": "string — platform-adapted content",
    "key_features": ["string — highlighted features for this platform"],
    "platform_notes": "string — any platform-specific notes"
  }
}

Return ONLY the JSON object. No markdown fences, no commentary.`;

// ── Default adapter role prompt (fallback) ──────────────────

const DEFAULT_ADAPTER_PROMPT = `You are the Platform Adapter in the NEXUS workflow.
Adapt the base product output for a specific platform.
Make the adaptation feel native to the platform.
Respect platform-specific constraints and audience expectations.`;

// ── Main batch execution function ───────────────────────────

/**
 * Execute the Platform Adapter AI for all selected platforms.
 *
 * Runs one adaptation per platform sequentially.
 * Each platform variation is stored as a product_variant in D1.
 */
export async function executePlatformAdapter(
  env: Env,
  input: PlatformAdapterInput,
): Promise<PlatformAdapterBatchResult> {
  const results: PlatformAdapterExecutionResult[] = [];

  for (const platformId of input.platformIds) {
    const result = await executeSinglePlatformAdapter(env, input, platformId);
    results.push(result);
  }

  return {
    total: input.platformIds.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

/**
 * Execute the Platform Adapter for a single platform.
 */
async function executeSinglePlatformAdapter(
  env: Env,
  input: PlatformAdapterInput,
  platformId: string,
): Promise<PlatformAdapterExecutionResult> {
  const lane: TaskLane = "build";

  try {
    // 1. Load platform details from D1
    const platform = await env.DB.prepare(
      "SELECT * FROM platforms WHERE id = ? AND is_active = 1",
    )
      .bind(platformId)
      .first() as unknown as PlatformRow | null;

    if (!platform) {
      return {
        success: false,
        variant: null,
        rawContent: null,
        providerLog: [],
        provider: null,
        model: null,
        templateId: null,
        templateVersion: null,
        error: `Platform not found or inactive: ${platformId}`,
      };
    }

    // 2. Compose prompt from Prompt Studio (with platform context)
    const composed = await composePrompt(env, {
      role: "adapter",
      domainRef: input.domain,
      categoryRef: input.category,
      platformRef: platform.name,
    });

    // 3. Build the system prompt
    const systemPrompt = [
      composed.systemPrompt,
      DEFAULT_ADAPTER_PROMPT,
      buildPlatformRulesPrompt(platform),
      composed.outputSchema ?? ADAPTER_OUTPUT_SCHEMA,
    ]
      .filter(Boolean)
      .join("\n\n---\n\n");

    // 4. Build the user prompt
    const userPrompt = buildUserPrompt(input, platform);

    // 5. Execute via provider chain
    const routingResult = await executeWithRouting(env, lane, {
      lane,
      systemPrompt,
      prompt: userPrompt,
      maxTokens: 2500,
      temperature: 0.5,
    });

    if (!routingResult.success || !routingResult.response) {
      return {
        success: false,
        variant: null,
        rawContent: null,
        providerLog: routingResult.attempts,
        provider: null,
        model: null,
        templateId: composed.templateId,
        templateVersion: composed.templateVersion,
        error: `All providers exhausted for platform: ${platform.name}`,
      };
    }

    const { response } = routingResult;

    // 6. Parse structured response
    const parsed = parsePlatformResponse(response.content);

    if (!parsed) {
      return {
        success: false,
        variant: null,
        rawContent: response.content,
        providerLog: routingResult.attempts,
        provider: response.provider,
        model: response.model,
        templateId: composed.templateId,
        templateVersion: composed.templateVersion,
        error: `Failed to parse platform adaptation for: ${platform.name}`,
      };
    }

    const variant: PlatformVariantResult = {
      platform_id: platform.id,
      platform_name: platform.name,
      ...parsed,
    };

    return {
      success: true,
      variant,
      rawContent: response.content,
      providerLog: routingResult.attempts,
      provider: response.provider,
      model: response.model,
      templateId: composed.templateId,
      templateVersion: composed.templateVersion,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[platform-adapter/execute] ${platformId}:`, message);
    return {
      success: false,
      variant: null,
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
 * Save platform variant results to D1 as product_variants + workflow step outputs.
 */
export async function savePlatformVariants(
  env: Env,
  stepId: string,
  runId: string,
  productId: string,
  version: number,
  batchResult: PlatformAdapterBatchResult,
): Promise<string> {
  const outputId = generateId("wso_");
  const now = new Date().toISOString();

  // Save each successful variant as a product_variant row
  for (const result of batchResult.results) {
    if (!result.success || !result.variant) continue;

    const variantId = generateId("pv_");
    await env.DB.prepare(
      `INSERT INTO product_variants
         (id, product_id, version, platform_id, variant_type,
          title, description, seo_json, content_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'platform', ?, ?, ?, ?, 'draft', ?, ?)`,
    )
      .bind(
        variantId,
        productId,
        version,
        result.variant.platform_id,
        result.variant.title,
        result.variant.description,
        JSON.stringify(result.variant.seo),
        JSON.stringify(result.variant.content_json),
        now,
        now,
      )
      .run();
  }

  // Save consolidated output to workflow_step_outputs
  const allVariants = batchResult.results
    .filter((r) => r.success && r.variant)
    .map((r) => r.variant);

  await env.DB.prepare(
    `INSERT INTO workflow_step_outputs
       (id, step_id, run_id, product_id, role_type, output_json, provider_log_json, created_at)
     VALUES (?, ?, ?, ?, 'adapter', ?, ?, ?)`,
  )
    .bind(
      outputId,
      stepId,
      runId,
      productId,
      JSON.stringify(allVariants),
      JSON.stringify(batchResult.results.flatMap((r) => r.providerLog)),
      now,
    )
    .run();

  // Update the workflow step's output_ref
  await env.DB.prepare(
    "UPDATE workflow_steps SET output_ref = ? WHERE id = ?",
  )
    .bind(outputId, stepId)
    .run();

  return outputId;
}

// ── Internal helpers ────────────────────────────────────────

function buildPlatformRulesPrompt(platform: PlatformRow): string {
  const rules: string[] = [
    `Platform: ${platform.name}`,
  ];

  if (platform.title_limit) {
    rules.push(`Title max length: ${platform.title_limit} characters`);
  }
  if (platform.description_rules) {
    rules.push(`Description rules: ${platform.description_rules}`);
  }
  if (platform.tag_rules) {
    rules.push(`Tag rules: ${platform.tag_rules}`);
  }
  if (platform.seo_rules) {
    rules.push(`SEO rules: ${platform.seo_rules}`);
  }
  if (platform.audience_profile) {
    rules.push(`Audience profile: ${platform.audience_profile}`);
  }
  if (platform.tone_profile) {
    rules.push(`Tone profile: ${platform.tone_profile}`);
  }
  if (platform.cta_style) {
    rules.push(`CTA style: ${platform.cta_style}`);
  }

  return `Platform-specific rules:\n${rules.join("\n")}`;
}

function buildUserPrompt(
  input: PlatformAdapterInput,
  platform: PlatformRow,
): string {
  const parts = [
    `Product Idea: ${input.productIdea}`,
    `Domain: ${input.domain}`,
    `Target Platform: ${platform.name}`,
  ];

  if (input.category) {
    parts.push(`Category: ${input.category}`);
  }

  // Include creator output as context
  if (input.creatorOutput) {
    parts.push(
      "",
      "--- BASE PRODUCT OUTPUT (from Creator AI) ---",
      typeof input.creatorOutput === "string"
        ? input.creatorOutput
        : JSON.stringify(input.creatorOutput, null, 2),
    );
  }

  // Include research context if available
  if (input.researchContext) {
    parts.push(
      "",
      "--- RESEARCH CONTEXT ---",
      typeof input.researchContext === "string"
        ? input.researchContext
        : JSON.stringify(input.researchContext, null, 2),
    );
  }

  parts.push(
    "",
    `Adapt the base product output specifically for ${platform.name}.`,
    "Make it feel native to the platform. Respect all platform constraints.",
    "Return your adaptation as structured JSON matching the output schema.",
  );

  return parts.join("\n");
}

/**
 * Parse the provider response into a platform variant.
 */
function parsePlatformResponse(content: string): Omit<PlatformVariantResult, "platform_id" | "platform_name"> | null {
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);

    const result = {
      title: typeof parsed.title === "string" ? parsed.title : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      seo: {
        meta_title: parsed.seo?.meta_title ?? undefined,
        meta_description: parsed.seo?.meta_description ?? undefined,
        primary_keywords: Array.isArray(parsed.seo?.primary_keywords) ? parsed.seo.primary_keywords : [],
        secondary_keywords: Array.isArray(parsed.seo?.secondary_keywords) ? parsed.seo.secondary_keywords : [],
      },
      cta: typeof parsed.cta === "string" ? parsed.cta : "",
      content_json: typeof parsed.content_json === "object" && parsed.content_json !== null
        ? parsed.content_json as Record<string, unknown>
        : {},
    };

    const hasContent = result.title.length > 0 || result.description.length > 0;
    return hasContent ? result : null;
  } catch {
    console.error("[platform-adapter/parse] Failed to parse JSON from provider response");
    return null;
  }
}
