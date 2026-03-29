/**
 * Bulk config and analytics export handlers.
 *
 * Architecture §27 — export prompts, platform configs, social configs,
 * workflow templates, domains, categories, providers, and analytics
 * as standalone exports in JSON or CSV format.
 */

import { Env } from "../../../shared/types";
import { json, badRequest, serverError } from "../../../shared/utils";

// ── CSV helper ─────────────────────────────────────────────

/**
 * Convert an array of objects to CSV string.
 * Handles nested objects by JSON-stringifying them.
 */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";

  // Gather all unique keys across all rows
  const keys = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row))),
  );

  const escapeCsvField = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    // Escape fields containing commas, quotes, or newlines
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = keys.map(escapeCsvField).join(",");
  const dataRows = rows.map((row) =>
    keys.map((key) => escapeCsvField(row[key])).join(","),
  );

  return [header, ...dataRows].join("\n");
}

function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ── Bulk config export types ───────────────────────────────

const BULK_EXPORT_TYPES = [
  "domains",
  "categories",
  "platforms",
  "social_channels",
  "prompts",
  "providers",
  "workflow_templates",
] as const;

type BulkExportType = (typeof BULK_EXPORT_TYPES)[number];

function isValidBulkExportType(value: string): value is BulkExportType {
  return (BULK_EXPORT_TYPES as readonly string[]).includes(value);
}

const BULK_EXPORT_FORMATS = ["json", "csv"] as const;

type BulkExportFormat = (typeof BULK_EXPORT_FORMATS)[number];

function isValidBulkFormat(value: string): value is BulkExportFormat {
  return (BULK_EXPORT_FORMATS as readonly string[]).includes(value);
}

// ── Bulk config export ─────────────────────────────────────

/**
 * GET /api/exports/config?type=domains|categories|...&format=json|csv
 *
 * Export all records for a given configuration entity.
 */
export async function exportBulkConfig(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "";
  const format = url.searchParams.get("format") || "json";

  if (!isValidBulkExportType(type)) {
    return badRequest(
      `Invalid export type "${type}". Valid types: ${BULK_EXPORT_TYPES.join(", ")}`,
    );
  }

  if (!isValidBulkFormat(format)) {
    return badRequest(
      `Invalid format "${format}". Valid formats: ${BULK_EXPORT_FORMATS.join(", ")}`,
    );
  }

  try {
    const queryMap: Record<BulkExportType, string> = {
      domains: "SELECT * FROM domains ORDER BY name ASC",
      categories: "SELECT * FROM categories ORDER BY name ASC",
      platforms: "SELECT * FROM platforms ORDER BY name ASC",
      social_channels: "SELECT * FROM social_channels ORDER BY name ASC",
      prompts: "SELECT * FROM prompt_templates ORDER BY name ASC, version DESC",
      providers: "SELECT id, name, role_type, provider_type, model, state, tier, priority, base_url, notes, is_active, created_at, updated_at FROM provider_configs ORDER BY tier ASC, priority ASC",
      workflow_templates: "SELECT * FROM workflow_templates ORDER BY name ASC",
    };

    const result = await env.DB.prepare(queryMap[type]).all();
    const rows = result.results as Record<string, unknown>[];

    if (format === "csv") {
      const csv = toCsv(rows);
      return csvResponse(csv, `${type}_export.csv`);
    }

    return json({
      data: rows,
      export_type: type,
      format: "json",
      count: rows.length,
      exported_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[exports/bulk-config]", err);
    return serverError(`Failed to export ${type}.`);
  }
}

// ── Bulk analytics export ──────────────────────────────────

const ANALYTICS_EXPORT_TYPES = [
  "events",
  "cost_events",
  "provider_usage",
  "step_timing",
  "approval_stats",
  "daily_trends",
] as const;

type AnalyticsExportType = (typeof ANALYTICS_EXPORT_TYPES)[number];

function isValidAnalyticsType(value: string): value is AnalyticsExportType {
  return (ANALYTICS_EXPORT_TYPES as readonly string[]).includes(value);
}

/**
 * GET /api/exports/analytics?type=events|cost_events|...&format=json|csv
 *
 * Export analytics data.
 */
export async function exportBulkAnalytics(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "events";
  const format = url.searchParams.get("format") || "json";

  if (!isValidAnalyticsType(type)) {
    return badRequest(
      `Invalid analytics type "${type}". Valid types: ${ANALYTICS_EXPORT_TYPES.join(", ")}`,
    );
  }

  if (!isValidBulkFormat(format)) {
    return badRequest(
      `Invalid format "${format}". Valid formats: ${BULK_EXPORT_FORMATS.join(", ")}`,
    );
  }

  try {
    const queryMap: Record<AnalyticsExportType, string> = {
      events: "SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT 10000",
      cost_events: "SELECT * FROM cost_events ORDER BY created_at DESC LIMIT 10000",
      provider_usage: "SELECT * FROM provider_usage_summary ORDER BY total_calls DESC",
      step_timing: "SELECT * FROM step_timing_summary ORDER BY avg_duration_ms DESC",
      approval_stats: "SELECT * FROM approval_stats ORDER BY total_reviews DESC",
      daily_trends: "SELECT * FROM analytics_daily ORDER BY date DESC LIMIT 365",
    };

    const result = await env.DB.prepare(queryMap[type]).all();
    const rows = result.results as Record<string, unknown>[];

    if (format === "csv") {
      const csv = toCsv(rows);
      return csvResponse(csv, `analytics_${type}_export.csv`);
    }

    return json({
      data: rows,
      export_type: `analytics_${type}`,
      format: "json",
      count: rows.length,
      exported_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[exports/bulk-analytics]", err);
    return serverError(`Failed to export analytics ${type}.`);
  }
}
