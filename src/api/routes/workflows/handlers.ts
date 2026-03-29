import { Env } from "../../../shared/types";
import {
  json,
  notFound,
  badRequest,
  serverError,
  generateId,
  parseJsonBody,
} from "../../../shared/utils";

// ── Start Workflow Run ─────────────────────────────────────

export async function startWorkflowRun(
  request: Request,
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    // Validate product exists
    const product = await env.DB.prepare(
      "SELECT * FROM products WHERE id = ?",
    )
      .bind(productId)
      .first();
    if (!product) return notFound(`Product not found: ${productId}`);

    // Check for already-running workflow
    const activeRun = await env.DB.prepare(
      "SELECT id FROM workflow_runs WHERE product_id = ? AND status IN ('pending', 'running')",
    )
      .bind(productId)
      .first();
    if (activeRun) {
      return badRequest(
        `Product ${productId} already has an active workflow run: ${activeRun.id}`,
      );
    }

    // Determine workflow template
    const body = await parseJsonBody(request);
    const templateId =
      (body?.workflow_template_id as string) ||
      (product.workflow_template_id as string) ||
      "wft_standard";

    const template = await env.DB.prepare(
      "SELECT * FROM workflow_templates WHERE id = ?",
    )
      .bind(templateId)
      .first();
    if (!template) {
      return badRequest(`Workflow template not found: ${templateId}`);
    }

    // Parse steps from template
    let steps: Array<{
      step: string;
      role: string;
      required: boolean;
    }>;
    try {
      steps = JSON.parse(template.steps_json as string);
    } catch {
      return serverError("Invalid steps_json in workflow template.");
    }

    const runId = generateId("run_");
    const now = new Date().toISOString();

    // Create workflow run
    await env.DB.prepare(
      `INSERT INTO workflow_runs
        (id, product_id, template_id, status, started_at, created_at)
       VALUES (?, ?, ?, 'running', ?, ?)`,
    )
      .bind(runId, productId, templateId, now, now)
      .run();

    // Create workflow steps from template
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepId = generateId("step_");

      // Boss approval step is always pending (human action)
      const stepStatus = i === 0 ? "running" : "pending";

      await env.DB.prepare(
        `INSERT INTO workflow_steps
          (id, run_id, step_name, role_type, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(stepId, runId, step.step, step.role, stepStatus, now)
        .run();
    }

    // Update product status to running
    await env.DB.prepare(
      "UPDATE products SET status = 'running', updated_at = ? WHERE id = ?",
    )
      .bind(now, productId)
      .run();

    // Fetch created run with steps
    const run = await env.DB.prepare(
      "SELECT * FROM workflow_runs WHERE id = ?",
    )
      .bind(runId)
      .first();

    const createdSteps = await env.DB.prepare(
      "SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY created_at ASC",
    )
      .bind(runId)
      .all();

    return json(
      {
        data: { ...run, steps: createdSteps.results },
        message: `Workflow run ${runId} started for product ${productId}.`,
      },
      201,
    );
  } catch (err) {
    console.error("[workflows/start]", err);
    return serverError("Failed to start workflow run.");
  }
}

// ── List Workflow Runs (all or per product) ────────────────

export async function listWorkflowRuns(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("product_id");
    const status = url.searchParams.get("status");

    let query = "SELECT * FROM workflow_runs";
    const conditions: string[] = [];
    const binds: unknown[] = [];

    if (productId) {
      conditions.push("product_id = ?");
      binds.push(productId);
    }
    if (status) {
      conditions.push("status = ?");
      binds.push(status);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY created_at DESC";

    const stmt = env.DB.prepare(query);
    const result =
      binds.length > 0 ? await stmt.bind(...binds).all() : await stmt.all();

    return json({ data: result.results, total: result.results.length });
  } catch (err) {
    console.error("[workflows/list]", err);
    return serverError("Failed to list workflow runs.");
  }
}

// ── List Runs for a Specific Product ──────────────────────

export async function listProductWorkflowRuns(
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

    const runs = await env.DB.prepare(
      "SELECT * FROM workflow_runs WHERE product_id = ? ORDER BY created_at DESC",
    )
      .bind(productId)
      .all();

    return json({ data: runs.results, total: runs.results.length });
  } catch (err) {
    console.error("[workflows/list-product]", err);
    return serverError("Failed to list product workflow runs.");
  }
}

// ── Get Workflow Run Detail ────────────────────────────────

export async function getWorkflowRun(
  env: Env,
  runId: string,
): Promise<Response> {
  try {
    const run = await env.DB.prepare(
      "SELECT * FROM workflow_runs WHERE id = ?",
    )
      .bind(runId)
      .first();
    if (!run) return notFound(`Workflow run not found: ${runId}`);

    const steps = await env.DB.prepare(
      "SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY created_at ASC",
    )
      .bind(runId)
      .all();

    return json({
      data: {
        ...run,
        steps: steps.results,
      },
    });
  } catch (err) {
    console.error("[workflows/get]", err);
    return serverError("Failed to get workflow run.");
  }
}

// ── Complete a Workflow Step ───────────────────────────────

export async function completeWorkflowStep(
  request: Request,
  env: Env,
  runId: string,
  stepId: string,
): Promise<Response> {
  try {
    const step = await env.DB.prepare(
      "SELECT * FROM workflow_steps WHERE id = ? AND run_id = ?",
    )
      .bind(stepId, runId)
      .first();
    if (!step) return notFound(`Step ${stepId} not found in run ${runId}.`);

    if (step.status === "completed") {
      return badRequest(`Step ${stepId} is already completed.`);
    }

    const body = await parseJsonBody(request);
    const now = new Date().toISOString();

    // Update step to completed
    await env.DB.prepare(
      `UPDATE workflow_steps SET
        status = 'completed',
        provider_used = ?,
        model_used = ?,
        output_ref = ?,
        finished_at = ?
       WHERE id = ?`,
    )
      .bind(
        (body?.provider_used as string) || null,
        (body?.model_used as string) || null,
        (body?.output_ref as string) || null,
        now,
        stepId,
      )
      .run();

    // Advance the next pending step to running
    const nextStep = await env.DB.prepare(
      "SELECT id FROM workflow_steps WHERE run_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 1",
    )
      .bind(runId)
      .first();

    if (nextStep) {
      await env.DB.prepare(
        "UPDATE workflow_steps SET status = 'running', started_at = ? WHERE id = ?",
      )
        .bind(now, nextStep.id)
        .run();
    } else {
      // All steps completed — check if last step was boss approval
      const allSteps = await env.DB.prepare(
        "SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY created_at ASC",
      )
        .bind(runId)
        .all();

      const allCompleted = allSteps.results.every(
        (s) => s.status === "completed" || s.status === "skipped",
      );

      if (allCompleted) {
        await env.DB.prepare(
          "UPDATE workflow_runs SET status = 'completed', finished_at = ? WHERE id = ?",
        )
          .bind(now, runId)
          .run();

        // Update product status
        const run = await env.DB.prepare(
          "SELECT product_id FROM workflow_runs WHERE id = ?",
        )
          .bind(runId)
          .first();
        if (run) {
          await env.DB.prepare(
            "UPDATE products SET status = 'waiting_for_review', updated_at = ? WHERE id = ?",
          )
            .bind(now, run.product_id)
            .run();
        }
      }
    }

    const updated = await env.DB.prepare(
      "SELECT * FROM workflow_steps WHERE id = ?",
    )
      .bind(stepId)
      .first();

    return json({
      data: updated,
      message: `Step ${stepId} completed.`,
      next_step: nextStep ? nextStep.id : null,
    });
  } catch (err) {
    console.error("[workflows/complete-step]", err);
    return serverError("Failed to complete workflow step.");
  }
}

// ── Fail a Workflow Step ──────────────────────────────────

export async function failWorkflowStep(
  request: Request,
  env: Env,
  runId: string,
  stepId: string,
): Promise<Response> {
  try {
    const step = await env.DB.prepare(
      "SELECT * FROM workflow_steps WHERE id = ? AND run_id = ?",
    )
      .bind(stepId, runId)
      .first();
    if (!step) return notFound(`Step ${stepId} not found in run ${runId}.`);

    const body = await parseJsonBody(request);
    const now = new Date().toISOString();
    const errorLog = (body?.error as string) || "Unknown error";
    const currentRetries = (step.retries as number) || 0;

    // Check if we can retry
    const maxRetries = 3; // from DEFAULTS.MAX_STEP_RETRIES
    if (body?.retry && currentRetries < maxRetries) {
      await env.DB.prepare(
        `UPDATE workflow_steps SET
          status = 'retrying',
          retries = ?,
          error_log = ?,
          provider_used = ?,
          model_used = ?
         WHERE id = ?`,
      )
        .bind(
          currentRetries + 1,
          errorLog,
          (body?.provider_used as string) || null,
          (body?.model_used as string) || null,
          stepId,
        )
        .run();

      const updated = await env.DB.prepare(
        "SELECT * FROM workflow_steps WHERE id = ?",
      )
        .bind(stepId)
        .first();

      return json({
        data: updated,
        message: `Step ${stepId} marked for retry (${currentRetries + 1}/${maxRetries}).`,
      });
    }

    // Mark as failed
    await env.DB.prepare(
      `UPDATE workflow_steps SET
        status = 'failed',
        retries = ?,
        error_log = ?,
        provider_used = ?,
        model_used = ?,
        finished_at = ?
       WHERE id = ?`,
    )
      .bind(
        currentRetries,
        errorLog,
        (body?.provider_used as string) || null,
        (body?.model_used as string) || null,
        now,
        stepId,
      )
      .run();

    // Mark run as failed_partial or failed depending on other steps
    const completedSteps = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM workflow_steps WHERE run_id = ? AND status = 'completed'",
    )
      .bind(runId)
      .first();

    const runStatus =
      completedSteps && (completedSteps.count as number) > 0
        ? "failed_partial"
        : "failed";

    await env.DB.prepare(
      "UPDATE workflow_runs SET status = ?, finished_at = ? WHERE id = ?",
    )
      .bind(runStatus, now, runId)
      .run();

    // Update product status
    const run = await env.DB.prepare(
      "SELECT product_id FROM workflow_runs WHERE id = ?",
    )
      .bind(runId)
      .first();
    if (run) {
      await env.DB.prepare(
        `UPDATE products SET status = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(runStatus === "failed_partial" ? "failed_partial" : "failed", now, run.product_id)
        .run();
    }

    const updated = await env.DB.prepare(
      "SELECT * FROM workflow_steps WHERE id = ?",
    )
      .bind(stepId)
      .first();

    return json({
      data: updated,
      message: `Step ${stepId} failed. Run marked as ${runStatus}.`,
    });
  } catch (err) {
    console.error("[workflows/fail-step]", err);
    return serverError("Failed to update workflow step.");
  }
}
