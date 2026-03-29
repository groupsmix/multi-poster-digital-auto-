/**
 * Researcher AI Service — orchestrates the research workflow step.
 *
 * Takes a product idea + domain/category + optional platform context,
 * composes the researcher prompt via Prompt Studio templates,
 * calls the provider chain using free-first routing (search lane),
 * and returns a structured research result.
 */

import type { Env } from "../shared/types";
import type { TaskLane } from "../config";
import { generateId } from "../shared/utils";
import { executeWithRouting } from "../providers";
import type { RoutingAttempt } from "../providers";
import { composePrompt } from "./prompt-composer";

// ── Research result schema ──────────────────────────────────

/** Structured research output matching architecture §8.1. */
export interface ResearchResult {
  trends: TrendItem[];
  competitors: CompetitorItem[];
  pricing_signals: PricingSignal[];
  keywords: KeywordItem[];
  audience_notes: AudienceNote[];
}

export interface TrendItem {
  trend: string;
  relevance: string;
  source_hint?: string;
}

export interface CompetitorItem {
  name: string;
  strengths: string[];
  weaknesses: string[];
  pricing_model?: string;
  positioning?: string;
}

export interface PricingSignal {
  tier: string;
  range: string;
  model: string;
  notes?: string;
}

export interface KeywordItem {
  keyword: string;
  type: "primary" | "long_tail" | "seo" | "platform_tag";
  estimated_value?: string;
}

export interface AudienceNote {
  insight: string;
  category: "demographics" | "motivations" | "pain_points" | "channels" | "behavior";
}

// ── Research input ──────────────────────────────────────────

export interface ResearchInput {
  /** The product/service idea to research. */
  productIdea: string;
  /** Domain name or slug. */
  domain: string;
  /** Category name or slug (optional). */
  category?: string;
  /** Platform context for platform-specific insights (optional). */
  platformContext?: string;
  /** Additional notes from the user (optional). */
  notes?: string;
}

// ── Research execution result ───────────────────────────────

