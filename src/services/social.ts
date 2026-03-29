/**
 * Social AI Service — orchestrates the social content generation step.
 *
 * Takes prior workflow outputs and creates channel-specific promotional
 * content for each selected social channel. Creates one variation per
 * social channel, each stored as a product_variant.
 *
 * Uses social channel rules from the social_channels table (caption_rules,
 * hashtag_rules, length_rules, audience_style, tone_profile) to guide
 * content creation.
 */

import type { Env } from "../shared/types";
import type { TaskLane } from "../config";
import { generateId } from "../shared/utils";
import { executeWithRouting } from "../providers";
import type { RoutingAttempt } from "../providers";
import { composePrompt } from "./prompt-composer";

// ── Social content result schema ────────────────────────────

/** Structured output for one social channel variation. */
export interface SocialVariantResult {
  social_channel_id: string;
  social_channel_name: string;
  post_content: string;
  hook: string;
  cta: string;
  hashtags: string[];
  visual_suggestions: string[];
  engagement_prompt: string;
  content_json: Record<string, unknown>;
}

// ── Social AI input ─────────────────────────────────────────

export interface SocialInput {
  /** The product/service idea. */
  productIdea: string;
  /** Domain name or slug. */
  domain: string;
  /** Category name or slug (optional). */
  category?: string;
  /** Base creator output (optional). */
  creatorOutput?: unknown;
  /** Research context (optional). */
  researchContext?: unknown;
  /** Marketing output for copy/positioning context (optional). */
  marketingOutput?: unknown;
  /** Social channel IDs to generate content for. */
  socialChannelIds: string[];
  /** Current product version for variant versioning. */
  version: number;
}

// ── Single channel execution result ─────────────────────────

