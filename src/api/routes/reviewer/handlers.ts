/**
 * Reviewer AI & Partial Regeneration route handlers.
 *
 * Provides endpoints for:
 *   - Running the Reviewer AI on a product's outputs
 *   - Getting reviewer output for a product
 *   - Triggering partial regeneration of specific sections
 *   - Viewing regeneration history
 */

import { Env } from "../../../shared/types";
import {
  json,
  notFound,
  badRequest,
  serverError,
  generateId,
  parseJsonBody,
  validateFields,
} from "../../../shared/utils";
import {
  executeReviewer,
  createAiReviewFromResult,
} from "../../../services/reviewer";
import type { ReviewerInput } from "../../../services/reviewer";
import {
  executeRegeneration,
  listRegenerationHistory,
  REGENERATION_TARGETS,
} from "../../../services/regenerator";
import type { RegenerationTarget } from "../../../services/regenerator";

// ── Run Reviewer AI ───────────────────────────────────────

/**
 * POST /api/products/:id/review
 *
 * Runs the Reviewer AI on a product's generated outputs.
 * Gathers creation output, platform variants, social variants,
 * and marketing output, then sends them for AI review.
 */
export async function runReviewer(
  request: Request,
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    // 1. Fetch product
    const product = await env.DB.prepare(
      "SELECT * FROM products WHERE id = ?",
    )
      .bind(productId)
      .first();
    if (!product) return notFound(`Product not found: ${productId}`);

    // 2. Get domain name for prompt context
    const domain = await env.DB.prepare(
      "SELECT name FROM domains WHERE id = ?",
    )
      .bind(product.domain_id as string)
      .first();

    // 3. Get category name (optional)
    let categoryName: string | undefined;
    if (product.category_id) {
      const category = await env.DB.prepare(
        "SELECT name FROM categories WHERE id = ?",
      )
        .bind(product.category_id as string)
        .first();
      if (category) categoryName = category.name as string;
    }

    // 4. Gather all outputs for the current version
    const version = (product.current_version as number) || 1;

    // Creation output (latest for this product)
    const creationOutput = await env.DB.prepare(
      `SELECT output_json FROM workflow_step_outputs
       WHERE product_id = ? AND role_type = 'creator'
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(productId)
      .first();

    // Platform variants for current version
    const platformVariants = await env.DB.prepare(
      `SELECT pv.*, pl.name as platform_name
       FROM product_variants pv
       LEFT JOIN platforms pl ON pv.platform_id = pl.id
       WHERE pv.product_id = ? AND pv.version = ? AND pv.platform_id IS NOT NULL`,
    )
      .bind(productId, version)
      .all();

    // Social variants for current version
    const socialVariants = await env.DB.prepare(
      `SELECT pv.*, sc.name as social_channel_name
       FROM product_variants pv
       LEFT JOIN social_channels sc ON pv.social_channel_id = sc.id
       WHERE pv.product_id = ? AND pv.version = ? AND pv.social_channel_id IS NOT NULL`,
    )
      .bind(productId, version)
      .all();

    // Marketing output
    const marketingOutput = await env.DB.prepare(
      `SELECT output_json FROM workflow_step_outputs
       WHERE product_id = ? AND role_type = 'marketing'
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(productId)
      .first();

    // Parse optional body for revision notes
    const body = await parseJsonBody(request);
    const revisionNotes = (body?.revision_notes as string) || undefined;

    // 5. Build input and execute
    const input: ReviewerInput = {
      productIdea: product.idea as string,
      domain: (domain?.name as string) || (product.domain_id as string),
      category: categoryName,
      creationOutput: creationOutput?.output_json
        ? safeJsonParse(creationOutput.output_json as string)
        : undefined,
      platformVariants: platformVariants.results.length > 0
        ? platformVariants.results
        : undefined,
      socialVariants: socialVariants.results.length > 0
        ? socialVariants.results
        : undefined,
      marketingOutput: marketingOutput?.output_json
        ? safeJsonParse(marketingOutput.output_json as string)
        : undefined,
      platformNames: platformVariants.results
        .map((v) => v.platform_name as string)
        .filter(Boolean),
      socialChannelNames: socialVariants.results
        .map((v) => v.social_channel_name as string)
        .filter(Boolean),
      revisionNotes,
    };

    const result = await executeReviewer(env, input);

    if (!result.success) {
      return json(
        {
          error: result.error || "Reviewer AI failed to produce a result.",
          providerLog: result.providerLog,
        },
        502,
      );
    }

    // 6. Create an AI review record linked to the product
    const reviewId = await createAiReviewFromResult(
      env,
      productId,
      version,
      result,
    );

    // 7. Save as workflow step output
    const outputId = generateId("wso_");
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO workflow_step_outputs
         (id, step_id, run_id, product_id, role_type, output_json, provider_log_json, created_at)
       VALUES (?, ?, ?, ?, 'reviewer', ?, ?, ?)`,
    )
      .bind(
        outputId,
        "direct_review",
        "direct_review",
        productId,
        JSON.stringify(result.review),
        JSON.stringify(result.providerLog),
        now,
      )
      .run();

    return json(
      {
        data: {
          review: result.review,
          review_id: reviewId,
          output_id: outputId,
          provider: result.provider,
          model: result.model,
          template_id: result.templateId,
          template_version: result.templateVersion,
        },
        message: `Reviewer AI completed for product ${productId}. Verdict: ${result.review?.verdict}.`,
      },
      201,
    );
  } catch (err) {
    console.error("[reviewer/run]", err);
    return serverError("Failed to run Reviewer AI.");
  }
}

// ── Get Reviewer Output ────────────────────────────────────

/**
 * GET /api/products/:id/review-output
 *
 * Returns the latest reviewer output for a product.
 */
export async function getReviewerOutput(
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    const product = await env.DB.prepare(
      "SELECT id FROM products WHERE id = ?",
    )
      .bind(productId)
      .first();
    if (!product) return notFound(`Product not found: ${productId}`);

    const output = await env.DB.prepare(
      `SELECT * FROM workflow_step_outputs
       WHERE product_id = ? AND role_type = 'reviewer'
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(productId)
      .first();

    if (!output) {
      return notFound(`No reviewer output found for product: ${productId}`);
    }

    return json({
      data: {
        id: output.id,
        product_id: productId,
        review: safeJsonParse(output.output_json as string),
        provider_log: safeJsonParse(output.provider_log_json as string),
        created_at: output.created_at,
      },
    });
  } catch (err) {
    console.error("[reviewer/get-output]", err);
    return serverError("Failed to get reviewer output.");
  }
}

