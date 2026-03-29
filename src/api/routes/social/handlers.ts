/**
 * Social AI — API route handlers.
 *
 * POST /api/products/:id/social          — run social AI for a product
 * GET  /api/products/:id/social-variants — get social variants for a product
 * GET  /api/social-variants/:variantId   — get specific social variant by ID
 */

import type { Env } from "../../../shared/types";
import {
  json,
  notFound,
  badRequest,
  serverError,
  parseJsonBody,
  generateId,
} from "../../../shared/utils";
import {
  executeSocial,
  saveSocialVariants,
  logProviderPath,
} from "../../../services";
import type { SocialInput } from "../../../services";

// ── Run Social ──────────────────────────────────────────────

/**
 * POST /api/products/:productId/social
 *
 * Executes the Social AI step for a product.
 *
 * Required body fields:
 * - social_channel_ids: string[] — social channel IDs to create variants for
 *
 * Optional body fields:
 * - run_id: string — workflow run ID
 * - step_id: string — workflow step ID
 * - version: number — product version (defaults to 1)
 */
export async function runSocial(
  request: Request,
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    // 1. Load product
    const product = await env.DB.prepare(
      "SELECT * FROM products WHERE id = ?",
    )
      .bind(productId)
      .first();

    if (!product) return notFound(`Product not found: ${productId}`);

    // Load domain
    const domain = await env.DB.prepare(
      "SELECT * FROM domains WHERE id = ?",
    )
      .bind(product.domain_id as string)
      .first();

    if (!domain) return badRequest("Product domain not found.");

    // Load category (optional)
    let categoryName: string | undefined;
    if (product.category_id) {
      const category = await env.DB.prepare(
        "SELECT name FROM categories WHERE id = ?",
      )
        .bind(product.category_id as string)
        .first();
      if (category) {
        categoryName = category.name as string;
      }
    }

    // 2. Parse body
    const body = await parseJsonBody(request);
    if (!body || !Array.isArray(body.social_channel_ids) || body.social_channel_ids.length === 0) {
      return badRequest("social_channel_ids (string[]) is required and must not be empty.");
    }

    const socialChannelIds = body.social_channel_ids as string[];
    const version = typeof body.version === "number" ? body.version : 1;

    // 3. Load prior workflow outputs
    let creatorOutput: unknown = undefined;
    let researchContext: unknown = undefined;
    let marketingOutput: unknown = undefined;

    const creatorRow = await env.DB.prepare(
      `SELECT output_json FROM workflow_step_outputs
       WHERE product_id = ? AND role_type = 'creator'
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(productId)
      .first();
    if (creatorRow) {
      try { creatorOutput = JSON.parse(creatorRow.output_json as string); } catch { /* skip */ }
    }

    const researchRow = await env.DB.prepare(
      `SELECT output_json FROM workflow_step_outputs
       WHERE product_id = ? AND role_type = 'researcher'
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(productId)
      .first();
    if (researchRow) {
      try { researchContext = JSON.parse(researchRow.output_json as string); } catch { /* skip */ }
    }

    const marketingRow = await env.DB.prepare(
      `SELECT output_json FROM workflow_step_outputs
       WHERE product_id = ? AND role_type = 'marketing'
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(productId)
      .first();
    if (marketingRow) {
      try { marketingOutput = JSON.parse(marketingRow.output_json as string); } catch { /* skip */ }
    }

    // 4. Build input
    const input: SocialInput = {
      productIdea: product.idea as string,
      domain: domain.name as string,
      category: categoryName,
      creatorOutput,
      researchContext,
      marketingOutput,
      socialChannelIds,
      version,
    };

    // 5. Execute
    const batchResult = await executeSocial(env, input);

    // 6. Save results
    const runId = (body.run_id as string) || null;
    const stepId = (body.step_id as string) || null;
    let outputId: string | null = null;

    if (runId && stepId) {
      const step = await env.DB.prepare(
        "SELECT id FROM workflow_steps WHERE id = ? AND run_id = ?",
      )
        .bind(stepId, runId)
        .first();

      if (step) {
        outputId = await saveSocialVariants(env, stepId, runId, productId, version, batchResult);

        const allAttempts = batchResult.results.flatMap((r) => r.providerLog);
        await logProviderPath(env, runId, stepId, allAttempts);

        const now = new Date().toISOString();
        if (batchResult.succeeded > 0) {
          await env.DB.prepare(
            `UPDATE workflow_steps SET status = 'completed', finished_at = ? WHERE id = ?`,
          ).bind(now, stepId).run();
        } else {
          await env.DB.prepare(
            `UPDATE workflow_steps SET status = 'failed', error_log = ?, finished_at = ? WHERE id = ?`,
          ).bind(`All ${batchResult.failed} social generations failed`, now, stepId).run();
        }
      }
    } else if (batchResult.succeeded > 0) {
      outputId = await saveSocialVariants(env, "standalone", "standalone", productId, version, batchResult);
    }

    const status = batchResult.succeeded > 0 ? 200 : 422;
    return json(
      {
        data: {
          success: batchResult.succeeded > 0,
          output_id: outputId,
          total: batchResult.total,
          succeeded: batchResult.succeeded,
          failed: batchResult.failed,
          variants: batchResult.results.map((r) => ({
            success: r.success,
            variant: r.variant,
            provider: r.provider,
            model: r.model,
            error: r.error,
          })),
        },
        message: batchResult.succeeded > 0
          ? `Social content generated: ${batchResult.succeeded}/${batchResult.total} succeeded.`
          : "All social content generations failed.",
      },
      status,
    );
  } catch (err) {
    console.error("[social/run]", err);
    return serverError("Failed to execute social AI.");
  }
}

// ── Get Social Variants ─────────────────────────────────────

/**
 * GET /api/products/:productId/social-variants
 */
export async function getProductSocialVariants(
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    const product = await env.DB.prepare(
      "SELECT id FROM products WHERE id = ?",
    ).bind(productId).first();

    if (!product) return notFound(`Product not found: ${productId}`);

    const result = await env.DB.prepare(
      `SELECT * FROM product_variants
       WHERE product_id = ? AND variant_type = 'social'
       ORDER BY created_at DESC`,
    ).bind(productId).all();

    const data = result.results.map((row) => {
      let contentJson = null;
      try { contentJson = JSON.parse(row.content_json as string); } catch { /* keep null */ }
      return { ...row, content_json: contentJson };
    });

    return json({ data, total: data.length });
  } catch (err) {
    console.error("[social/get-variants]", err);
    return serverError("Failed to get social variants.");
  }
}

// ── Get Social Variant by ID ────────────────────────────────

/**
 * GET /api/social-variants/:variantId
 */
export async function getSocialVariantById(
  env: Env,
  variantId: string,
): Promise<Response> {
  try {
    const row = await env.DB.prepare(
      "SELECT * FROM product_variants WHERE id = ? AND variant_type = 'social'",
    ).bind(variantId).first();

    if (!row) return notFound(`Social variant not found: ${variantId}`);

    let contentJson = null;
    try { contentJson = JSON.parse(row.content_json as string); } catch { /* keep null */ }

    return json({ data: { ...row, content_json: contentJson } });
  } catch (err) {
    console.error("[social/get-variant]", err);
    return serverError("Failed to get social variant.");
  }
}
