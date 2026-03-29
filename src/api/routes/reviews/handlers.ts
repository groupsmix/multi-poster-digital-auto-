import { Env } from "../../../shared/types";
import {
  json,
  notFound,
  badRequest,
  serverError,
  generateId,
  parseJsonBody,
  validateFields,
} from "../../../shared/utils";

// ── Create Review ──────────────────────────────────────────

export async function createReview(
  request: Request,
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    const product = await env.DB.prepare(
      "SELECT * FROM products WHERE id = ?",
    )
      .bind(productId)
      .first();
    if (!product) return notFound(`Product not found: ${productId}`);

    const body = await parseJsonBody(request);
    if (!body) return badRequest("Invalid or empty JSON body.");

    const errors = validateFields(body, [
      { field: "reviewer_type", required: true, type: "string" },
    ]);
    if (errors.length > 0) return badRequest(errors.join(" "));

    const reviewerType = body.reviewer_type as string;
    if (!["ai", "boss"].includes(reviewerType)) {
      return badRequest("reviewer_type must be one of: ai, boss");
    }

    const id = generateId("rev_");
    const version = (product.current_version as number) || 1;
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO reviews
        (id, product_id, version, reviewer_type, approval_status, issues_found, feedback, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
    )
      .bind(
        id,
        productId,
        version,
        reviewerType,
        (body.issues_found as string) || null,
        (body.feedback as string) || null,
        now,
      )
      .run();

    // Update product status
    await env.DB.prepare(
      "UPDATE products SET status = 'waiting_for_review', updated_at = ? WHERE id = ?",
    )
      .bind(now, productId)
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM reviews WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: created, message: `Review ${id} created.` }, 201);
  } catch (err) {
    console.error("[reviews/create]", err);
    return serverError("Failed to create review.");
  }
}

// ── List Reviews for a Product ─────────────────────────────

export async function listProductReviews(
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

    const reviews = await env.DB.prepare(
      "SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC",
    )
      .bind(productId)
      .all();

    return json({ data: reviews.results, total: reviews.results.length });
  } catch (err) {
    console.error("[reviews/list]", err);
    return serverError("Failed to list reviews.");
  }
}

// ── Approve Review ─────────────────────────────────────────

export async function approveReview(
  request: Request,
  env: Env,
  reviewId: string,
): Promise<Response> {
  try {
    const review = await env.DB.prepare(
      "SELECT * FROM reviews WHERE id = ?",
    )
      .bind(reviewId)
      .first();
    if (!review) return notFound(`Review not found: ${reviewId}`);

    if (review.approval_status === "approved") {
      return badRequest("Review is already approved.");
    }

    const body = await parseJsonBody(request);
    const now = new Date().toISOString();

    await env.DB.prepare(
      "UPDATE reviews SET approval_status = 'approved', feedback = COALESCE(?, feedback), created_at = created_at WHERE id = ?",
    )
      .bind((body?.feedback as string) || null, reviewId)
      .run();

    // Update product status based on reviewer type
    const productId = review.product_id as string;
    const reviewerType = review.reviewer_type as string;
    const version = review.version as number;

    if (reviewerType === "boss") {
      // Boss approval = final approval
      await env.DB.prepare(
        "UPDATE products SET status = 'approved', approved_version = ?, updated_at = ? WHERE id = ?",
      )
        .bind(version, now, productId)
        .run();
    } else {
      // AI review approved — move to boss approval stage
      await env.DB.prepare(
        "UPDATE products SET status = 'waiting_for_review', updated_at = ? WHERE id = ?",
      )
        .bind(now, productId)
        .run();
    }

    const updated = await env.DB.prepare(
      "SELECT * FROM reviews WHERE id = ?",
    )
      .bind(reviewId)
      .first();

    return json({
      data: updated,
      message: reviewerType === "boss"
        ? `Product ${productId} approved by Boss (v${version}).`
        : `AI review ${reviewId} approved. Awaiting Boss approval.`,
    });
  } catch (err) {
    console.error("[reviews/approve]", err);
    return serverError("Failed to approve review.");
  }
}

// ── Reject Review ──────────────────────────────────────────

