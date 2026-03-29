/**
 * Creator AI Service — orchestrates the creation workflow step.
 *
 * Takes prior workflow outputs (research + plan) as context,
 * composes the creator prompt via Prompt Studio templates,
 * calls the provider chain using free-first routing (build lane),
 * and returns a structured creation result.
 */

import type { Env } from "../shared/types";
import type { TaskLane } from "../config";
import { generateId } from "../shared/utils";
import { executeWithRouting } from "../providers";
import type { RoutingAttempt } from "../providers";
import { composePrompt } from "./prompt-composer";

// ── Creation result schema ──────────────────────────────────

/** Structured creator output matching architecture §8.3. */
export interface CreatorResult {
  title: string;
  description: string;
  content_body: string;
  image_prompts: ImagePrompt[];
  tags: string[];
}

export interface ImagePrompt {
  prompt: string;
  style?: string;
  aspect_ratio?: string;
}

// ── Creator input ──────────────────────────────────────────

export interface CreatorInput {
  /** The product/service idea. */
  productIdea: string;
  /** Domain name or slug. */
  domain: string;
  /** Category name or slug (optional). */
  category?: string;
  /** Structured research output from the Researcher AI (optional). */
  researchContext?: unknown;
  /** Structured plan output from the Planner AI (optional). */
  planContext?: unknown;
  /** Additional notes from the user (optional). */
  notes?: string;
}

// ── Creator execution result ───────────────────────────────

export interface CreatorExecutionResult {
  success: boolean;
  /** The structured creation data (null on failure). */
  creation: CreatorResult | null;
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

const CREATOR_OUTPUT_SCHEMA = `Return your creation as a JSON object with exactly this structure:
{
  "title": "string — compelling product title",
  "description": "string — detailed, benefit-driven description",
  "content_body": "string — the main deliverable content",
  "image_prompts": [
    { "prompt": "string", "style": "string (optional)", "aspect_ratio": "string (optional)" }
  ],
  "tags": ["string — relevant tags for discoverability"]
}

Return ONLY the JSON object. No markdown fences, no commentary.`;

// ── Default creator role prompt (fallback) ──────────────────

const DEFAULT_CREATOR_PROMPT = `You are the Creator in the NEXUS workflow.
Generate the main product output based on the research and plan context provided.
Create a compelling title, description, content body, image prompts, and tags.
Make the output commercially useful, specific, and ready for platform adaptation.`;

// ── Main execution function ────────────────────────────────

/**
 * Execute the Creator AI workflow step.
 *
 * 1. Compose the creator prompt from Prompt Studio templates
 * 2. Build the user prompt with product context + prior outputs
 * 3. Call the provider chain (build lane, free-first)
 * 4. Parse the structured response
 * 5. Return the result with provider log
 */
export async function executeCreator(
  env: Env,
  input: CreatorInput,
): Promise<CreatorExecutionResult> {
  const lane: TaskLane = "build";

  try {
    // 1. Compose prompt from Prompt Studio
    const composed = await composePrompt(env, {
      role: "creator",
      domainRef: input.domain,
      categoryRef: input.category,
    });

    // 2. Build the system prompt with output schema
    const systemPrompt = [
      composed.systemPrompt,
      DEFAULT_CREATOR_PROMPT,
      composed.outputSchema ?? CREATOR_OUTPUT_SCHEMA,
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
      temperature: 0.6,
    });

    if (!routingResult.success || !routingResult.response) {
      return {
        success: false,
        creation: null,
        rawContent: null,
        providerLog: routingResult.attempts,
        provider: null,
        model: null,
        templateId: composed.templateId,
        templateVersion: composed.templateVersion,
        error: "All providers exhausted. No creation result produced.",
      };
    }

    const { response } = routingResult;

    // 5. Parse structured response
    const creation = parseCreatorResponse(response.content);

    return {
      success: creation !== null,
      creation,
      rawContent: response.content,
      providerLog: routingResult.attempts,
      provider: response.provider,
      model: response.model,
      templateId: composed.templateId,
      templateVersion: composed.templateVersion,
      error: creation === null
        ? "Failed to parse structured creation from provider response."
        : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[creator/execute]", message);
    return {
      success: false,
      creation: null,
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
 * Save creator result to D1 as a workflow step output.
 */
export async function saveCreatorOutput(
  env: Env,
  stepId: string,
  runId: string,
  productId: string,
  result: CreatorExecutionResult,
): Promise<string> {
  const outputId = generateId("wso_");
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO workflow_step_outputs
       (id, step_id, run_id, product_id, role_type, output_json, provider_log_json, created_at)
     VALUES (?, ?, ?, ?, 'creator', ?, ?, ?)`,
  )
    .bind(
      outputId,
      stepId,
      runId,
      productId,
      JSON.stringify(result.creation),
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

function buildUserPrompt(input: CreatorInput): string {
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

  if (input.planContext) {
    parts.push(
      "",
      "--- PLAN CONTEXT (from Planner AI) ---",
      typeof input.planContext === "string"
        ? input.planContext
        : JSON.stringify(input.planContext, null, 2),
    );
  }

  parts.push(
    "",
    "Generate the main product output based on the above context.",
    "Return your creation as structured JSON matching the output schema.",
  );

  return parts.join("\n");
}

/**
 * Parse the provider response into a structured CreatorResult.
 */
function parseCreatorResponse(content: string): CreatorResult | null {
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);

    const result: CreatorResult = {
      title: typeof parsed.title === "string" ? parsed.title : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      content_body: typeof parsed.content_body === "string" ? parsed.content_body : "",
      image_prompts: Array.isArray(parsed.image_prompts) ? parsed.image_prompts : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };

    // Must have at least a title or content_body
    const hasContent = result.title.length > 0 || result.content_body.length > 0;
    return hasContent ? result : null;
  } catch {
    console.error("[creator/parse] Failed to parse JSON from provider response");
    return null;
  }
}
