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
        (id, product_id, version, reviewer_type, approval_status, issues_found, feedback, variant_ids_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        productId,
        version,
        reviewerType,
        (body.issues_found as string) || null,
        (body.feedback as string) || null,
        (body.variant_ids_json as string) || null,
        now,
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

// ── Get Single Review ──────────────────────────────────────

export async function getReview(
  env: Env,
  reviewId: string,
): Promise<Response> {
  try {
    const review = await env.DB.prepare(
      `SELECT r.*, p.idea as product_idea, p.status as product_status,
              p.current_version, p.approved_version, p.domain_id
       FROM reviews r
       JOIN products p ON r.product_id = p.id
       WHERE r.id = ?`,
    )
      .bind(reviewId)
      .first();
    if (!review) return notFound(`Review not found: ${reviewId}`);

    // Fetch comments for this review
    const comments = await env.DB.prepare(
      "SELECT * FROM review_comments WHERE review_id = ? ORDER BY created_at ASC",
    )
      .bind(reviewId)
      .all();

    // Fetch any revision triggered by this review
    const revision = await env.DB.prepare(
      "SELECT * FROM revisions WHERE review_id = ?",
    )
      .bind(reviewId)
      .first();

    // Fetch product variants for the review's version
    const variants = await env.DB.prepare(
      `SELECT pv.*, pl.name as platform_name, sc.name as social_channel_name
       FROM product_variants pv
       LEFT JOIN platforms pl ON pv.platform_id = pl.id
       LEFT JOIN social_channels sc ON pv.social_channel_id = sc.id
       WHERE pv.product_id = ? AND pv.version = ?
       ORDER BY pv.variant_type ASC`,
    )
      .bind(review.product_id as string, review.version as number)
      .all();

    return json({
      data: {
        review,
        comments: comments.results,
        revision,
        variants: variants.results,
      },
    });
  } catch (err) {
    console.error("[reviews/get]", err);
    return serverError("Failed to get review.");
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
    const feedback = (body?.feedback as string) || null;
    const variantIdsJson = (body?.variant_ids_json as string) || null;

    // Update review — supports "approve with notes" via optional feedback
    await env.DB.prepare(
      `UPDATE reviews
       SET approval_status = 'approved',
           feedback = COALESCE(?, feedback),
           variant_ids_json = COALESCE(?, variant_ids_json),
           updated_at = ?
       WHERE id = ?`,
    )
      .bind(feedback, variantIdsJson, now, reviewId)
      .run();

    // If boss provided notes with approval, store as a comment
    if (feedback) {
      const commentId = generateId("rc_");
      await env.DB.prepare(
        `INSERT INTO review_comments (id, review_id, author_type, comment, created_at)
         VALUES (?, ?, 'boss', ?, ?)`,
      )
        .bind(commentId, reviewId, feedback, now)
        .run();
    }

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
      `UPDATE reviews
       SET approval_status = 'rejected',
           issues_found = ?,
           feedback = ?,
           updated_at = ?
       WHERE id = ?`,
    )
      .bind(
        (body.issues_found as string) || null,
        body.feedback as string,
        now,
        reviewId,
      )
      .run();

    // Store rejection notes as a comment for audit trail
    const commentId = generateId("rc_");
    await env.DB.prepare(
      `INSERT INTO review_comments (id, review_id, author_type, comment, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        commentId,
        reviewId,
        review.reviewer_type as string,
        body.feedback as string,
        now,
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
      `UPDATE reviews
       SET approval_status = 'revision_requested',
           feedback = ?,
           updated_at = ?
       WHERE id = ?`,
    )
      .bind(body.feedback as string, now, reviewId)
      .run();

    // Store revision notes as a comment
    const commentId = generateId("rc_");
    await env.DB.prepare(
      `INSERT INTO review_comments (id, review_id, author_type, comment, created_at)
       VALUES (?, ?, 'boss', ?, ?)`,
    )
      .bind(commentId, reviewId, body.feedback as string, now)
      .run();

    // Create revision record
    const productId = review.product_id as string;
    const versionFrom = review.version as number;
    const versionTo = versionFrom + 1;
    const revisionId = generateId("revn_");

    await env.DB.prepare(
      `INSERT INTO revisions
        (id, product_id, version_from, version_to, revision_reason, boss_notes,
         changed_steps_json, regenerate_targets_json, review_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        revisionId,
        productId,
        versionFrom,
        versionTo,
        (body.revision_reason as string) || "Revision requested",
        body.feedback as string,
        (body.changed_steps_json as string) || null,
        (body.regenerate_targets_json as string) || null,
        reviewId,
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

// ── Add Review Comment ────────────────────────────────────

export async function addReviewComment(
  request: Request,
  env: Env,
  reviewId: string,
): Promise<Response> {
  try {
    const review = await env.DB.prepare(
      "SELECT id FROM reviews WHERE id = ?",
    )
      .bind(reviewId)
      .first();
    if (!review) return notFound(`Review not found: ${reviewId}`);

    const body = await parseJsonBody(request);
    if (!body) return badRequest("Invalid or empty JSON body.");

    const errors = validateFields(body, [
      { field: "comment", required: true, type: "string" },
    ]);
    if (errors.length > 0) return badRequest(errors.join(" "));

    const id = generateId("rc_");
    const authorType = (body.author_type as string) || "boss";
    if (!["boss", "ai", "system"].includes(authorType)) {
      return badRequest("author_type must be one of: boss, ai, system");
    }

    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO review_comments (id, review_id, author_type, comment, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(id, reviewId, authorType, body.comment as string, now)
      .run();

    const created = await env.DB.prepare(
      "SELECT * FROM review_comments WHERE id = ?",
    )
      .bind(id)
      .first();

    return json({ data: created, message: `Comment ${id} added.` }, 201);
  } catch (err) {
    console.error("[reviews/add-comment]", err);
    return serverError("Failed to add review comment.");
  }
}

// ── List Review Comments ──────────────────────────────────

export async function listReviewComments(
  env: Env,
  reviewId: string,
): Promise<Response> {
  try {
    const review = await env.DB.prepare(
      "SELECT id FROM reviews WHERE id = ?",
    )
      .bind(reviewId)
      .first();
    if (!review) return notFound(`Review not found: ${reviewId}`);

    const comments = await env.DB.prepare(
      "SELECT * FROM review_comments WHERE review_id = ? ORDER BY created_at ASC",
    )
      .bind(reviewId)
      .all();

    return json({ data: comments.results, total: comments.results.length });
  } catch (err) {
    console.error("[reviews/list-comments]", err);
    return serverError("Failed to list review comments.");
  }
}

// ── List Revisions for a Product ──────────────────────────

export async function listProductRevisions(
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

    const revisions = await env.DB.prepare(
      "SELECT * FROM revisions WHERE product_id = ? ORDER BY version_to DESC",
    )
      .bind(productId)
      .all();

    return json({ data: revisions.results, total: revisions.results.length });
  } catch (err) {
    console.error("[reviews/list-revisions]", err);
    return serverError("Failed to list revisions.");
  }
}

// ── Product Version History ───────────────────────────────

export async function getProductVersionHistory(
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

    // Get all reviews for the product
    const reviews = await env.DB.prepare(
      "SELECT * FROM reviews WHERE product_id = ? ORDER BY version ASC, created_at ASC",
    )
      .bind(productId)
      .all();

    // Get all revisions for the product
    const revisions = await env.DB.prepare(
      "SELECT * FROM revisions WHERE product_id = ? ORDER BY version_from ASC, created_at ASC",
    )
      .bind(productId)
      .all();

    // Get all variants grouped by version
    const variants = await env.DB.prepare(
      `SELECT pv.*, pl.name as platform_name, sc.name as social_channel_name
       FROM product_variants pv
       LEFT JOIN platforms pl ON pv.platform_id = pl.id
       LEFT JOIN social_channels sc ON pv.social_channel_id = sc.id
       WHERE pv.product_id = ?
       ORDER BY pv.version ASC, pv.variant_type ASC`,
    )
      .bind(productId)
      .all();

    // Build version timeline
    const versions: Record<string, {
      version: number;
      reviews: unknown[];
      revisions: unknown[];
      variants: unknown[];
    }> = {};

    // Group variants by version
    for (const v of variants.results) {
      const ver = String(v.version);
      if (!versions[ver]) {
        versions[ver] = { version: v.version as number, reviews: [], revisions: [], variants: [] };
      }
      versions[ver].variants.push(v);
    }

    // Group reviews by version
    for (const r of reviews.results) {
      const ver = String(r.version);
      if (!versions[ver]) {
        versions[ver] = { version: r.version as number, reviews: [], revisions: [], variants: [] };
      }
      versions[ver].reviews.push(r);
    }

    // Group revisions by version_from
    for (const rv of revisions.results) {
      const ver = String(rv.version_from);
      if (!versions[ver]) {
        versions[ver] = { version: rv.version_from as number, reviews: [], revisions: [], variants: [] };
      }
      versions[ver].revisions.push(rv);
    }

    return json({
      data: {
        product,
        current_version: product.current_version,
        approved_version: product.approved_version,
        versions,
      },
    });
  } catch (err) {
    console.error("[reviews/version-history]", err);
    return serverError("Failed to get version history.");
  }
}