export async function rejectReview(
  request: Request,
  env: Env,
  reviewId: string,
): Promise<Response> {
  try {
    const review = await env.DB.prepare(
      "SELECT * FROM reviews WHERE id = ?",
    )
      .bind(reviewId)
      .first();
    if (!review) return notFound(`Review not found: ${reviewId}`);

    const body = await parseJsonBody(request);
    if (!body) return badRequest("Invalid or empty JSON body.");

    const errors = validateFields(body, [
      { field: "feedback", required: true, type: "string" },
    ]);
    if (errors.length > 0) return badRequest(errors.join(" "));

    const now = new Date().toISOString();

    await env.DB.prepare(
      "UPDATE reviews SET approval_status = 'rejected', issues_found = ?, feedback = ? WHERE id = ?",
    )
      .bind(
        (body.issues_found as string) || null,
        body.feedback as string,
        reviewId,
      )
      .run();

    // Update product status
    const productId = review.product_id as string;
    await env.DB.prepare(
      "UPDATE products SET status = 'rejected', updated_at = ? WHERE id = ?",
    )
      .bind(now, productId)
      .run();

    const updated = await env.DB.prepare(
      "SELECT * FROM reviews WHERE id = ?",
    )
      .bind(reviewId)
      .first();

    return json({
      data: updated,
      message: `Review ${reviewId} rejected. Product marked as rejected.`,
    });
  } catch (err) {
    console.error("[reviews/reject]", err);
    return serverError("Failed to reject review.");
  }
}

// ── Request Revision ───────────────────────────────────────

export async function requestRevision(
  request: Request,
  env: Env,
  reviewId: string,
): Promise<Response> {
  try {
    const review = await env.DB.prepare(
      "SELECT * FROM reviews WHERE id = ?",
    )
      .bind(reviewId)
      .first();
    if (!review) return notFound(`Review not found: ${reviewId}`);

    const body = await parseJsonBody(request);
    if (!body) return badRequest("Invalid or empty JSON body.");

    const errors = validateFields(body, [
      { field: "feedback", required: true, type: "string" },
    ]);
    if (errors.length > 0) return badRequest(errors.join(" "));

    const now = new Date().toISOString();

    // Update review status
    await env.DB.prepare(
      "UPDATE reviews SET approval_status = 'revision_requested', feedback = ? WHERE id = ?",
    )
      .bind(body.feedback as string, reviewId)
      .run();

    // Create revision record
    const productId = review.product_id as string;
    const versionFrom = review.version as number;
    const versionTo = versionFrom + 1;
    const revisionId = generateId("revn_");

    await env.DB.prepare(
      `INSERT INTO revisions
        (id, product_id, version_from, version_to, revision_reason, boss_notes, changed_steps_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        revisionId,
        productId,
        versionFrom,
        versionTo,
        (body.revision_reason as string) || "Revision requested",
        body.feedback as string,
        (body.changed_steps_json as string) || null,
        now,
      )
      .run();

    // Bump product version and update status
    await env.DB.prepare(
      "UPDATE products SET status = 'revision_requested', current_version = ?, updated_at = ? WHERE id = ?",
    )
      .bind(versionTo, now, productId)
      .run();

    const revision = await env.DB.prepare(
      "SELECT * FROM revisions WHERE id = ?",
    )
      .bind(revisionId)
      .first();

    return json({
      data: {
        review_id: reviewId,
        revision: revision,
      },
      message: `Revision requested for product ${productId}. Version bumped to v${versionTo}.`,
    });
  } catch (err) {
    console.error("[reviews/revision]", err);
    return serverError("Failed to request revision.");
  }
}

// ── List All Pending Reviews ──────────────────────────────

export async function listPendingReviews(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const reviewerType = url.searchParams.get("reviewer_type");
    const status = url.searchParams.get("status") || "pending";

    let query = "SELECT r.*, p.idea, p.domain_id, p.status as product_status FROM reviews r JOIN products p ON r.product_id = p.id";
    const conditions: string[] = [];
    const binds: unknown[] = [];

    conditions.push("r.approval_status = ?");
    binds.push(status);

    if (reviewerType) {
      conditions.push("r.reviewer_type = ?");
      binds.push(reviewerType);
    }

    query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY r.created_at DESC";

    const stmt = env.DB.prepare(query);
    const result =
      binds.length > 0 ? await stmt.bind(...binds).all() : await stmt.all();

    return json({ data: result.results, total: result.results.length });
  } catch (err) {
    console.error("[reviews/list-pending]", err);
    return serverError("Failed to list pending reviews.");
  }
}
