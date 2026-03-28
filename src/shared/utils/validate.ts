/**
 * Lightweight request-body validation helpers.
 *
 * Returns an array of error strings — empty means valid.
 */

export interface FieldRule {
  field: string;
  required?: boolean;
  maxLength?: number;
  type?: "string" | "number" | "boolean";
}

/**
 * Validate a parsed body against a set of field rules.
 * Returns an array of human-readable error messages (empty = valid).
 */
export function validateFields(
  body: Record<string, unknown>,
  rules: FieldRule[],
): string[] {
  const errors: string[] = [];

  for (const rule of rules) {
    const value = body[rule.field];

    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push(`"${rule.field}" is required.`);
      continue;
    }

    if (value === undefined || value === null) continue;

    if (rule.type && typeof value !== rule.type) {
      errors.push(`"${rule.field}" must be of type ${rule.type}.`);
    }

    if (rule.maxLength && typeof value === "string" && value.length > rule.maxLength) {
      errors.push(`"${rule.field}" must be at most ${rule.maxLength} characters.`);
    }
  }

  return errors;
}

/**
 * Safely parse JSON from a Request body.
 * Returns null if parsing fails.
 */
export async function parseJsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