export interface SocialExecutionResult {
  success: boolean;
  /** The structured social variant (null on failure). */
  variant: SocialVariantResult | null;
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

export interface SocialBatchResult {
  /** Total channels attempted. */
  total: number;
  /** Number of successful generations. */
  succeeded: number;
  /** Number of failed generations. */
  failed: number;
  /** Per-channel results. */
  results: SocialExecutionResult[];
}

// ── Social channel row from D1 ──────────────────────────────

interface SocialChannelRow {
  id: string;
  name: string;
  caption_rules: string | null;
  hashtag_rules: string | null;
  length_rules: string | null;
  audience_style: string | null;
  tone_profile: string | null;
  is_active: number;
}

// ── Output schema for structured JSON ──────────────────────

const SOCIAL_OUTPUT_SCHEMA = `Return your social content as a JSON object with exactly this structure:
{
  "post_content": "string — the full post text for this channel",
  "hook": "string — attention-grabbing opening line",
  "cta": "string — channel-native call to action",
  "hashtags": ["string — channel-appropriate hashtags"],
  "visual_suggestions": ["string — image/video concept ideas"],
  "engagement_prompt": "string — question or prompt to drive comments",
  "content_json": {
    "format_type": "string (post, thread, story, reel, carousel, etc.)",
    "tone": "string — the tone used",
    "estimated_length": "string — word/character count estimate",
    "platform_notes": "string — any channel-specific notes"
  }
}

Return ONLY the JSON object. No markdown fences, no commentary.`;

// ── Default social role prompt (fallback) ───────────────────

const DEFAULT_SOCIAL_PROMPT = `You are the Social AI in the NEXUS workflow.
Create channel-specific promotional content for a product.
Each social channel has unique tone, format, length, and engagement patterns.
Your content must feel native to the channel. Never use a one-size-fits-all approach.`;

// ── Main batch execution function ───────────────────────────

/**
 * Execute the Social AI for all selected social channels.
 *
 * Runs one generation per channel sequentially.
 * Each channel variation is stored as a product_variant in D1.
 */
export async function executeSocial(
  env: Env,
  input: SocialInput,
): Promise<SocialBatchResult> {
  const results: SocialExecutionResult[] = [];

  for (const channelId of input.socialChannelIds) {
    const result = await executeSingleSocial(env, input, channelId);
    results.push(result);
  }

  return {
    total: input.socialChannelIds.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

/**
 * Execute the Social AI for a single channel.
 */
async function executeSingleSocial(
  env: Env,
  input: SocialInput,
  channelId: string,
): Promise<SocialExecutionResult> {
  const lane: TaskLane = "build";

  try {
    // 1. Load social channel details from D1
    const channel = await env.DB.prepare(
      "SELECT * FROM social_channels WHERE id = ? AND is_active = 1",
    )
      .bind(channelId)
      .first() as unknown as SocialChannelRow | null;

    if (!channel) {
      return {
        success: false,
        variant: null,
        rawContent: null,
        providerLog: [],
        provider: null,
        model: null,
        templateId: null,
        templateVersion: null,
        error: `Social channel not found or inactive: ${channelId}`,
      };
    }

    // 2. Compose prompt from Prompt Studio (with social context)
    const composed = await composePrompt(env, {
      role: "social",
      domainRef: input.domain,
      categoryRef: input.category,
      socialRef: channel.name,
    });

    // 3. Build the system prompt
    const systemPrompt = [
      composed.systemPrompt,
      DEFAULT_SOCIAL_PROMPT,
      buildChannelRulesPrompt(channel),
      composed.outputSchema ?? SOCIAL_OUTPUT_SCHEMA,
    ]
      .filter(Boolean)
      .join("\n\n---\n\n");

    // 4. Build the user prompt
    const userPrompt = buildUserPrompt(input, channel);

    // 5. Execute via provider chain
    const routingResult = await executeWithRouting(env, lane, {
      lane,
      systemPrompt,
      prompt: userPrompt,
      maxTokens: 2000,
      temperature: 0.7,
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
        error: `All providers exhausted for social channel: ${channel.name}`,
      };
    }

    const { response } = routingResult;

    // 6. Parse structured response
    const parsed = parseSocialResponse(response.content);

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
        error: `Failed to parse social content for: ${channel.name}`,
      };
    }

    const variant: SocialVariantResult = {
      social_channel_id: channel.id,
      social_channel_name: channel.name,
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
    console.error(`[social/execute] ${channelId}:`, message);
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
 * Save social variant results to D1 as product_variants + workflow step outputs.
 */
export async function saveSocialVariants(
  env: Env,
  stepId: string,
  runId: string,
  productId: string,
  version: number,
  batchResult: SocialBatchResult,
): Promise<string> {
  const outputId = generateId("wso_");
  const now = new Date().toISOString();

  // Save each successful variant as a product_variant row
  for (const result of batchResult.results) {
    if (!result.success || !result.variant) continue;

    const variantId = generateId("pv_");
    await env.DB.prepare(
      `INSERT INTO product_variants
         (id, product_id, version, social_channel_id, variant_type,
          title, description, content_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'social', ?, ?, ?, 'draft', ?, ?)`,
    )
      .bind(
        variantId,
        productId,
        version,
        result.variant.social_channel_id,
        result.variant.hook,
        result.variant.post_content,
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
     VALUES (?, ?, ?, ?, 'social', ?, ?, ?)`,
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

function buildChannelRulesPrompt(channel: SocialChannelRow): string {
  const rules: string[] = [
    `Social Channel: ${channel.name}`,
  ];

  if (channel.caption_rules) {
    rules.push(`Caption rules: ${channel.caption_rules}`);
  }
  if (channel.hashtag_rules) {
    rules.push(`Hashtag rules: ${channel.hashtag_rules}`);
  }
  if (channel.length_rules) {
    rules.push(`Length rules: ${channel.length_rules}`);
  }
  if (channel.audience_style) {
    rules.push(`Audience style: ${channel.audience_style}`);
  }
  if (channel.tone_profile) {
    rules.push(`Tone profile: ${channel.tone_profile}`);
  }

  return `Social channel-specific rules:\n${rules.join("\n")}`;
}

function buildUserPrompt(
  input: SocialInput,
  channel: SocialChannelRow,
): string {
  const parts = [
    `Product Idea: ${input.productIdea}`,
    `Domain: ${input.domain}`,
    `Target Social Channel: ${channel.name}`,
  ];

  if (input.category) {
    parts.push(`Category: ${input.category}`);
  }

  // Include prior workflow context
  if (input.creatorOutput) {
    parts.push(
      "",
      "--- PRODUCT OUTPUT (from Creator AI) ---",
      typeof input.creatorOutput === "string"
        ? input.creatorOutput
        : JSON.stringify(input.creatorOutput, null, 2),
    );
  }

  if (input.researchContext) {
    parts.push(
      "",
      "--- RESEARCH CONTEXT ---",
      typeof input.researchContext === "string"
        ? input.researchContext
        : JSON.stringify(input.researchContext, null, 2),
    );
  }

  if (input.marketingOutput) {
    parts.push(
      "",
      "--- MARKETING CONTEXT (from Marketing AI) ---",
      typeof input.marketingOutput === "string"
        ? input.marketingOutput
        : JSON.stringify(input.marketingOutput, null, 2),
    );
  }

  parts.push(
    "",
    `Create promotional content specifically for ${channel.name}.`,
    "Make it feel native to the channel. Respect all channel-specific rules.",
    "Return your content as structured JSON matching the output schema.",
  );

  return parts.join("\n");
}

/**
 * Parse the provider response into a social variant.
 */
function parseSocialResponse(content: string): Omit<SocialVariantResult, "social_channel_id" | "social_channel_name"> | null {
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);

    const result = {
      post_content: typeof parsed.post_content === "string" ? parsed.post_content : "",
      hook: typeof parsed.hook === "string" ? parsed.hook : "",
      cta: typeof parsed.cta === "string" ? parsed.cta : "",
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      visual_suggestions: Array.isArray(parsed.visual_suggestions) ? parsed.visual_suggestions : [],
      engagement_prompt: typeof parsed.engagement_prompt === "string" ? parsed.engagement_prompt : "",
      content_json: typeof parsed.content_json === "object" && parsed.content_json !== null
        ? parsed.content_json as Record<string, unknown>
        : {},
    };

    const hasContent = result.post_content.length > 0 || result.hook.length > 0;
    return hasContent ? result : null;
  } catch {
    console.error("[social/parse] Failed to parse JSON from provider response");
    return null;
  }
}
