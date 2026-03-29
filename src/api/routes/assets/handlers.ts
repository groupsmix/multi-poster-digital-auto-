import { Env } from "../../../shared/types";
import {
  json,
  badRequest,
  notFound,
  serverError,
  generateId,
  validateFields,
  parseJsonBody,
} from "../../../shared/utils";
import type { FieldRule } from "../../../shared/utils";
import { ASSET_TYPES } from "../../../config";

/** Type-safe check for whether a string is a valid asset type. */
function isValidAssetType(value: string): boolean {
  return (ASSET_TYPES as readonly string[]).includes(value);
}

// ── Validation rules ──────────────────────────────────────

const ASSET_UPLOAD_RULES: FieldRule[] = [
  { field: "filename", required: true, type: "string", maxLength: 500 },
  { field: "type", required: true, type: "string", maxLength: 50 },
  { field: "product_id", type: "string", maxLength: 100 },
  { field: "mime_type", type: "string", maxLength: 200 },
  { field: "provider", type: "string", maxLength: 200 },
];

// ── Helpers ───────────────────────────────────────────────

/**
 * Build the R2 storage key for an asset.
 * Format: {product_id}/{asset_id}/{filename} or unlinked/{asset_id}/{filename}
 */
function buildStorageKey(
  productId: string | null,
  assetId: string,
  filename: string,
): string {
  const prefix = productId ?? "unlinked";
  return `${prefix}/${assetId}/${filename}`;
}

// ── LIST ──────────────────────────────────────────────────

export async function listAssets(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("product_id");
    const type = url.searchParams.get("type");

    let query = "SELECT * FROM assets WHERE is_active = 1";
    const params: unknown[] = [];

    if (productId) {
      query += " AND product_id = ?";
      params.push(productId);
    }

    if (type) {
      if (!isValidAssetType(type)) {
        return badRequest(
          `Invalid asset type "${type}". Valid types: ${ASSET_TYPES.join(", ")}`,
        );
      }
      query += " AND type = ?";
      params.push(type);
    }

    query += " ORDER BY created_at DESC";

    const result = await env.DB.prepare(query).bind(...params).all();
    return json({ data: result.results, total: result.results.length });
  } catch (err) {
    console.error("[assets/list]", err);
    return serverError("Failed to list assets.");
  }
}

// ── LIST BY PRODUCT ───────────────────────────────────────

export async function listProductAssets(
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    const result = await env.DB.prepare(
      "SELECT * FROM assets WHERE product_id = ? AND is_active = 1 ORDER BY created_at DESC",
    )
      .bind(productId)
      .all();

    return json({ data: result.results, total: result.results.length });
  } catch (err) {
    console.error("[assets/listByProduct]", err);
    return serverError("Failed to list product assets.");
  }
}

// ── GET ONE ───────────────────────────────────────────────

export async function getAsset(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const row = await env.DB.prepare(
      "SELECT * FROM assets WHERE id = ? AND is_active = 1",
    )
      .bind(id)
      .first();

    if (!row) return notFound(`Asset not found: ${id}`);

    return json({ data: row });
  } catch (err) {
    console.error("[assets/get]", err);
    return serverError("Failed to fetch asset.");
  }
}

// ── UPLOAD (multipart: file + metadata) ───────────────────

export async function uploadAsset(
  request: Request,
  env: Env,
): Promise<Response> {
  const contentType = request.headers.get("content-type") || "";

  // ── Multipart upload ──────────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    return handleMultipartUpload(request, env);
  }

  // ── JSON metadata-only upload (file reference) ────────
  if (contentType.includes("application/json")) {
    return handleJsonUpload(request, env);
  }

  return badRequest(
    "Content-Type must be multipart/form-data (with file) or application/json (metadata only).",
  );
}

