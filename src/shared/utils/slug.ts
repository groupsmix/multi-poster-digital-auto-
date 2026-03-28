/**
 * Converts a human-readable name into a URL-safe slug.
 *
 * Rules:
 * - lowercase
 * - spaces / underscores → hyphens
 * - strip non-alphanumeric (except hyphens)
 * - collapse consecutive hyphens
 * - trim leading/trailing hyphens
 */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
