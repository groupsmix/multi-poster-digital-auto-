/**
 * Creator AI — API route handlers.
 *
 * POST /api/products/:id/create    — run creator for a product
 * GET  /api/products/:id/creation  — get latest creation result
 * GET  /api/creations/:outputId    — get specific creation output by ID
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
  executeCreator,
  saveCreatorOutput,
  logProviderPath,
} from "../../../services";
import type { CreatorInput } from "../../../services";

// ── Run Creator ─────────────────────────────────────────────

/**
 * POST /api/products/:productId/create
 *
 * Executes the Creator AI step for a product.
 *
 * Optional body fields:
 * - notes: string — additional notes
 * - run_id: string — existing workflow run ID to attach to
 * - step_id: string — existing workflow step ID to update
 */
export async function runCreator(
  request: Request,
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    // 1. Load product with domain and category info
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

    // 2. Parse optional body
    const body = await parseJsonBody(request);

    // 3. Load prior workflow outputs as context
    let researchContext: unknown = undefined;
    let planContext: unknown = undefined;

    // Load latest research output
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

    // Load latest planner output
    const planRow = await env.DB.prepare(
      `SELECT output_json FROM workflow_step_outputs
       WHERE product_id = ? AND role_type = 'planner'
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(productId)
      .first();
    if (planRow) {
      try { planContext = JSON.parse(planRow.output_json as string); } catch { /* skip */ }
    }

    // 4. Build creator input
    const input: CreatorInput = {
      productIdea: product.idea as string,
      domain: domain.name as string,
      category: categoryName,
      researchContext,
      planContext,
      notes: (body?.notes as string) || (product.notes as string) || undefined,
    };

    // 5. Execute creator
    const result = await executeCreator(env, input);

    // 6. Determine workflow context
    const runId = (body?.run_id as string) || null;
    const stepId = (body?.step_id as string) || null;

    let outputId: string | null = null;

    // 7. Save output if workflow context is provided
    if (runId && stepId) {
      const step = await env.DB.prepare(
        "SELECT id FROM workflow_steps WHERE id = ? AND run_id = ?",
      )
        .bind(stepId, runId)
        .first();

      if (step) {
        outputId = await saveCreatorOutput(env, stepId, runId, productId, result);
        await logProviderPath(env, runId, stepId, result.providerLog);

        const now = new Date().toISOString();
        if (result.success) {
          await env.DB.prepare(
            `UPDATE workflow_steps SET
              status = 'completed', provider_used = ?, model_used = ?, finished_at = ?
             WHERE id = ?`,
          )
            .bind(result.provider, result.model, now, stepId)
            .run();
        } else {
          await env.DB.prepare(
            `UPDATE workflow_steps SET
              status = 'failed', error_log = ?, finished_at = ?
             WHERE id = ?`,
          )
            .bind(result.error, now, stepId)
            .run();
        }
      }
    } else if (result.success && result.creation) {
      const standaloneOutputId = generateId("wso_");
      const now = new Date().toISOString();

      await env.DB.prepare(
        `INSERT INTO workflow_step_outputs
           (id, step_id, run_id, product_id, role_type, output_json, provider_log_json, created_at)
         VALUES (?, ?, ?, ?, 'creator', ?, ?, ?)`,
      )
        .bind(
          standaloneOutputId, "standalone", "standalone", productId,
          JSON.stringify(result.creation), JSON.stringify(result.providerLog), now,
        )
        .run();

      outputId = standaloneOutputId;
    }

    // 8. Build response
    const status = result.success ? 200 : 422;
    return json(
      {
        data: {
          success: result.success,
          output_id: outputId,
          creation: result.creation,
          provider: result.provider,
          model: result.model,
          template_id: result.templateId,
          template_version: result.templateVersion,
          provider_log: result.providerLog,
          error: result.error,
        },
        message: result.success
          ? "Creation completed successfully."
          : `Creation failed: ${result.error}`,
      },
      status,
    );
  } catch (err) {
    console.error("[creator/run]", err);
    return serverError("Failed to execute creator.");
  }
}

// ── Get Latest Creation ─────────────────────────────────────

/**
 * GET /api/products/:productId/creation
 */
export async function getProductCreation(
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
       WHERE product_id = ? AND role_type = 'creator'
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(productId)
      .first();

    if (!output) {
      return notFound(`No creation output found for product: ${productId}`);
    }

    let creation = null;
    let providerLog = null;
    try { creation = JSON.parse(output.output_json as string); } catch { /* keep null */ }
    try { providerLog = JSON.parse(output.provider_log_json as string); } catch { /* keep null */ }

    return json({
      data: {
        id: output.id,
        step_id: output.step_id,
        run_id: output.run_id,
        product_id: output.product_id,
        creation,
        provider_log: providerLog,
        created_at: output.created_at,
      },
    });
  } catch (err) {
    console.error("[creator/get-product]", err);
    return serverError("Failed to get creation output.");
  }
}

// ── Get Creation Output by ID ───────────────────────────────

/**
 * GET /api/creations/:outputId
 */
export async function getCreationOutput(
  env: Env,
  outputId: string,
): Promise<Response> {
  try {
    const output = await env.DB.prepare(
      "SELECT * FROM workflow_step_outputs WHERE id = ? AND role_type = 'creator'",
    )
      .bind(outputId)
      .first();

    if (!output) return notFound(`Creation output not found: ${outputId}`);

    let creation = null;
    let providerLog = null;
    try { creation = JSON.parse(output.output_json as string); } catch { /* keep null */ }
    try { providerLog = JSON.parse(output.provider_log_json as string); } catch { /* keep null */ }

    return json({
      data: {
        id: output.id,
        step_id: output.step_id,
        run_id: output.run_id,
        product_id: output.product_id,
        creation,
        provider_log: providerLog,
        created_at: output.created_at,
      },
    });
  } catch (err) {
    console.error("[creator/get-output]", err);
    return serverError("Failed to get creation output.");
  }
}