async function handleMultipartUpload(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const filename =
      (formData.get("filename") as string) ||
      (file instanceof File ? file.name : null);
    const type = (formData.get("type") as string) || "general";
    const productId = (formData.get("product_id") as string) || null;
    const provider = (formData.get("provider") as string) || null;
    const metadataRaw = formData.get("metadata_json") as string;

    if (!file || !(file instanceof File)) {
      return badRequest('"file" field is required in multipart upload.');
    }

    if (!filename) {
      return badRequest('"filename" is required.');
    }

    if (!isValidAssetType(type)) {
      return badRequest(
        `Invalid asset type "${type}". Valid types: ${ASSET_TYPES.join(", ")}`,
      );
    }

    // Validate product_id exists if provided
    if (productId) {
      const product = await env.DB.prepare(
        "SELECT id FROM products WHERE id = ?",
      )
        .bind(productId)
        .first();
      if (!product) {
        return badRequest(`Product not found: ${productId}`);
      }
    }

    const id = generateId("ast_");
    const storageKey = buildStorageKey(productId, id, filename);
    const mimeType = file.type || "application/octet-stream";
    const fileSize = file.size;
    const now = new Date().toISOString();

    // Upload file to R2
    await env.ASSETS_BUCKET.put(storageKey, file.stream(), {
      httpMetadata: { contentType: mimeType },
      customMetadata: { assetId: id, originalFilename: filename },
    });

    // Store metadata in D1
    await env.DB.prepare(
      `INSERT INTO assets (id, product_id, type, storage_key, provider, filename, file_size, mime_type, metadata_json, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
      .bind(
        id,
        productId,
        type,
        storageKey,
        provider,
        filename,
        fileSize,
        mimeType,
        metadataRaw || null,
        now,
        now,
      )
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM assets WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: created }, 201);
  } catch (err) {
    console.error("[assets/upload/multipart]", err);
    return serverError("Failed to upload asset.");
  }
}

async function handleJsonUpload(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await parseJsonBody(request);
  if (!body) return badRequest("Invalid JSON body.");

  const errors = validateFields(body, ASSET_UPLOAD_RULES);
  if (errors.length) return badRequest(errors.join(" "));

  const filename = body.filename as string;
  const type = body.type as string;
  const productId = (body.product_id as string) || null;
  const provider = (body.provider as string) || null;
  const mimeType = (body.mime_type as string) || "application/octet-stream";
  const fileSize =
    typeof body.file_size === "number" ? body.file_size : null;
  const metadataJson =
    typeof body.metadata_json === "string" ? body.metadata_json : null;

  if (!isValidAssetType(type)) {
    return badRequest(
      `Invalid asset type "${type}". Valid types: ${ASSET_TYPES.join(", ")}`,
    );
  }

  // Validate product_id exists if provided
  if (productId) {
    try {
      const product = await env.DB.prepare(
        "SELECT id FROM products WHERE id = ?",
      )
        .bind(productId)
        .first();
      if (!product) {
        return badRequest(`Product not found: ${productId}`);
      }
    } catch (err) {
      console.error("[assets/upload/json] product check", err);
      return serverError("Failed to verify product.");
    }
  }

  try {
    const id = generateId("ast_");
    const storageKey = buildStorageKey(productId, id, filename);
    const now = new Date().toISOString();

    // For JSON-only uploads we create a placeholder in R2 so the key exists
    // Real file content can be PUT later via a presigned URL flow
    await env.ASSETS_BUCKET.put(storageKey, "", {
      httpMetadata: { contentType: mimeType },
      customMetadata: { assetId: id, originalFilename: filename },
    });

    await env.DB.prepare(
      `INSERT INTO assets (id, product_id, type, storage_key, provider, filename, file_size, mime_type, metadata_json, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
      .bind(
        id,
        productId,
        type,
        storageKey,
        provider,
        filename,
        fileSize,
        mimeType,
        metadataJson,
        now,
        now,
      )
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM assets WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: created }, 201);
  } catch (err) {
    console.error("[assets/upload/json]", err);
    return serverError("Failed to create asset.");
  }
}

// ── DELETE (R2 first, then D1 soft-delete) ────────────────

export async function deleteAsset(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const existing = await env.DB.prepare(
      "SELECT * FROM assets WHERE id = ? AND is_active = 1",
    )
      .bind(id)
      .first();

    if (!existing) return notFound(`Asset not found: ${id}`);

    const storageKey = existing.storage_key as string;

    // Step 1: Delete from R2
    await env.ASSETS_BUCKET.delete(storageKey);

    // Step 2: Soft-delete in D1
    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE assets SET is_active = 0, updated_at = ? WHERE id = ?",
    )
      .bind(now, id)
      .run();

    return json({ message: "Asset deleted.", id });
  } catch (err) {
    console.error("[assets/delete]", err);
    return serverError("Failed to delete asset.");
  }
}
