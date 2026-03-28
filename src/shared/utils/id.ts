/**
 * Generates a URL-safe unique ID with an optional prefix.
 *
 * Uses crypto.randomUUID() which is available in Workers runtime.
 * Prefix helps identify entity type at a glance (e.g. "dom_", "cat_").
 */
export function generateId(prefix = ""): string {
  return `${prefix}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}
