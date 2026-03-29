/**
 * Platform Adapter AI — API route handlers.
 *
 * POST /api/products/:id/adapt       — run platform adapter for a product
 * GET  /api/products/:id/variants    — get platform variants for a product
 * GET  /api/variants/:variantId      — get specific variant by ID
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
  executePlatformAdapter,
  savePlatformVariants,
  logProviderPath,
} from "../../../services";
import type { PlatformAdapterInput } from "../../../services";

// ── Run Platform Adapter ────────────────────────────────────

/**
 * POST /api/products/:productId/adapt
 *
 * Executes the Platform Adapter AI step for a product.
 *
 * Required body fields:
 * - platform_ids: string[] — platform IDs to create variants for
 *
 * Optional body fields:
 * - run_id: string — workflow run ID
 * - step_id: string — workflow step ID
 * - version: number — product version (defaults to 1)
 */
export async function runPlatformAdapter(
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
    if (!body || !Array.isArray(body.platform_ids) || body.platform_ids.length === 0) {
      return badRequest("platform_ids (string[]) is required and must not be empty.");
    }

    const platformIds = body.platform_ids as string[];
    const version = typeof body.version === "number" ? body.version : 1;

    // 3. Load prior workflow outputs
    let creatorOutput: unknown = undefined;
    let researchContext: unknown = undefined;

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

    // 4. Build input
    const input: PlatformAdapterInput = {
      productIdea: product.idea as string,
      domain: domain.name as string,
      category: categoryName,
      creatorOutput,
      researchContext,
      platformIds,
      version,
    };

    // 5. Execute
    const batchResult = await executePlatformAdapter(env, input);

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
        outputId = await savePlatformVariants(env, stepId, runId, productId, version, batchResult);

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
          ).bind(`All ${batchResult.failed} platform adaptations failed`, now, stepId).run();
        }
      }
    } else if (batchResult.succeeded > 0) {
      outputId = await savePlatformVariants(env, "standalone", "standalone", productId, version, batchResult);
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
          ? `Platform adaptation completed: ${batchResult.succeeded}/${batchResult.total} succeeded.`
          : "All platform adaptations failed.",
      },
      status,
    );
  } catch (err) {
    console.error("[platform-adapter/run]", err);
    return serverError("Failed to execute platform adapter.");
  }
}

// ── Get Platform Variants ───────────────────────────────────

/**
 * GET /api/products/:productId/variants
 */
export async function getProductVariants(
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
       WHERE product_id = ? AND variant_type = 'platform'
       ORDER BY created_at DESC`,
    ).bind(productId).all();

    const data = result.results.map((row) => {
      let contentJson = null;
      try { contentJson = JSON.parse(row.content_json as string); } catch { /* keep null */ }
      return { ...row, content_json: contentJson };
    });

    return json({ data, total: data.length });
  } catch (err) {
    console.error("[platform-adapter/get-variants]", err);
    return serverError("Failed to get platform variants.");
  }
}

// ── Get Variant by ID ───────────────────────────────────────

/**
 * GET /api/variants/:variantId
 */
export async function getVariantById(
  env: Env,
  variantId: string,
): Promise<Response> {
  try {
    const row = await env.DB.prepare(
      "SELECT * FROM product_variants WHERE id = ?",
    ).bind(variantId).first();

    if (!row) return notFound(`Variant not found: ${variantId}`);

    let contentJson = null;
    try { contentJson = JSON.parse(row.content_json as string); } catch { /* keep null */ }

    return json({ data: { ...row, content_json: contentJson } });
  } catch (err) {
    console.error("[platform-adapter/get-variant]", err);
    return serverError("Failed to get variant.");
  }
}
