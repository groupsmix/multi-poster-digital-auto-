/**
 * Researcher AI — API route handlers.
 *
 * POST /api/products/:id/research  — run researcher for a product
 * GET  /api/products/:id/research  — get latest research result
 * GET  /api/research/:outputId     — get specific research output by ID
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
  executeResearch,
  saveResearchOutput,
  logProviderPath,
} from "../../../services";
import type { ResearchInput } from "../../../services";

// ── Run Research ─────────────────────────────────────────────

/**
 * POST /api/products/:productId/research
 *
 * Executes the Researcher AI step for a product.
 *
 * Required context (resolved from product or request body):
 * - product idea (from products table)
 * - domain (from products → domains)
 * - category (optional, from products → categories)
 *
 * Optional body fields:
 * - platform_context: string — platform name for platform-specific research
 * - notes: string — additional notes for the researcher
 * - run_id: string — existing workflow run ID to attach to
 * - step_id: string — existing workflow step ID to update
 */
export async function runResearch(
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

    // 3. Build research input
    const input: ResearchInput = {
      productIdea: product.idea as string,
      domain: domain.name as string,
      category: categoryName,
      platformContext: (body?.platform_context as string) || undefined,
      notes: (body?.notes as string) || (product.notes as string) || undefined,
    };

    // 4. Execute research
    const result = await executeResearch(env, input);

    // 5. Determine workflow context
    const runId = (body?.run_id as string) || null;
    const stepId = (body?.step_id as string) || null;

    let outputId: string | null = null;

    // 6. Save output if workflow context is provided
    if (runId && stepId) {
      // Validate step exists
      const step = await env.DB.prepare(
        "SELECT id FROM workflow_steps WHERE id = ? AND run_id = ?",
      )
        .bind(stepId, runId)
        .first();

      if (step) {
        outputId = await saveResearchOutput(
          env,
          stepId,
          runId,
          productId,
          result,
        );

        // Log provider path
        await logProviderPath(env, runId, stepId, result.providerLog);

        // Update step status
        const now = new Date().toISOString();
        if (result.success) {
          await env.DB.prepare(
            `UPDATE workflow_steps SET
              status = 'completed',
              provider_used = ?,
              model_used = ?,
              finished_at = ?
             WHERE id = ?`,
          )
            .bind(result.provider, result.model, now, stepId)
            .run();
        } else {
          await env.DB.prepare(
            `UPDATE workflow_steps SET
              status = 'failed',
              error_log = ?,
              finished_at = ?
             WHERE id = ?`,
          )
            .bind(result.error, now, stepId)
            .run();
        }
      }
    } else if (result.success && result.research) {
      // No workflow context — save as standalone output with placeholder refs
      const standaloneOutputId = generateId("wso_");
      const now = new Date().toISOString();

      await env.DB.prepare(
        `INSERT INTO workflow_step_outputs
           (id, step_id, run_id, product_id, role_type, output_json, provider_log_json, created_at)
         VALUES (?, ?, ?, ?, 'researcher', ?, ?, ?)`,
      )
        .bind(
          standaloneOutputId,
          "standalone",
          "standalone",
          productId,
          JSON.stringify(result.research),
          JSON.stringify(result.providerLog),
          now,
        )
        .run();

      outputId = standaloneOutputId;
    }

    // 7. Build response
    const status = result.success ? 200 : 422;
    return json(
      {
        data: {
          success: result.success,
          output_id: outputId,
          research: result.research,
          provider: result.provider,
          model: result.model,
          template_id: result.templateId,
          template_version: result.templateVersion,
          provider_log: result.providerLog,
          error: result.error,
        },
        message: result.success
          ? "Research completed successfully."
          : `Research failed: ${result.error}`,
      },
      status,
    );
  } catch (err) {
    console.error("[researcher/run]", err);
    return serverError("Failed to execute research.");
  }
}

// ── Get Latest Research ──────────────────────────────────────

/**
 * GET /api/products/:productId/research
 *
 * Returns the most recent research output for a product.
 */
export async function getProductResearch(
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
       WHERE product_id = ? AND role_type = 'researcher'
       ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(productId)
      .first();

    if (!output) {
      return notFound(`No research output found for product: ${productId}`);
    }

    // Parse stored JSON
    let research = null;
    let providerLog = null;
    try {
      research = JSON.parse(output.output_json as string);
    } catch { /* keep null */ }
    try {
      providerLog = JSON.parse(output.provider_log_json as string);
    } catch { /* keep null */ }

    return json({
      data: {
        id: output.id,
        step_id: output.step_id,
        run_id: output.run_id,
        product_id: output.product_id,
        research,
        provider_log: providerLog,
        created_at: output.created_at,
      },
    });
  } catch (err) {
    console.error("[researcher/get-product]", err);
    return serverError("Failed to get research output.");
  }
}

// ── Get Research Output by ID ───────────────────────────────

/**
 * GET /api/research/:outputId
 *
 * Returns a specific research output by its ID.
 * Used for dashboard review of research results.
 */
export async function getResearchOutput(
  env: Env,
  outputId: string,
): Promise<Response> {
  try {
    const output = await env.DB.prepare(
      "SELECT * FROM workflow_step_outputs WHERE id = ? AND role_type = 'researcher'",
    )
      .bind(outputId)
      .first();

    if (!output) return notFound(`Research output not found: ${outputId}`);

    // Parse stored JSON
    let research = null;
    let providerLog = null;
    try {
      research = JSON.parse(output.output_json as string);
    } catch { /* keep null */ }
    try {
      providerLog = JSON.parse(output.provider_log_json as string);
    } catch { /* keep null */ }

    return json({
      data: {
        id: output.id,
        step_id: output.step_id,
        run_id: output.run_id,
        product_id: output.product_id,
        research,
        provider_log: providerLog,
        created_at: output.created_at,
      },
    });
  } catch (err) {
    console.error("[researcher/get-output]", err);
    return serverError("Failed to get research output.");
  }
}

// ── List Research Outputs ───────────────────────────────────

/**
 * GET /api/research
 *
 * Lists all research outputs, optionally filtered by product_id.
 * Supports dashboard review of all research results.
 */
export async function listResearchOutputs(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("product_id");

    let query = "SELECT * FROM workflow_step_outputs WHERE role_type = 'researcher'";
    const binds: unknown[] = [];

    if (productId) {
      query += " AND product_id = ?";
      binds.push(productId);
    }

    query += " ORDER BY created_at DESC";

    const stmt = env.DB.prepare(query);
    const result = binds.length > 0
      ? await stmt.bind(...binds).all()
      : await stmt.all();

    // Parse JSON fields in results
    const data = result.results.map((row) => {
      let research = null;
      let providerLog = null;
      try {
        research = JSON.parse(row.output_json as string);
      } catch { /* keep null */ }
      try {
        providerLog = JSON.parse(row.provider_log_json as string);
      } catch { /* keep null */ }

      return {
        id: row.id,
        step_id: row.step_id,
        run_id: row.run_id,
        product_id: row.product_id,
        research,
        provider_log: providerLog,
        created_at: row.created_at,
      };
    });

    return json({ data, total: data.length });
  } catch (err) {
    console.error("[researcher/list]", err);
    return serverError("Failed to list research outputs.");
  }
}