// ── Trigger Partial Regeneration ──────────────────────────

/**
 * POST /api/products/:id/regenerate
 *
 * Triggers partial regeneration for a specific section.
 * Only regenerates the requested part — does not rerun the full workflow.
 *
 * Body:
 * {
 *   "target": "title" | "price" | "description" | "platform_variant" | "social_variant" | "seo",
 *   "target_ref": "optional platform or channel ID",
 *   "boss_notes": "optional feedback guiding the regeneration",
 *   "review_id": "optional review that triggered this",
 *   "revision_id": "optional revision that triggered this"
 * }
 */
export async function triggerRegeneration(
  request: Request,
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    // 1. Fetch product
    const product = await env.DB.prepare(
      "SELECT * FROM products WHERE id = ?",
    )
      .bind(productId)
      .first();
    if (!product) return notFound(`Product not found: ${productId}`);

    // 2. Parse and validate body
    const body = await parseJsonBody(request);
    if (!body) return badRequest("Invalid or empty JSON body.");

    const errors = validateFields(body, [
      { field: "target", required: true, type: "string" },
    ]);
    if (errors.length > 0) return badRequest(errors.join(" "));

    const target = body.target as string;
    if (!REGENERATION_TARGETS.includes(target as RegenerationTarget)) {
      return badRequest(
        `Invalid target. Must be one of: ${REGENERATION_TARGETS.join(", ")}`,
      );
    }

    // 3. Get domain name
    const domain = await env.DB.prepare(
      "SELECT name FROM domains WHERE id = ?",
    )
      .bind(product.domain_id as string)
      .first();

    // 4. Get category name (optional)
    let categoryName: string | undefined;
    if (product.category_id) {
      const category = await env.DB.prepare(
        "SELECT name FROM categories WHERE id = ?",
      )
        .bind(product.category_id as string)
        .first();
      if (category) categoryName = category.name as string;
    }

    const version = (product.current_version as number) || 1;
    const targetRef = (body.target_ref as string) || undefined;

    // 5. Get the previous value for history
    const previousValue = await getPreviousValue(
      env,
      productId,
      version,
      target as RegenerationTarget,
      targetRef,
    );

    // 6. Get prior context (creation output)
    const creationOutput = await env.DB.prepare(
      `SELECT output_json FROM workflow_step_outputs
       WHERE product_id = ? AND role_type = 'creator'
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(productId)
      .first();

    // 7. Execute regeneration
    const result = await executeRegeneration(env, {
      target: target as RegenerationTarget,
      productId,
      version,
      productIdea: product.idea as string,
      domain: (domain?.name as string) || (product.domain_id as string),
      category: categoryName,
      targetRef,
      previousValue,
      bossNotes: (body.boss_notes as string) || undefined,
      reviewId: (body.review_id as string) || undefined,
      revisionId: (body.revision_id as string) || undefined,
      priorContext: creationOutput?.output_json
        ? safeJsonParse(creationOutput.output_json as string)
        : undefined,
    });

    if (!result.success) {
      return json(
        {
          error: result.error || "Regeneration failed.",
          providerLog: result.providerLog,
        },
        502,
      );
    }

    // 8. Apply the regenerated content to the product/variant
    await applyRegeneration(
      env,
      productId,
      version,
      target as RegenerationTarget,
      targetRef,
      result.content,
    );

    return json(
      {
        data: {
          target,
          target_ref: targetRef || null,
          regenerated_content: result.content,
          history_id: result.historyId,
          provider: result.provider,
          model: result.model,
          previous_value: previousValue,
        },
        message: `Successfully regenerated ${target} for product ${productId}.`,
      },
      200,
    );
  } catch (err) {
    console.error("[reviewer/regenerate]", err);
    return serverError("Failed to trigger regeneration.");
  }
}

// ── List Regeneration History ─────────────────────────────

/**
 * GET /api/products/:id/regeneration-history
 *
 * Returns the regeneration history for a product.
 */
export async function getRegenerationHistory(
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    const product = await env.DB.prepare(
      "SELECT id FROM products WHERE id = ?",
    )
      .bind(productId)
      .first();
    if (!product) return notFound(`Product not found: ${productId}`);

    const history = await listRegenerationHistory(env, productId);

    return json({ data: history, total: history.length });
  } catch (err) {
    console.error("[reviewer/regen-history]", err);
    return serverError("Failed to get regeneration history.");
  }
}

// ── Internal helpers ────────────────────────────────────────

function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * Get the current value of the section being regenerated (for history).
 */
async function getPreviousValue(
  env: Env,
  productId: string,
  version: number,
  target: RegenerationTarget,
  targetRef?: string,
): Promise<unknown> {
  switch (target) {
    case "title": {
      const variant = await env.DB.prepare(
        `SELECT title FROM product_variants
         WHERE product_id = ? AND version = ? AND platform_id IS NULL AND social_channel_id IS NULL
         LIMIT 1`,
      )
        .bind(productId, version)
        .first();
      return variant?.title ?? null;
    }

    case "description": {
      const variant = await env.DB.prepare(
        `SELECT description FROM product_variants
         WHERE product_id = ? AND version = ? AND platform_id IS NULL AND social_channel_id IS NULL
         LIMIT 1`,
      )
        .bind(productId, version)
        .first();
      return variant?.description ?? null;
    }

    case "price": {
      const variant = await env.DB.prepare(
        `SELECT price_suggestion FROM product_variants
         WHERE product_id = ? AND version = ? AND platform_id IS NULL AND social_channel_id IS NULL
         LIMIT 1`,
      )
        .bind(productId, version)
        .first();
      return variant?.price_suggestion ?? null;
    }

    case "seo": {
      const variant = await env.DB.prepare(
        `SELECT seo_json FROM product_variants
         WHERE product_id = ? AND version = ? AND platform_id IS NULL AND social_channel_id IS NULL
         LIMIT 1`,
      )
        .bind(productId, version)
        .first();
      return variant?.seo_json ? safeJsonParse(variant.seo_json as string) : null;
    }

    case "platform_variant": {
      if (!targetRef) return null;
      const variant = await env.DB.prepare(
        `SELECT * FROM product_variants
         WHERE product_id = ? AND version = ? AND platform_id = ?
         LIMIT 1`,
      )
        .bind(productId, version, targetRef)
        .first();
      return variant ?? null;
    }

    case "social_variant": {
      if (!targetRef) return null;
      const variant = await env.DB.prepare(
        `SELECT * FROM product_variants
         WHERE product_id = ? AND version = ? AND social_channel_id = ?
         LIMIT 1`,
      )
        .bind(productId, version, targetRef)
        .first();
      return variant ?? null;
    }

    default:
      return null;
  }
}

/**
 * Apply regenerated content back to the product/variant in D1.
 */
async function applyRegeneration(
  env: Env,
  productId: string,
  version: number,
  target: RegenerationTarget,
  targetRef: string | undefined,
  content: unknown,
): Promise<void> {
  if (!content || typeof content !== "object") return;

  const now = new Date().toISOString();
  const data = content as Record<string, unknown>;

  switch (target) {
    case "title": {
      if (typeof data.title === "string") {
        await env.DB.prepare(
          `UPDATE product_variants SET title = ?, status = 'draft'
           WHERE product_id = ? AND version = ? AND platform_id IS NULL AND social_channel_id IS NULL`,
        )
          .bind(data.title, productId, version)
          .run();
      }
      break;
    }

    case "description": {
      if (typeof data.description === "string") {
        await env.DB.prepare(
          `UPDATE product_variants SET description = ?, status = 'draft'
           WHERE product_id = ? AND version = ? AND platform_id IS NULL AND social_channel_id IS NULL`,
        )
          .bind(data.description, productId, version)
          .run();
      }
      break;
    }

    case "price": {
      if (data.price_suggestion) {
        await env.DB.prepare(
          `UPDATE product_variants SET price_suggestion = ?, status = 'draft'
           WHERE product_id = ? AND version = ? AND platform_id IS NULL AND social_channel_id IS NULL`,
        )
          .bind(JSON.stringify(data.price_suggestion), productId, version)
          .run();
      }
      break;
    }

    case "seo": {
      if (data.seo) {
        await env.DB.prepare(
          `UPDATE product_variants SET seo_json = ?, status = 'draft'
           WHERE product_id = ? AND version = ? AND platform_id IS NULL AND social_channel_id IS NULL`,
        )
          .bind(JSON.stringify(data.seo), productId, version)
          .run();
      }
      break;
    }

    case "platform_variant": {
      if (targetRef) {
        const updates: string[] = [];
        const binds: unknown[] = [];

        if (typeof data.title === "string") {
          updates.push("title = ?");
          binds.push(data.title);
        }
        if (typeof data.description === "string") {
          updates.push("description = ?");
          binds.push(data.description);
        }
        if (data.seo_json || data.seo) {
          updates.push("seo_json = ?");
          binds.push(JSON.stringify(data.seo_json || data.seo));
        }
        if (Array.isArray(data.tags)) {
          updates.push("content_json = ?");
          binds.push(JSON.stringify({ tags: data.tags }));
        }

        if (updates.length > 0) {
          updates.push("status = 'draft'");
          binds.push(productId, version, targetRef);
          await env.DB.prepare(
            `UPDATE product_variants SET ${updates.join(", ")}
             WHERE product_id = ? AND version = ? AND platform_id = ?`,
          )
            .bind(...binds)
            .run();
        }
      }
      break;
    }

    case "social_variant": {
      if (targetRef) {
        const contentJson = JSON.stringify(data);
        await env.DB.prepare(
          `UPDATE product_variants SET content_json = ?, status = 'draft'
           WHERE product_id = ? AND version = ? AND social_channel_id = ?`,
        )
          .bind(contentJson, productId, version, targetRef)
          .run();
      }
      break;
    }
  }

  // Update product's updated_at
  await env.DB.prepare(
    "UPDATE products SET updated_at = ? WHERE id = ?",
  )
    .bind(now, productId)
    .run();
}
