/**
 * Reviewer AI Service — orchestrates the review workflow step.
 *
 * Takes all generated outputs for a product (creation, platform variants,
 * social variants, marketing), composes the reviewer prompt via Prompt Studio,
 * calls the provider chain using free-first routing (review lane),
 * and returns a structured review result with pass/fail/issues.
 *
 * Per architecture §8.7 and §10.6, the reviewer should use a different
 * provider from the generator whenever possible.
 */

import type { Env } from "../shared/types";
import type { TaskLane } from "../config";
import { generateId } from "../shared/utils";
import { executeWithRouting } from "../providers";
import type { RoutingAttempt } from "../providers";
import { composePrompt } from "./prompt-composer";

// ── Review result schema ──────────────────────────────────

/** A single issue found during review. */
export interface ReviewIssue {
  section: ReviewSection;
  severity: "critical" | "major" | "minor" | "suggestion";
  issue: string;
  suggestion: string;
}

/** Sections that can be reviewed / regenerated. */
export type ReviewSection =
  | "title"
  | "description"
  | "price"
  | "platform_variant"
  | "social_variant"
  | "seo"
  | "tags"
  | "content_body"
  | "general";

/** Structured review output matching architecture §8.7. */
export interface ReviewerResult {
  verdict: "pass" | "fail" | "needs_revision";
  score: number;
  issues: ReviewIssue[];
  strengths: string[];
  summary: string;
}

// ── Review input ──────────────────────────────────────────

export interface ReviewerInput {
  /** The product/service idea. */
  productIdea: string;
  /** Domain name or slug. */
  domain: string;
  /** Category name or slug (optional). */
  category?: string;
  /** The creation output to review (title, description, content). */
  creationOutput?: unknown;
  /** Platform variant outputs to review. */
  platformVariants?: unknown[];
  /** Social variant outputs to review. */
  socialVariants?: unknown[];
  /** Marketing output to review. */
  marketingOutput?: unknown;
  /** Platform names for context. */
  platformNames?: string[];
  /** Social channel names for context. */
  socialChannelNames?: string[];
  /** Boss notes / feedback from prior revision (optional). */
  revisionNotes?: string;
}

// ── Review execution result ───────────────────────────────

