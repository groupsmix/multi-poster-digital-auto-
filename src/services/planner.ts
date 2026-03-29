/**
 * Planner AI Service — orchestrates the planning workflow step.
 *
 * Takes a product idea + domain/category + research context,
 * composes the planner prompt via Prompt Studio templates,
 * calls the provider chain using free-first routing (planning lane),
 * and returns a structured plan result.
 *
 * Architecture §8.2 — previously handled within Creator flow,
 * now a standalone service.
 */

import type { Env } from "../shared/types";
import type { TaskLane } from "../config";
import { generateId } from "../shared/utils";
import { executeWithRouting } from "../providers";
import type { RoutingAttempt } from "../providers";
import { composePrompt } from "./prompt-composer";

// ── Plan result schema ──────────────────────────────────────

/** Structured planner output matching architecture §8.2. */
export interface PlannerResult {
  outline: OutlineSection[];
  product_structure: ProductStructure;
  stage_plan: StagePlanItem[];
  offer_architecture: OfferArchitecture;
}

export interface OutlineSection {
  section: string;
  description: string;
  priority: "high" | "medium" | "low";
}

export interface ProductStructure {
  format: string;
  components: string[];
  delivery_method: string;
  estimated_effort: string;
}

export interface StagePlanItem {
  stage: string;
  tasks: string[];
  dependencies: string[];
  estimated_time: string;
}

export interface OfferArchitecture {
  core_offer: string;
  upsells: string[];
  bundles: string[];
  pricing_tiers: PricingTier[];
}

export interface PricingTier {
  name: string;
  price_range: string;
  includes: string[];
}

// ── Planner input ──────────────────────────────────────────

export interface PlannerInput {
  /** The product/service idea to plan. */
  productIdea: string;
  /** Domain name or slug. */
  domain: string;
  /** Category name or slug (optional). */
  category?: string;
  /** Structured research output from the Researcher AI (optional). */
  researchContext?: unknown;
  /** Additional notes from the user (optional). */
  notes?: string;
}

// ── Planner execution result ───────────────────────────────

