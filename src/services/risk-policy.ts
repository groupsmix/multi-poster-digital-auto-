/**
 * Risk/Policy Layer — content moderation and policy checking.
 *
 * Architecture §28 — checks product outputs for:
 * - Trademark/copyright risk
 * - Platform policy violations
 * - Misleading claims
 * - Unsafe/prohibited content
 *
 * Policy rules are config-driven and stored in D1.
 */

import type { Env } from "../shared/types";
import { generateId } from "../shared/utils";

// ── Types ──────────────────────────────────────────────────

export interface PolicyRule {
  id: string;
  name: string;
  rule_type: string;
  severity: "block" | "warn" | "info";
  pattern: string;
  description: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface PolicyCheckResult {
  check_id: string;
  product_id: string;
  passed: boolean;
  violations: PolicyViolation[];
  warnings: PolicyViolation[];
  info: PolicyViolation[];
  checked_at: string;
}

export interface PolicyViolation {
  rule_id: string;
  rule_name: string;
  rule_type: string;
  severity: "block" | "warn" | "info";
  match: string;
  field: string;
  suggestion: string;
}

export interface PolicyCheckInput {
  productId: string;
  content: Record<string, string>;
}

// ── Main check function ────────────────────────────────────

/**
 * Run policy checks against product content.
 *
 * 1. Fetch active policy rules from D1
 * 2. Scan content fields against each rule's pattern
 * 3. Categorize violations by severity
 * 4. Save check result to D1
 * 5. Return structured result
 */
export async function runPolicyCheck(
  env: Env,
  input: PolicyCheckInput,
): Promise<PolicyCheckResult> {
  const checkId = generateId("pck_");
  const now = new Date().toISOString();

  // 1. Fetch active rules
  const rulesResult = await env.DB.prepare(
    "SELECT * FROM policy_rules WHERE is_active = 1 ORDER BY severity ASC, name ASC",
  ).all();

  const rules = rulesResult.results as unknown as PolicyRule[];

  // 2. Scan content against rules
  const violations: PolicyViolation[] = [];
  const warnings: PolicyViolation[] = [];
  const info: PolicyViolation[] = [];

  for (const rule of rules) {
    for (const [field, value] of Object.entries(input.content)) {
      if (!value) continue;

      let matched = false;
      let matchText = "";

      try {
        const regex = new RegExp(rule.pattern, "gi");
        const match = regex.exec(value);
        if (match) {
          matched = true;
          matchText = match[0];
        }
      } catch {
        // If pattern is not a valid regex, do case-insensitive substring match
        const lowerValue = value.toLowerCase();
        const lowerPattern = rule.pattern.toLowerCase();
        if (lowerValue.includes(lowerPattern)) {
          matched = true;
          matchText = rule.pattern;
        }
      }

      if (matched) {
        const violation: PolicyViolation = {
          rule_id: rule.id,
          rule_name: rule.name,
          rule_type: rule.rule_type,
          severity: rule.severity,
          match: matchText,
          field,
          suggestion: rule.description,
        };

        switch (rule.severity) {
          case "block":
            violations.push(violation);
            break;
          case "warn":
            warnings.push(violation);
            break;
          case "info":
            info.push(violation);
            break;
        }
      }
    }
  }

  const passed = violations.length === 0;

  // 3. Save check result
  await env.DB.prepare(
    `INSERT INTO policy_checks
       (id, product_id, passed, violations_json, checked_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(
      checkId,
      input.productId,
      passed ? 1 : 0,
      JSON.stringify({ violations, warnings, info }),
      now,
    )
    .run();

  return {
    check_id: checkId,
    product_id: input.productId,
    passed,
    violations,
    warnings,
    info,
    checked_at: now,
  };
}

/**
 * Get policy check history for a product.
 */
export async function getProductPolicyChecks(
  env: Env,
  productId: string,
): Promise<PolicyCheckResult[]> {
  const result = await env.DB.prepare(
    "SELECT * FROM policy_checks WHERE product_id = ? ORDER BY checked_at DESC",
  )
    .bind(productId)
    .all();

  return result.results.map((row) => {
    const parsed = JSON.parse((row.violations_json as string) || "{}");
    return {
      check_id: row.id as string,
      product_id: row.product_id as string,
      passed: (row.passed as number) === 1,
      violations: parsed.violations || [],
      warnings: parsed.warnings || [],
      info: parsed.info || [],
      checked_at: row.checked_at as string,
    };
  });
}

/**
 * List all policy rules.
 */
export async function listPolicyRules(
  env: Env,
): Promise<PolicyRule[]> {
  const result = await env.DB.prepare(
    "SELECT * FROM policy_rules ORDER BY severity ASC, name ASC",
  ).all();
  return result.results as unknown as PolicyRule[];
}

/**
 * Create a new policy rule.
 */
export async function createPolicyRule(
  env: Env,
  rule: {
    name: string;
    rule_type: string;
    severity: "block" | "warn" | "info";
    pattern: string;
    description: string;
  },
): Promise<PolicyRule> {
  const id = generateId("pr_");
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO policy_rules
       (id, name, rule_type, severity, pattern, description, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  )
    .bind(id, rule.name, rule.rule_type, rule.severity, rule.pattern, rule.description, now, now)
    .run();

  return {
    id,
    name: rule.name,
    rule_type: rule.rule_type,
    severity: rule.severity,
    pattern: rule.pattern,
    description: rule.description,
    is_active: 1,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Update a policy rule.
 */
export async function updatePolicyRule(
  env: Env,
  id: string,
  updates: Partial<{
    name: string;
    rule_type: string;
    severity: "block" | "warn" | "info";
    pattern: string;
    description: string;
    is_active: number;
  }>,
): Promise<PolicyRule | null> {
  const existing = await env.DB.prepare(
    "SELECT * FROM policy_rules WHERE id = ?",
  )
    .bind(id)
    .first();

  if (!existing) return null;

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) { fields.push("name = ?"); values.push(updates.name); }
  if (updates.rule_type !== undefined) { fields.push("rule_type = ?"); values.push(updates.rule_type); }
  if (updates.severity !== undefined) { fields.push("severity = ?"); values.push(updates.severity); }
  if (updates.pattern !== undefined) { fields.push("pattern = ?"); values.push(updates.pattern); }
  if (updates.description !== undefined) { fields.push("description = ?"); values.push(updates.description); }
  if (updates.is_active !== undefined) { fields.push("is_active = ?"); values.push(updates.is_active); }

  fields.push("updated_at = ?");
  values.push(now);
  values.push(id);

  await env.DB.prepare(
    `UPDATE policy_rules SET ${fields.join(", ")} WHERE id = ?`,
  )
    .bind(...values)
    .run();

  const updated = await env.DB.prepare(
    "SELECT * FROM policy_rules WHERE id = ?",
  )
    .bind(id)
    .first();

  return updated as unknown as PolicyRule;
}

/**
 * Delete a policy rule.
 */
export async function deletePolicyRule(
  env: Env,
  id: string,
): Promise<boolean> {
  const result = await env.DB.prepare(
    "DELETE FROM policy_rules WHERE id = ?",
  )
    .bind(id)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

/**
 * Gather scannable content from a product and its variants.
 */
export async function gatherProductContent(
  env: Env,
  productId: string,
): Promise<Record<string, string>> {
  const content: Record<string, string> = {};

  // Product idea and notes
  const product = await env.DB.prepare(
    "SELECT idea, notes FROM products WHERE id = ?",
  )
    .bind(productId)
    .first();

  if (product) {
    content["product_idea"] = (product.idea as string) || "";
    content["product_notes"] = (product.notes as string) || "";
  }

  // Variant titles and descriptions
  const variants = await env.DB.prepare(
    "SELECT id, title, description, content_json FROM product_variants WHERE product_id = ?",
  )
    .bind(productId)
    .all();

  for (const v of variants.results) {
    const vid = v.id as string;
    if (v.title) content[`variant_${vid}_title`] = v.title as string;
    if (v.description) content[`variant_${vid}_description`] = v.description as string;
    if (v.content_json) {
      try {
        const parsed = JSON.parse(v.content_json as string);
        if (typeof parsed === "object" && parsed !== null) {
          for (const [key, val] of Object.entries(parsed)) {
            if (typeof val === "string") {
              content[`variant_${vid}_content_${key}`] = val;
            }
          }
        }
      } catch { /* skip unparseable content */ }
    }
  }

  return content;
}