export interface ReviewerExecutionResult {
  success: boolean;
  /** The structured review data (null on failure). */
  review: ReviewerResult | null;
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

const REVIEWER_OUTPUT_SCHEMA = `Return your review as a JSON object with exactly this structure:
{
  "verdict": "pass | fail | needs_revision",
  "score": 0-100,
  "issues": [
    {
      "section": "title | description | price | platform_variant | social_variant | seo | tags | content_body | general",
      "severity": "critical | major | minor | suggestion",
      "issue": "description of the problem",
      "suggestion": "how to fix it"
    }
  ],
  "strengths": ["what was done well"],
  "summary": "one-paragraph overall assessment"
}

Return ONLY the JSON object. No markdown fences, no commentary.`;

// ── Default reviewer role prompt (fallback) ──────────────

const DEFAULT_REVIEWER_PROMPT = `You are the Reviewer in the NEXUS workflow.
Review the generated outputs for quality, completeness, platform fit, SEO strength,
natural tone, price logic, consistency, and policy/risk issues.
Be honest, specific, and commercially minded.
A single critical issue = automatic fail.
Two or more major issues = fail.`;

// ── Main execution function ────────────────────────────────

/**
 * Execute the Reviewer AI workflow step.
 *
 * 1. Compose the reviewer prompt from Prompt Studio templates
 * 2. Build the user prompt with all generated outputs
 * 3. Call the provider chain (review lane, free-first)
 * 4. Parse the structured response
 * 5. Return the result with provider log
 */
export async function executeReviewer(
  env: Env,
  input: ReviewerInput,
): Promise<ReviewerExecutionResult> {
  const lane: TaskLane = "review";

  try {
    // 1. Compose prompt from Prompt Studio
    const composed = await composePrompt(env, {
      role: "reviewer",
      domainRef: input.domain,
      categoryRef: input.category,
    });

    // 2. Build the system prompt with output schema
    const systemPrompt = [
      composed.systemPrompt,
      DEFAULT_REVIEWER_PROMPT,
      composed.outputSchema ?? REVIEWER_OUTPUT_SCHEMA,
    ]
      .filter(Boolean)
      .join("\n\n---\n\n");

    // 3. Build the user prompt with all generated outputs
    const userPrompt = buildUserPrompt(input);

    // 4. Execute via provider chain (free-first routing, review lane)
    const routingResult = await executeWithRouting(env, lane, {
      lane,
      systemPrompt,
      prompt: userPrompt,
      maxTokens: 2000,
      temperature: 0.3,
    });

    if (!routingResult.success || !routingResult.response) {
      return {
        success: false,
        review: null,
        rawContent: null,
        providerLog: routingResult.attempts,
        provider: null,
        model: null,
        templateId: composed.templateId,
        templateVersion: composed.templateVersion,
        error: "All providers exhausted. No review result produced.",
      };
    }

    const { response } = routingResult;

    // 5. Parse structured response
    const review = parseReviewerResponse(response.content);

    return {
      success: review !== null,
      review,
      rawContent: response.content,
      providerLog: routingResult.attempts,
      provider: response.provider,
      model: response.model,
      templateId: composed.templateId,
      templateVersion: composed.templateVersion,
      error: review === null
        ? "Failed to parse structured review from provider response."
        : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[reviewer/execute]", message);
    return {
      success: false,
      review: null,
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
 * Save reviewer result to D1 as a workflow step output.
 */
export async function saveReviewerOutput(
  env: Env,
  stepId: string,
  runId: string,
  productId: string,
  result: ReviewerExecutionResult,
): Promise<string> {
  const outputId = generateId("wso_");
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO workflow_step_outputs
       (id, step_id, run_id, product_id, role_type, output_json, provider_log_json, created_at)
     VALUES (?, ?, ?, ?, 'reviewer', ?, ?, ?)`,
  )
    .bind(
      outputId,
      stepId,
      runId,
      productId,
      JSON.stringify(result.review),
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
 * Create a review record from the Reviewer AI result.
 *
 * Bridges the reviewer service output to the reviews table,
 * linking AI review results with the Boss approval loop.
 */
export async function createAiReviewFromResult(
  env: Env,
  productId: string,
  version: number,
  result: ReviewerExecutionResult,
): Promise<string> {
  const reviewId = generateId("rev_");
  const now = new Date().toISOString();

  const approvalStatus = result.review
    ? result.review.verdict === "pass"
      ? "approved"
      : "revision_requested"
    : "revision_requested";

  const issuesFound = result.review?.issues
    ? JSON.stringify(result.review.issues)
    : null;

  const feedback = result.review?.summary ?? null;

  await env.DB.prepare(
    `INSERT INTO reviews
      (id, product_id, version, reviewer_type, approval_status,
       issues_found, feedback, created_at, updated_at)
     VALUES (?, ?, ?, 'ai', ?, ?, ?, ?, ?)`,
  )
    .bind(
      reviewId,
      productId,
      version,
      approvalStatus,
      issuesFound,
      feedback,
      now,
      now,
    )
    .run();

  // If there are issues, store them as review comments for audit trail
  if (result.review?.issues && result.review.issues.length > 0) {
    const commentId = generateId("rc_");
    const commentText = result.review.issues
      .map(
        (i) =>
          `[${i.severity.toUpperCase()}] ${i.section}: ${i.issue}\n  → ${i.suggestion}`,
      )
      .join("\n\n");

    await env.DB.prepare(
      `INSERT INTO review_comments (id, review_id, author_type, comment, created_at)
       VALUES (?, ?, 'ai', ?, ?)`,
    )
      .bind(commentId, reviewId, commentText, now)
      .run();
  }

  // Update product status
  if (approvalStatus === "approved") {
    // AI approved → waiting for Boss review
    await env.DB.prepare(
      "UPDATE products SET status = 'waiting_for_review', updated_at = ? WHERE id = ?",
    )
      .bind(now, productId)
      .run();
  } else {
    // AI found issues → mark revision_requested
    await env.DB.prepare(
      "UPDATE products SET status = 'revision_requested', updated_at = ? WHERE id = ?",
    )
      .bind(now, productId)
      .run();
  }

  return reviewId;
}

// ── Internal helpers ────────────────────────────────────────

function buildUserPrompt(input: ReviewerInput): string {
  const parts = [
    `Product Idea: ${input.productIdea}`,
    `Domain: ${input.domain}`,
  ];

  if (input.category) {
    parts.push(`Category: ${input.category}`);
  }

  if (input.platformNames && input.platformNames.length > 0) {
    parts.push(`Target Platforms: ${input.platformNames.join(", ")}`);
  }

  if (input.socialChannelNames && input.socialChannelNames.length > 0) {
    parts.push(`Social Channels: ${input.socialChannelNames.join(", ")}`);
  }

  // Include creation output
  if (input.creationOutput) {
    parts.push(
      "",
      "--- CREATION OUTPUT (from Creator AI) ---",
      typeof input.creationOutput === "string"
        ? input.creationOutput
        : JSON.stringify(input.creationOutput, null, 2),
    );
  }

  // Include platform variants
  if (input.platformVariants && input.platformVariants.length > 0) {
    parts.push(
      "",
      "--- PLATFORM VARIANTS (from Platform Adapter AI) ---",
      JSON.stringify(input.platformVariants, null, 2),
    );
  }

  // Include social variants
  if (input.socialVariants && input.socialVariants.length > 0) {
    parts.push(
      "",
      "--- SOCIAL VARIANTS (from Social AI) ---",
      JSON.stringify(input.socialVariants, null, 2),
    );
  }

  // Include marketing output
  if (input.marketingOutput) {
    parts.push(
      "",
      "--- MARKETING OUTPUT (from Marketing AI) ---",
      typeof input.marketingOutput === "string"
        ? input.marketingOutput
        : JSON.stringify(input.marketingOutput, null, 2),
    );
  }

  // Include revision notes if re-reviewing
  if (input.revisionNotes) {
    parts.push(
      "",
      "--- REVISION NOTES (from Boss) ---",
      input.revisionNotes,
    );
  }

  parts.push(
    "",
    "Review ALL the outputs above for quality, completeness, platform fit, SEO strength, natural tone, price logic, consistency, and policy/risk issues.",
    "Return your review as structured JSON matching the output schema.",
  );

  return parts.join("\n");
}

/**
 * Parse the provider response into a structured ReviewerResult.
 */
function parseReviewerResponse(content: string): ReviewerResult | null {
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);

    // Validate verdict
    const validVerdicts = ["pass", "fail", "needs_revision"];
    const verdict = validVerdicts.includes(parsed.verdict)
      ? (parsed.verdict as ReviewerResult["verdict"])
      : "needs_revision";

    // Validate score
    const score = typeof parsed.score === "number"
      ? Math.max(0, Math.min(100, parsed.score))
      : 0;

    // Validate issues
    const issues: ReviewIssue[] = Array.isArray(parsed.issues)
      ? parsed.issues.map((i: Record<string, unknown>) => ({
          section: typeof i.section === "string" ? i.section : "general",
          severity: typeof i.severity === "string" ? i.severity : "minor",
          issue: typeof i.issue === "string" ? i.issue : "",
          suggestion: typeof i.suggestion === "string" ? i.suggestion : "",
        }))
      : [];

    const result: ReviewerResult = {
      verdict,
      score,
      issues,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    };

    // Must have at least a verdict and summary
    return result.summary.length > 0 ? result : null;
  } catch {
    console.error("[reviewer/parse] Failed to parse JSON from provider response");
    return null;
  }
}