export interface PlannerExecutionResult {
  success: boolean;
  /** The structured plan data (null on failure). */
  plan: PlannerResult | null;
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

const PLANNER_OUTPUT_SCHEMA = `Return your plan as a JSON object with exactly this structure:
{
  "outline": [
    { "section": "string", "description": "string", "priority": "high | medium | low" }
  ],
  "product_structure": {
    "format": "string — e.g. ebook, course, template pack",
    "components": ["string — each deliverable component"],
    "delivery_method": "string — e.g. digital download, online access",
    "estimated_effort": "string — e.g. 2-3 weeks"
  },
  "stage_plan": [
    {
      "stage": "string — stage name",
      "tasks": ["string"],
      "dependencies": ["string — what must come before"],
      "estimated_time": "string"
    }
  ],
  "offer_architecture": {
    "core_offer": "string — the main product offer",
    "upsells": ["string — additional upsell items"],
    "bundles": ["string — bundle options"],
    "pricing_tiers": [
      { "name": "string", "price_range": "string", "includes": ["string"] }
    ]
  }
}

Return ONLY the JSON object. No markdown fences, no commentary.`;

// ── Default planner role prompt (fallback) ──────────────────

const DEFAULT_PLANNER_PROMPT = `You are the Planner/Architect in the NEXUS workflow.
Create a comprehensive product plan based on the research context provided.
Design: content outline, product structure, staged production plan, and offer architecture.
Be specific, actionable, and commercially strategic.`;

// ── Main execution function ────────────────────────────────

/**
 * Execute the Planner AI workflow step.
 *
 * 1. Compose the planner prompt from Prompt Studio templates
 * 2. Build the user prompt with product context + research
 * 3. Call the provider chain (planning lane, free-first)
 * 4. Parse the structured response
 * 5. Return the result with provider log
 */
export async function executePlanner(
  env: Env,
  input: PlannerInput,
): Promise<PlannerExecutionResult> {
  const lane: TaskLane = "planning";

  try {
    // 1. Compose prompt from Prompt Studio
    const composed = await composePrompt(env, {
      role: "planner",
      domainRef: input.domain,
      categoryRef: input.category,
    });

    // 2. Build the system prompt with output schema
    const systemPrompt = [
      composed.systemPrompt,
      DEFAULT_PLANNER_PROMPT,
      composed.outputSchema ?? PLANNER_OUTPUT_SCHEMA,
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
      maxTokens: 2500,
      temperature: 0.5,
    });

    if (!routingResult.success || !routingResult.response) {
      return {
        success: false,
        plan: null,
        rawContent: null,
        providerLog: routingResult.attempts,
        provider: null,
        model: null,
        templateId: composed.templateId,
        templateVersion: composed.templateVersion,
        error: "All providers exhausted. No plan result produced.",
      };
    }

    const { response } = routingResult;

    // 5. Parse structured response
    const plan = parsePlannerResponse(response.content);

    return {
      success: plan !== null,
      plan,
      rawContent: response.content,
      providerLog: routingResult.attempts,
      provider: response.provider,
      model: response.model,
      templateId: composed.templateId,
      templateVersion: composed.templateVersion,
      error: plan === null
        ? "Failed to parse structured plan from provider response."
        : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[planner/execute]", message);
    return {
      success: false,
      plan: null,
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
 * Save planner result to D1 as a workflow step output.
 */
export async function savePlannerOutput(
  env: Env,
  stepId: string,
  runId: string,
  productId: string,
  result: PlannerExecutionResult,
): Promise<string> {
  const outputId = generateId("wso_");
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO workflow_step_outputs
       (id, step_id, run_id, product_id, role_type, output_json, provider_log_json, created_at)
     VALUES (?, ?, ?, ?, 'planner', ?, ?, ?)`,
  )
    .bind(
      outputId,
      stepId,
      runId,
      productId,
      JSON.stringify(result.plan),
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

// ── Internal helpers ────────────────────────────────────────

function buildUserPrompt(input: PlannerInput): string {
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

  // Include research context
  if (input.researchContext) {
    parts.push(
      "",
      "--- RESEARCH CONTEXT (from Researcher AI) ---",
      typeof input.researchContext === "string"
        ? input.researchContext
        : JSON.stringify(input.researchContext, null, 2),
    );
  }

  parts.push(
    "",
    "Create a comprehensive product plan based on the above context.",
    "Return your plan as structured JSON matching the output schema.",
  );

  return parts.join("\n");
}

/**
 * Parse the provider response into a structured PlannerResult.
 */
function parsePlannerResponse(content: string): PlannerResult | null {
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);

    const result: PlannerResult = {
      outline: Array.isArray(parsed.outline) ? parsed.outline : [],
      product_structure: parsed.product_structure && typeof parsed.product_structure === "object"
        ? {
            format: typeof parsed.product_structure.format === "string" ? parsed.product_structure.format : "",
            components: Array.isArray(parsed.product_structure.components) ? parsed.product_structure.components : [],
            delivery_method: typeof parsed.product_structure.delivery_method === "string" ? parsed.product_structure.delivery_method : "",
            estimated_effort: typeof parsed.product_structure.estimated_effort === "string" ? parsed.product_structure.estimated_effort : "",
          }
        : { format: "", components: [], delivery_method: "", estimated_effort: "" },
      stage_plan: Array.isArray(parsed.stage_plan) ? parsed.stage_plan : [],
      offer_architecture: parsed.offer_architecture && typeof parsed.offer_architecture === "object"
        ? {
            core_offer: typeof parsed.offer_architecture.core_offer === "string" ? parsed.offer_architecture.core_offer : "",
            upsells: Array.isArray(parsed.offer_architecture.upsells) ? parsed.offer_architecture.upsells : [],
            bundles: Array.isArray(parsed.offer_architecture.bundles) ? parsed.offer_architecture.bundles : [],
            pricing_tiers: Array.isArray(parsed.offer_architecture.pricing_tiers) ? parsed.offer_architecture.pricing_tiers : [],
          }
        : { core_offer: "", upsells: [], bundles: [], pricing_tiers: [] },
    };

    // Must have at least one section populated
    const hasContent =
      result.outline.length > 0 ||
      result.product_structure.format.length > 0 ||
      result.stage_plan.length > 0 ||
      result.offer_architecture.core_offer.length > 0;

    return hasContent ? result : null;
  } catch {
    console.error("[planner/parse] Failed to parse JSON from provider response");
    return null;
  }
}
