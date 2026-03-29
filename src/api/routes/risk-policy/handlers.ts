/**
 * Risk/Policy — API route handlers.
 *
 * POST /api/products/:id/policy-check  — run policy check
 * GET  /api/products/:id/policy-checks — get policy check history
 * GET  /api/policy-rules               — list policy rules
 * POST /api/policy-rules               — create policy rule
 * PUT  /api/policy-rules/:id           — update policy rule
 * DELETE /api/policy-rules/:id         — delete policy rule
 */

import type { Env } from "../../../shared/types";
import {
  json,
  notFound,
  badRequest,
  serverError,
  parseJsonBody,
} from "../../../shared/utils";
import {
  runPolicyCheck,
  getProductPolicyChecks,
  listPolicyRules,
  createPolicyRule,
  updatePolicyRule,
  deletePolicyRule,
  gatherProductContent,
} from "../../../services/risk-policy";

// ── Run Policy Check ────────────────────────────────────────

export async function handleRunPolicyCheck(
  _request: Request,
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

    // Gather content from product and its variants
    const content = await gatherProductContent(env, productId);

    const result = await runPolicyCheck(env, {
      productId,
      content,
    });

    return json({
      data: result,
      message: result.passed
        ? "Policy check passed."
        : `Policy check failed with ${result.violations.length} violation(s).`,
    });
  } catch (err) {
    console.error("[risk-policy/check]", err);
    return serverError("Failed to run policy check.");
  }
}

// ── Get Policy Check History ────────────────────────────────

export async function handleGetPolicyChecks(
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

    const checks = await getProductPolicyChecks(env, productId);

    return json({ data: checks, total: checks.length });
  } catch (err) {
    console.error("[risk-policy/checks]", err);
    return serverError("Failed to get policy checks.");
  }
}

// ── List Policy Rules ───────────────────────────────────────

export async function handleListPolicyRules(
  env: Env,
): Promise<Response> {
  try {
    const rules = await listPolicyRules(env);
    return json({ data: rules, total: rules.length });
  } catch (err) {
    console.error("[risk-policy/list-rules]", err);
    return serverError("Failed to list policy rules.");
  }
}

// ── Create Policy Rule ──────────────────────────────────────

export async function handleCreatePolicyRule(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = await parseJsonBody(request);
    if (!body) return badRequest("Request body is required.");

    const name = body.name as string;
    const rule_type = body.rule_type as string;
    const severity = body.severity as "block" | "warn" | "info";
    const pattern = body.pattern as string;
    const description = body.description as string;

    if (!name || !rule_type || !severity || !pattern || !description) {
      return badRequest("Missing required fields: name, rule_type, severity, pattern, description.");
    }

    const validSeverities = ["block", "warn", "info"];
    if (!validSeverities.includes(severity)) {
      return badRequest(`Invalid severity "${severity}". Valid: ${validSeverities.join(", ")}`);
    }

    const rule = await createPolicyRule(env, {
      name,
      rule_type,
      severity,
      pattern,
      description,
    });

    return json({ data: rule, message: "Policy rule created." }, 201);
  } catch (err) {
    console.error("[risk-policy/create-rule]", err);
    return serverError("Failed to create policy rule.");
  }
}

// ── Update Policy Rule ──────────────────────────────────────

export async function handleUpdatePolicyRule(
  request: Request,
  env: Env,
  ruleId: string,
): Promise<Response> {
  try {
    const body = await parseJsonBody(request);
    if (!body) return badRequest("Request body is required.");

    const rule = await updatePolicyRule(env, ruleId, body as Record<string, unknown>);

    if (!rule) return notFound(`Policy rule not found: ${ruleId}`);

    return json({ data: rule, message: "Policy rule updated." });
  } catch (err) {
    console.error("[risk-policy/update-rule]", err);
    return serverError("Failed to update policy rule.");
  }
}

// ── Delete Policy Rule ──────────────────────────────────────

export async function handleDeletePolicyRule(
  env: Env,
  ruleId: string,
): Promise<Response> {
  try {
    const deleted = await deletePolicyRule(env, ruleId);

    if (!deleted) return notFound(`Policy rule not found: ${ruleId}`);

    return json({ message: "Policy rule deleted." });
  } catch (err) {
    console.error("[risk-policy/delete-rule]", err);
    return serverError("Failed to delete policy rule.");
  }
}
