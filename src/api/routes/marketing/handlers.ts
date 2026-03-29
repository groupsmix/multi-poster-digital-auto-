/**
 * Marketing AI — API route handlers.
 *
 * POST /api/products/:id/marketing   — run marketing AI for a product
 * GET  /api/products/:id/marketing   — get latest marketing output
 * GET  /api/marketing/:outputId      — get specific marketing output by ID
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
  executeMarketing,
  saveMarketingOutput,
  logProviderPath,
} from "../../../services";
import type { MarketingInput } from "../../../services";

// ── Run Marketing ───────────────────────────────────────────

/**
 * POST /api/products/:productId/marketing
 *
 * Executes the Marketing AI step for a product.
 *
 * Optional body fields:
 * - run_id: string — workflow run ID
 * - step_id: string — workflow step ID
 * - version: number — product version (defaults to 1)
 */
export async function runMarketing(
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
    const version = typeof body?.version === "number" ? body.version : 1;

    // 3. Load prior workflow outputs
    let creatorOutput: unknown = undefined;
    let researchContext: unknown = undefined;
    let platformVariants: unknown = undefined;

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

    const adapterRow = await env.DB.prepare(
      `SELECT output_json FROM workflow_step_outputs
       WHERE product_id = ? AND role_type = 'adapter'
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(productId)
      .first();
    if (adapterRow) {
      try { platformVariants = JSON.parse(adapterRow.output_json as string); } catch { /* skip */ }
    }

    // 4. Build input
    const input: MarketingInput = {
      productIdea: product.idea as string,
      domain: domain.name as string,
      category: categoryName,
      creatorOutput,
      researchContext,
      platformVariants,
    };

    // 5. Execute
    const result = await executeMarketing(env, input);

    // 6. Save results
    const runId = (body?.run_id as string) || null;
    const stepId = (body?.step_id as string) || null;
    let outputId: string | null = null;

    if (runId && stepId) {
      const step = await env.DB.prepare(
        "SELECT id FROM workflow_steps WHERE id = ? AND run_id = ?",
      )
        .bind(stepId, runId)
        .first();

      if (step) {
        outputId = await saveMarketingOutput(env, stepId, runId, productId, result);
        await logProviderPath(env, runId, stepId, result.providerLog);

        const now = new Date().toISOString();
        if (result.success) {
          await env.DB.prepare(
            `UPDATE workflow_steps SET
              status = 'completed', provider_used = ?, model_used = ?, finished_at = ?
             WHERE id = ?`,
          ).bind(result.provider, result.model, now, stepId).run();
        } else {
          await env.DB.prepare(
            `UPDATE workflow_steps SET
              status = 'failed', error_log = ?, finished_at = ?
             WHERE id = ?`,
          ).bind(result.error, now, stepId).run();
        }
      }
    } else if (result.success && result.marketing) {
      const standaloneOutputId = generateId("wso_");
      const now = new Date().toISOString();

      await env.DB.prepare(
        `INSERT INTO workflow_step_outputs
           (id, step_id, run_id, product_id, role_type, output_json, provider_log_json, created_at)
         VALUES (?, ?, ?, ?, 'marketing', ?, ?, ?)`,
      )
        .bind(
          standaloneOutputId, "standalone", "standalone", productId,
          JSON.stringify(result.marketing), JSON.stringify(result.providerLog), now,
        )
        .run();

      outputId = standaloneOutputId;
    }

    const status = result.success ? 200 : 422;
    return json(
      {
        data: {
          success: result.success,
          output_id: outputId,
          marketing: result.marketing,
          provider: result.provider,
          model: result.model,
          template_id: result.templateId,
          template_version: result.templateVersion,
          provider_log: result.providerLog,
          error: result.error,
        },
        message: result.success
          ? "Marketing analysis completed successfully."
          : `Marketing analysis failed: ${result.error}`,
      },
      status,
    );
  } catch (err) {
    console.error("[marketing/run]", err);
    return serverError("Failed to execute marketing.");
  }
}

// ── Get Latest Marketing Output ─────────────────────────────

/**
 * GET /api/products/:productId/marketing
 */
export async function getProductMarketing(
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    const product = await env.DB.prepare(
      "SELECT id FROM products WHERE id = ?",
    ).bind(productId).first();

    if (!product) return notFound(`Product not found: ${productId}`);

    const output = await env.DB.prepare(
      `SELECT * FROM workflow_step_outputs
       WHERE product_id = ? AND role_type = 'marketing'
       ORDER BY created_at DESC LIMIT 1`,
    ).bind(productId).first();

    if (!output) {
      return notFound(`No marketing output found for product: ${productId}`);
    }

    let marketing = null;
    let providerLog = null;
    try { marketing = JSON.parse(output.output_json as string); } catch { /* keep null */ }
    try { providerLog = JSON.parse(output.provider_log_json as string); } catch { /* keep null */ }

    return json({
      data: {
        id: output.id,
        step_id: output.step_id,
        run_id: output.run_id,
        product_id: output.product_id,
        marketing,
        provider_log: providerLog,
        created_at: output.created_at,
      },
    });
  } catch (err) {
    console.error("[marketing/get-product]", err);
    return serverError("Failed to get marketing output.");
  }
}

// ── Get Marketing Output by ID ──────────────────────────────

/**
 * GET /api/marketing/:outputId
 */
export async function getMarketingOutput(
  env: Env,
  outputId: string,
): Promise<Response> {
  try {
    const output = await env.DB.prepare(
      "SELECT * FROM workflow_step_outputs WHERE id = ? AND role_type = 'marketing'",
    ).bind(outputId).first();

    if (!output) return notFound(`Marketing output not found: ${outputId}`);

    let marketing = null;
    let providerLog = null;
    try { marketing = JSON.parse(output.output_json as string); } catch { /* keep null */ }
    try { providerLog = JSON.parse(output.provider_log_json as string); } catch { /* keep null */ }

    return json({
      data: {
        id: output.id,
        step_id: output.step_id,
        run_id: output.run_id,
        product_id: output.product_id,
        marketing,
        provider_log: providerLog,
        created_at: output.created_at,
      },
    });
  } catch (err) {
    console.error("[marketing/get-output]", err);
    return serverError("Failed to get marketing output.");
  }
}