export interface ResearchExecutionResult {
  success: boolean;
  /** The structured research data (null on failure). */
  research: ResearchResult | null;
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

const RESEARCHER_OUTPUT_SCHEMA = `Return your research as a JSON object with exactly this structure:
{
  "trends": [
    { "trend": "string", "relevance": "string", "source_hint": "string (optional)" }
  ],
  "competitors": [
    {
      "name": "string",
      "strengths": ["string"],
      "weaknesses": ["string"],
      "pricing_model": "string (optional)",
      "positioning": "string (optional)"
    }
  ],
  "pricing_signals": [
    { "tier": "budget | mid_range | premium", "range": "string", "model": "string", "notes": "string (optional)" }
  ],
  "keywords": [
    { "keyword": "string", "type": "primary | long_tail | seo | platform_tag", "estimated_value": "string (optional)" }
  ],
  "audience_notes": [
    { "insight": "string", "category": "demographics | motivations | pain_points | channels | behavior" }
  ]
}

Return ONLY the JSON object. No markdown fences, no commentary.`;

// ── Default researcher role prompt (fallback) ──────────────

const DEFAULT_RESEARCHER_PROMPT = `You are the Researcher in the NEXUS workflow.
Conduct thorough market research for the given product idea.
Cover: trends, competitors, pricing signals, keywords, and audience notes.
Be specific, actionable, and commercially useful.`;

// ── Main execution function ────────────────────────────────

/**
 * Execute the Researcher AI workflow step.
 *
 * 1. Compose the researcher prompt from Prompt Studio templates
 * 2. Build the user prompt with product context
 * 3. Call the provider chain (search lane, free-first)
 * 4. Parse the structured response
 * 5. Return the result with provider log
 */
export async function executeResearch(
  env: Env,
  input: ResearchInput,
): Promise<ResearchExecutionResult> {
  const lane: TaskLane = "search";

  try {
    // 1. Compose prompt from Prompt Studio
    const composed = await composePrompt(env, {
      role: "researcher",
      domainRef: input.domain,
      categoryRef: input.category,
      platformRef: input.platformContext,
    });

    // 2. Build the system prompt with output schema
    const systemPrompt = [
      composed.systemPrompt,
      DEFAULT_RESEARCHER_PROMPT,
      composed.outputSchema ?? RESEARCHER_OUTPUT_SCHEMA,
    ]
      .filter(Boolean)
      .join("\n\n---\n\n");

    // 3. Build the user prompt with product context
    const userPrompt = buildUserPrompt(input);

    // 4. Execute via provider chain (free-first routing)
    const routingResult = await executeWithRouting(env, lane, {
      lane,
      systemPrompt,
      prompt: userPrompt,
      maxTokens: 2000,
      temperature: 0.4,
    });

    if (!routingResult.success || !routingResult.response) {
      return {
        success: false,
        research: null,
        rawContent: null,
        providerLog: routingResult.attempts,
        provider: null,
        model: null,
        templateId: composed.templateId,
        templateVersion: composed.templateVersion,
        error: "All providers exhausted. No research result produced.",
      };
    }

    const { response } = routingResult;

    // 5. Parse structured response
    const research = parseResearchResponse(response.content);

    return {
      success: research !== null,
      research,
      rawContent: response.content,
      providerLog: routingResult.attempts,
      provider: response.provider,
      model: response.model,
      templateId: composed.templateId,
      templateVersion: composed.templateVersion,
      error: research === null
        ? "Failed to parse structured research from provider response."
        : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[researcher/execute]", message);
    return {
      success: false,
      research: null,
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
 * Save research result to D1 as a workflow step output.
 *
 * Stores the structured output and provider log, and updates
 * the workflow step's output_ref to point to the saved record.
 */
export async function saveResearchOutput(
  env: Env,
  stepId: string,
  runId: string,
  productId: string,
  result: ResearchExecutionResult,
): Promise<string> {
  const outputId = generateId("wso_");
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO workflow_step_outputs
       (id, step_id, run_id, product_id, role_type, output_json, provider_log_json, created_at)
     VALUES (?, ?, ?, ?, 'researcher', ?, ?, ?)`,
  )
    .bind(
      outputId,
      stepId,
      runId,
      productId,
      JSON.stringify(result.research),
      JSON.stringify(result.providerLog),
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

/**
 * Log provider routing attempts to the provider_call_log table.
 */
export async function logProviderPath(
  env: Env,
  runId: string,
  stepId: string,
  attempts: RoutingAttempt[],
): Promise<void> {
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    const logId = generateId("pcl_");

    await env.DB.prepare(
      `INSERT INTO provider_call_log
         (id, run_id, step_id, task_lane, provider_id, provider_name,
          model, outcome, error, latency_ms, attempt_order, created_at)
       VALUES (?, ?, ?, 'search', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        logId,
        runId,
        stepId,
        attempt.providerId,
        attempt.providerName,
        attempt.model,
        attempt.outcome,
        attempt.error ?? null,
        attempt.latencyMs ?? null,
        i,
        new Date().toISOString(),
      )
      .run();
  }
}

// ── Internal helpers ────────────────────────────────────────

function buildUserPrompt(input: ResearchInput): string {
  const parts = [
    `Product Idea: ${input.productIdea}`,
    `Domain: ${input.domain}`,
  ];

  if (input.category) {
    parts.push(`Category: ${input.category}`);
  }

  if (input.platformContext) {
    parts.push(`Platform Context: ${input.platformContext}`);
  }

  if (input.notes) {
    parts.push(`Additional Notes: ${input.notes}`);
  }

  parts.push(
    "",
    "Conduct thorough market research for this product idea.",
    "Return your findings as structured JSON matching the output schema.",
  );

  return parts.join("\n");
}

/**
 * Parse the provider response into a structured ResearchResult.
 *
 * Handles:
 * - Clean JSON responses
 * - JSON wrapped in markdown code fences
 * - Partial/malformed JSON (best-effort)
 */
function parseResearchResponse(content: string): ResearchResult | null {
  // Strip markdown code fences if present
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);

    // Validate the required fields exist
    const result: ResearchResult = {
      trends: Array.isArray(parsed.trends) ? parsed.trends : [],
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
      pricing_signals: Array.isArray(parsed.pricing_signals) ? parsed.pricing_signals : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      audience_notes: Array.isArray(parsed.audience_notes) ? parsed.audience_notes : [],
    };

    // Must have at least one section populated
    const hasContent =
      result.trends.length > 0 ||
      result.competitors.length > 0 ||
      result.pricing_signals.length > 0 ||
      result.keywords.length > 0 ||
      result.audience_notes.length > 0;

    return hasContent ? result : null;
  } catch {
    console.error("[researcher/parse] Failed to parse JSON from provider response");
    return null;
  }
}
