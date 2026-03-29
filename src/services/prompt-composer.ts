/**
 * Prompt Composer — assembles multi-layer prompts for AI roles.
 *
 * Loads prompt layers from D1 (active versioned templates) and composes
 * them into a single system prompt + user prompt pair for provider execution.
 *
 * Layer order (per architecture §9):
 *   1. Master System Prompt
 *   2. Role Prompt
 *   3. Domain Prompt
 *   4. Category Prompt
 *   5. Platform Prompt
 *   6. Social Prompt
 *   7. Output Schema
 *   8. Quality Rules
 *   9. Revision Prompt (only when revising)
 */

import type { Env } from "../shared/types";
import type { AiRole } from "../config";

/** Resolved prompt template row from D1. */
interface PromptTemplateRow {
  id: string;
  name: string;
  role_type: string;
  version: number;
  scope_type: string | null;
  scope_ref: string | null;
  system_prompt: string | null;
  domain_prompt: string | null;
  platform_prompt: string | null;
  social_prompt: string | null;
  category_prompt: string | null;
  quality_rules: string | null;
  output_schema: string | null;
  revision_prompt: string | null;
  is_active: number;
}

/** Context for composing prompts. */
export interface PromptContext {
  role: AiRole;
  /** Domain name or slug for domain-specific prompt lookup. */
  domainRef?: string;
  /** Category name or slug for category-specific prompt lookup. */
  categoryRef?: string;
  /** Platform name or slug for platform-specific prompt lookup. */
  platformRef?: string;
  /** Social channel name for social-specific prompt lookup. */
  socialRef?: string;
  /** Whether this is a revision (include revision prompt layer). */
  isRevision?: boolean;
  /** Revision notes from the Boss. */
  revisionNotes?: string;
}

/** Composed prompt ready for provider execution. */
export interface ComposedPrompt {
  /** Full system prompt (all layers concatenated). */
  systemPrompt: string;
  /** Output schema string if available. */
  outputSchema: string | null;
  /** Prompt template ID used (for logging/versioning). */
  templateId: string | null;
  /** Prompt template version used. */
  templateVersion: number | null;
}

/**
 * Load the active prompt template for a given role from D1.
 *
 * Tries to find an active template matching the role_type.
 * If scope_type + scope_ref are provided, tries a scoped match first,
 * then falls back to the generic role template.
 */
async function loadActiveTemplate(
  env: Env,
  role: AiRole,
  scopeType?: string,
  scopeRef?: string,
): Promise<PromptTemplateRow | null> {
  // Try scoped template first
  if (scopeType && scopeRef) {
    const scoped = await env.DB.prepare(
      `SELECT * FROM prompt_templates
       WHERE role_type = ? AND scope_type = ? AND scope_ref = ? AND is_active = 1
       ORDER BY version DESC LIMIT 1`,
    )
      .bind(role, scopeType, scopeRef)
      .first();

    if (scoped) return scoped as unknown as PromptTemplateRow;
  }

  // Fall back to generic role template
  const generic = await env.DB.prepare(
    `SELECT * FROM prompt_templates
     WHERE role_type = ? AND is_active = 1
       AND (scope_type IS NULL OR scope_type = '')
     ORDER BY version DESC LIMIT 1`,
  )
    .bind(role)
    .first();

  return generic ? (generic as unknown as PromptTemplateRow) : null;
}

/**
 * Compose a full prompt from template layers and context.
 *
 * Falls back to built-in defaults if no DB template is found,
 * ensuring the researcher can always run even without seeded prompts.
 */
export async function composePrompt(
  env: Env,
  ctx: PromptContext,
): Promise<ComposedPrompt> {
  const template = await loadActiveTemplate(
    env,
    ctx.role,
    ctx.domainRef ? "domain" : undefined,
    ctx.domainRef,
  );

  const layers: string[] = [];

  // Layer 1 — Master System Prompt
  if (template?.system_prompt) {
    layers.push(template.system_prompt);
  } else {
    layers.push(DEFAULT_SYSTEM_PROMPT);
  }

  // Layer 2 — Role Prompt (from DB or built-in)
  if (template?.domain_prompt) {
    // The domain_prompt column doubles as the role-specific instruction
    // when there's no separate role layer. Per architecture, the role prompt
    // is embedded in the template row.
    layers.push(template.domain_prompt);
  }

  // Layer 3 — Domain Prompt (if different scope template exists)
  if (ctx.domainRef) {
    const domainTemplate = await loadActiveTemplate(
      env,
      ctx.role,
      "domain",
      ctx.domainRef,
    );
    if (domainTemplate?.domain_prompt && domainTemplate.id !== template?.id) {
      layers.push(domainTemplate.domain_prompt);
    }
  }

  // Layer 4 — Category Prompt
  if (ctx.categoryRef && template?.category_prompt) {
    layers.push(template.category_prompt);
  }

  // Layer 5 — Platform Prompt
  if (ctx.platformRef && template?.platform_prompt) {
    layers.push(template.platform_prompt);
  }

  // Layer 6 — Social Prompt
  if (ctx.socialRef && template?.social_prompt) {
    layers.push(template.social_prompt);
  }

  // Layer 8 — Quality Rules
  if (template?.quality_rules) {
    layers.push(template.quality_rules);
  } else {
    layers.push(DEFAULT_QUALITY_RULES);
  }

  // Layer 9 — Revision Prompt
  if (ctx.isRevision && ctx.revisionNotes) {
    const revisionLayer = template?.revision_prompt
      ? template.revision_prompt
      : "The previous output was rejected. Apply the following revision notes:";
    layers.push(`${revisionLayer}\n\n${ctx.revisionNotes}`);
  }

  return {
    systemPrompt: layers.filter(Boolean).join("\n\n---\n\n"),
    outputSchema: template?.output_schema ?? null,
    templateId: template?.id ?? null,
    templateVersion: template?.version ?? null,
  };
}

// ── Built-in fallback prompts ──────────────────────────────

const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant working inside the NEXUS product operating system.
Be accurate, specific, and commercially useful.
Never fabricate data. Prefer structured output.
Follow the output schema exactly when one is provided.`;

const DEFAULT_QUALITY_RULES = `Quality rules:
- No generic content. Be specific to the product idea, domain, and category.
- No robotic tone. Write like a knowledgeable expert.
- Commercially useful. Help the user make money or save time.
- Be specific with numbers, platform names, and market categories.
- Actionable. Provide insights the user can act on immediately.`;
