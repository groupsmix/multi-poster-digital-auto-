import { Env } from "../../shared/types";
import { json, notFound, serverError } from "../../shared/utils";
import { APP, ASSET_TYPES, EXPORT_FORMATS } from "../../config";

/**
 * Dashboard shell router — handles all requests under /dashboard/*.
 *
 * For now returns a JSON shell response.
 * Will serve the SPA / SSR frontend in future tasks.
 */
export async function handleDashboardRequest(
  _request: Request,
  env: Env,
  path: string,
): Promise<Response> {
  // ── Home — domain cards pulled from DB ────────────────
  if (path === "/dashboard" || path === "/dashboard/") {
    return handleDashboardHome(env);
  }

  // ── Domains list ──────────────────────────────────────
  if (path === "/dashboard/domains" || path === "/dashboard/domains/") {
    return handleDashboardDomains(env);
  }

  // ── Domain detail — shows categories for that domain ──
  const domainDetailMatch = path.match(
    /^\/dashboard\/domains\/([^/]+)$/,
  );
  if (domainDetailMatch) {
    return handleDashboardDomainDetail(env, domainDetailMatch[1]);
  }

  // ── Platforms list ────────────────────────────────────
  if (path === "/dashboard/platforms" || path === "/dashboard/platforms/") {
    return handleDashboardPlatforms(env);
  }

  // ── Social channels list ──────────────────────────────
  if (path === "/dashboard/social" || path === "/dashboard/social/") {
    return handleDashboardSocialChannels(env);
  }

  // ── Prompt Studio ──────────────────────────────────────
  if (path === "/dashboard/prompts" || path === "/dashboard/prompts/") {
    return handleDashboardPrompts(env);
  }

  // ── AI Router ────────────────────────────────────────
  if (path === "/dashboard/router" || path === "/dashboard/router/") {
    return handleDashboardRouter(env);
  }

  // ── Products ─────────────────────────────────────────────
  if (path === "/dashboard/products" || path === "/dashboard/products/") {
    return handleDashboardProducts(env);
  }

  // ── Workflows ───────────────────────────────────────────
  if (path === "/dashboard/workflows" || path === "/dashboard/workflows/") {
    return handleDashboardWorkflows(env);
  }

  // ── Reviews ─────────────────────────────────────────────
  if (path === "/dashboard/reviews" || path === "/dashboard/reviews/") {
    return handleDashboardReviews(env);
  }

  // ── Review Detail ───────────────────────────────────────
  const reviewDetailMatch = path.match(
    /^\/dashboard\/reviews\/([^/]+)$/,
  );
  if (reviewDetailMatch) {
    return handleDashboardReviewDetail(env, reviewDetailMatch[1]);
  }

  // ── Product Version History ─────────────────────────────
  const productHistoryMatch = path.match(
    /^\/dashboard\/products\/([^/]+)\/history$/,
  );
  if (productHistoryMatch) {
    return handleDashboardProductHistory(env, productHistoryMatch[1]);
  }

  // ── Exports ──────────────────────────────────────────
  if (path === "/dashboard/exports" || path === "/dashboard/exports/") {
    return handleDashboardExports(env);
  }

  // ── Assets Library ────────────────────────────────────
  if (path === "/dashboard/assets" || path === "/dashboard/assets/") {
    return handleDashboardAssets(env);
  }

  const assetDetailMatch = path.match(
    /^\/dashboard\/assets\/([^/]+)$/,
  );
  if (assetDetailMatch) {
    return handleDashboardAssetDetail(env, assetDetailMatch[1]);
  }

  // ── Placeholder for remaining sub-routes ────────────────
  const subRoutes = [
    "categories",
    "publish",
    "settings",
  ];

  for (const route of subRoutes) {
    if (path === `/dashboard/${route}` || path.startsWith(`/dashboard/${route}/`)) {
      return json({
        app: APP.NAME,
        section: route,
        message: `${route} section placeholder. Implementation pending.`,
      });
    }
  }

  return notFound(`Dashboard route not found: ${path}`);
}

// ── Dashboard Home — domain cards ───────────────────────

async function handleDashboardHome(env: Env): Promise<Response> {
  try {
    const domains = await env.DB.prepare(
      "SELECT id, name, slug, icon, description, sort_order FROM domains WHERE is_active = 1 ORDER BY sort_order ASC, name ASC",
    ).all();

    return json({
      app: APP.NAME,
      section: "dashboard",
      environment: env.ENVIRONMENT,
      message: "Dashboard home — click a domain card to open it.",
      cards: domains.results,
      routes: [
        "/dashboard",
        "/dashboard/domains",
        "/dashboard/categories",
        "/dashboard/products",
        "/dashboard/workflows",
        "/dashboard/platforms",
        "/dashboard/social",
        "/dashboard/prompts",
        "/dashboard/router",
        "/dashboard/reviews",
        "/dashboard/assets",
        "/dashboard/exports",
        "/dashboard/publish",
        "/dashboard/settings",
      ],
    });
  } catch (err) {
    console.error("[dashboard/home]", err);
    return serverError("Failed to load dashboard home.");
  }
}

// ── Domains list ────────────────────────────────────────

async function handleDashboardDomains(env: Env): Promise<Response> {
  try {
    const domains = await env.DB.prepare(
      "SELECT * FROM domains ORDER BY sort_order ASC, name ASC",
    ).all();

    return json({
      app: APP.NAME,
      section: "domains",
      message: "All domain cards. Use the API to add, edit, or remove domains.",
      domains: domains.results,
      total: domains.results.length,
      api: {
        list: "GET /api/domains",
        create: "POST /api/domains",
        get: "GET /api/domains/:id",
        update: "PUT /api/domains/:id",
        delete: "DELETE /api/domains/:id",
      },
    });
  } catch (err) {
    console.error("[dashboard/domains]", err);
    return serverError("Failed to load domains.");
  }
}

// ── Domain detail — categories within a domain ──────────

async function handleDashboardDomainDetail(
  env: Env,
  idOrSlug: string,
): Promise<Response> {
  try {
    // Support lookup by ID or slug
    const domain = await env.DB.prepare(
      "SELECT * FROM domains WHERE id = ? OR slug = ?",
    )
      .bind(idOrSlug, idOrSlug)
      .first();

    if (!domain) {
      return notFound(`Domain not found: ${idOrSlug}`);
    }

    const categories = await env.DB.prepare(
      "SELECT * FROM categories WHERE domain_id = ? AND is_active = 1 ORDER BY sort_order ASC, name ASC",
    )
      .bind(domain.id)
      .all();

    return json({
      app: APP.NAME,
      section: "domain-detail",
      domain,
      categories: categories.results,
      total_categories: categories.results.length,
      api: {
        list_categories: `GET /api/domains/${domain.id}/categories`,
        create_category: "POST /api/categories",
        update_domain: `PUT /api/domains/${domain.id}`,
      },
    });
  } catch (err) {
    console.error("[dashboard/domain-detail]", err);
    return serverError("Failed to load domain detail.");
  }
}

// ── Platforms list ──────────────────────────────────────

async function handleDashboardPlatforms(env: Env): Promise<Response> {
  try {
    const platforms = await env.DB.prepare(
      "SELECT * FROM platforms ORDER BY sort_order ASC, name ASC",
    ).all();

    return json({
      app: APP.NAME,
      section: "platforms",
      message: "All platforms. Use the API to add, edit, or remove platforms.",
      platforms: platforms.results,
      total: platforms.results.length,
      api: {
        list: "GET /api/platforms",
        create: "POST /api/platforms",
        get: "GET /api/platforms/:id",
        update: "PUT /api/platforms/:id",
        delete: "DELETE /api/platforms/:id",
      },
    });
  } catch (err) {
    console.error("[dashboard/platforms]", err);
    return serverError("Failed to load platforms.");
  }
}

// ── Social channels list ────────────────────────────────

async function handleDashboardSocialChannels(env: Env): Promise<Response> {
  try {
    const channels = await env.DB.prepare(
      "SELECT * FROM social_channels ORDER BY sort_order ASC, name ASC",
    ).all();

    return json({
      app: APP.NAME,
      section: "social",
      message: "All social channels. Use the API to add, edit, or remove channels.",
      social_channels: channels.results,
      total: channels.results.length,
      api: {
        list: "GET /api/social-channels",
        create: "POST /api/social-channels",
        get: "GET /api/social-channels/:id",
        update: "PUT /api/social-channels/:id",
        delete: "DELETE /api/social-channels/:id",
      },
    });
  } catch (err) {
    console.error("[dashboard/social]", err);
    return serverError("Failed to load social channels.");
  }
}

// ── AI Router ──────────────────────────────────────────

async function handleDashboardRouter(env: Env): Promise<Response> {
  try {
    const result = await env.DB.prepare(
      `SELECT * FROM provider_configs
       WHERE is_active = 1
       ORDER BY task_lane ASC, tier ASC, priority ASC`,
    ).all();

    // Group by task lane
    const lanes: Record<string, unknown[]> = {};
    for (const row of result.results) {
      const lane = row.task_lane as string;
      if (!lanes[lane]) lanes[lane] = [];

      // Resolve cooldown in-memory
      const state = row.state as string;
      const cooldownUntil = row.cooldown_until as string | null;
      let effectiveState = state;
      if (
        (state === "cooldown" || state === "rate_limited") &&
        cooldownUntil &&
        new Date(cooldownUntil) <= new Date()
      ) {
        effectiveState = "active";
      }

      lanes[lane].push({
        ...row,
        effective_state: effectiveState,
      });
    }

    return json({
      app: APP.NAME,
      section: "router",
      message: "AI Router — provider states grouped by task lane.",
      lanes,
      lane_names: Object.keys(lanes),
      total_providers: result.results.length,
      api: {
        list: "GET /api/providers",
        get: "GET /api/providers/:id",
        create: "POST /api/providers",
        update: "PUT /api/providers/:id",
        delete: "DELETE /api/providers/:id",
        sleep: "POST /api/providers/:id/sleep",
        wake: "POST /api/providers/:id/wake",
        cooldown: "POST /api/providers/:id/cooldown",
        report_error: "POST /api/providers/:id/report-error",
        report_rate_limit: "POST /api/providers/:id/report-rate-limit",
        lanes: "GET /api/providers/lanes",
        lane_detail: "GET /api/providers/lanes/:lane",
        resolve: "GET /api/providers/resolve/:lane",
      },
    });
  } catch (err) {
    console.error("[dashboard/router]", err);
    return serverError("Failed to load AI router.");
  }
}

// ── Prompt Studio ───────────────────────────────────────

async function handleDashboardPrompts(env: Env): Promise<Response> {
  try {
    const prompts = await env.DB.prepare(
      "SELECT * FROM prompt_templates ORDER BY name ASC, version DESC",
    ).all();

    // Group by name for the dashboard view
    const grouped: Record<string, unknown[]> = {};
    for (const row of prompts.results) {
      const name = row.name as string;
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(row);
    }

    return json({
      app: APP.NAME,
      section: "prompts",
      message: "Prompt Studio — manage prompt templates and versions.",
      prompt_groups: grouped,
      total_templates: prompts.results.length,
      total_prompts: Object.keys(grouped).length,
      supported_roles: [
        "master",
        "researcher",
        "planner",
        "creator",
        "adapter",
        "marketing",
        "social",
        "reviewer",
      ],
      api: {
        list: "GET /api/prompts",
        create: "POST /api/prompts",
        get: "GET /api/prompts/:id",
        update: "PUT /api/prompts/:id",
        delete: "DELETE /api/prompts/:id",
        create_version: "POST /api/prompts/:id/version",
        activate: "POST /api/prompts/:id/activate",
      },
    });
  } catch (err) {
    console.error("[dashboard/prompts]", err);
    return serverError("Failed to load prompt templates.");
  }
}

// ── Products ───────────────────────────────────────────────

async function handleDashboardProducts(env: Env): Promise<Response> {
  try {
    const products = await env.DB.prepare(
      `SELECT p.*, d.name as domain_name, c.name as category_name
       FROM products p
       LEFT JOIN domains d ON p.domain_id = d.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = 1
       ORDER BY p.updated_at DESC`,
    ).all();

    // Group by status for dashboard view
    const byStatus: Record<string, unknown[]> = {};
    for (const row of products.results) {
      const status = row.status as string;
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(row);
    }

    return json({
      app: APP.NAME,
      section: "products",
      message: "Product pipeline — all products grouped by status.",
      products: products.results,
      by_status: byStatus,
      total: products.results.length,
      statuses: [
        "draft",
        "queued",
        "running",
        "waiting_for_review",
        "rejected",
        "revision_requested",
        "approved",
        "ready_to_publish",
        "publishing",
        "published",
        "archived",
        "failed",
      ],
      api: {
        list: "GET /api/products",
        create: "POST /api/products",
        get: "GET /api/products/:id",
        update: "PUT /api/products/:id",
        delete: "DELETE /api/products/:id",
        variants: "GET /api/products/:id/variants",
        create_variant: "POST /api/products/:id/variants",
        start_workflow: "POST /api/products/:id/workflows",
      },
    });
  } catch (err) {
    console.error("[dashboard/products]", err);
    return serverError("Failed to load products.");
  }
}

// ── Workflows ──────────────────────────────────────────────

async function handleDashboardWorkflows(env: Env): Promise<Response> {
  try {
    const runs = await env.DB.prepare(
      `SELECT wr.*, p.idea as product_idea, wt.name as template_name
       FROM workflow_runs wr
       JOIN products p ON wr.product_id = p.id
       LEFT JOIN workflow_templates wt ON wr.workflow_template_id = wt.id
       ORDER BY wr.started_at DESC
       LIMIT 50`,
    ).all();

    // Group by status
    const byStatus: Record<string, unknown[]> = {};
    for (const row of runs.results) {
      const status = row.status as string;
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(row);
    }

    return json({
      app: APP.NAME,
      section: "workflows",
      message: "Workflow runs — recent runs grouped by status.",
      runs: runs.results,
      by_status: byStatus,
      total: runs.results.length,
      run_statuses: [
        "queued",
        "running",
        "completed",
        "failed",
        "failed_partial",
        "cancelled",
      ],
      api: {
        list: "GET /api/workflows",
        get: "GET /api/workflows/:id",
        start: "POST /api/products/:id/workflows",
        complete_step: "POST /api/workflows/:runId/steps/:stepId/complete",
        fail_step: "POST /api/workflows/:runId/steps/:stepId/fail",
      },
    });
  } catch (err) {
    console.error("[dashboard/workflows]", err);
    return serverError("Failed to load workflow runs.");
  }
}

// ── Reviews — Boss Review Center ──────────────────────────

async function handleDashboardReviews(env: Env): Promise<Response> {
  try {
    const reviews = await env.DB.prepare(
      `SELECT r.*, p.idea as product_idea, p.status as product_status,
              p.current_version, p.approved_version, p.domain_id,
              d.name as domain_name
       FROM reviews r
       JOIN products p ON r.product_id = p.id
       LEFT JOIN domains d ON p.domain_id = d.id
       ORDER BY
         CASE r.approval_status
           WHEN 'pending' THEN 0
           WHEN 'revision_requested' THEN 1
           WHEN 'rejected' THEN 2
           WHEN 'approved' THEN 3
         END ASC,
         r.created_at DESC
       LIMIT 100`,
    ).all();

    // Group by approval_status
    const byStatus: Record<string, unknown[]> = {};
    for (const row of reviews.results) {
      const status = row.approval_status as string;
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(row);
    }

    const pendingCount = (byStatus["pending"] || []).length;
    const revisionCount = (byStatus["revision_requested"] || []).length;

    return json({
      app: APP.NAME,
      section: "reviews",
      message: "Boss Review Center — approve, reject, or request revisions.",
      summary: {
        pending: pendingCount,
        revision_requested: revisionCount,
        rejected: (byStatus["rejected"] || []).length,
        approved: (byStatus["approved"] || []).length,
        total: reviews.results.length,
      },
      reviews: reviews.results,
      by_status: byStatus,
      total: reviews.results.length,
      pending_count: pendingCount,
      approval_statuses: [
        "pending",
        "approved",
        "rejected",
        "revision_requested",
      ],
      boss_actions: {
        approve: {
          description: "Approve the output as-is",
          endpoint: "POST /api/reviews/:id/approve",
          body: "{ } (empty body for plain approve)",
        },
        approve_with_notes: {
          description: "Approve but attach notes for future reference",
          endpoint: "POST /api/reviews/:id/approve",
          body: '{ "feedback": "Looks good, minor tweak on pricing later" }',
        },
        reject: {
          description: "Reject — product is marked as rejected",
          endpoint: "POST /api/reviews/:id/reject",
          body: '{ "feedback": "Title is off-brand", "issues_found": "branding" }',
        },
        request_revision: {
          description: "Send back for revision — creates revision record, bumps version",
          endpoint: "POST /api/reviews/:id/revision",
          body: '{ "feedback": "Fix the description", "regenerate_targets_json": "[\\"description\\", \\"etsy_variant\\"]" }',
        },
        add_comment: {
          description: "Add a comment to the review thread",
          endpoint: "POST /api/reviews/:id/comments",
          body: '{ "comment": "Check the pricing again", "author_type": "boss" }',
        },
      },
      api: {
        list_pending: "GET /api/reviews",
        list_by_status: "GET /api/reviews?status=rejected",
        list_by_reviewer: "GET /api/reviews?reviewer_type=boss",
        get_review: "GET /api/reviews/:id",
        create: "POST /api/products/:id/reviews",
        approve: "POST /api/reviews/:id/approve",
        reject: "POST /api/reviews/:id/reject",
        revision: "POST /api/reviews/:id/revision",
        add_comment: "POST /api/reviews/:id/comments",
        list_comments: "GET /api/reviews/:id/comments",
        product_revisions: "GET /api/products/:id/revisions",
        version_history: "GET /api/products/:id/version-history",
      },
      dashboard_links: {
        review_detail: "/dashboard/reviews/:id",
        product_history: "/dashboard/products/:id/history",
      },
    });
  } catch (err) {
    console.error("[dashboard/reviews]", err);
    return serverError("Failed to load reviews.");
  }
}

// ── Review Detail ────────────────────────────────────────────

async function handleDashboardReviewDetail(
  env: Env,
  reviewId: string,
): Promise<Response> {
  try {
    const review = await env.DB.prepare(
      `SELECT r.*, p.idea as product_idea, p.status as product_status,
              p.current_version, p.approved_version, p.domain_id,
              d.name as domain_name
       FROM reviews r
       JOIN products p ON r.product_id = p.id
       LEFT JOIN domains d ON p.domain_id = d.id
       WHERE r.id = ?`,
    )
      .bind(reviewId)
      .first();

    if (!review) {
      return notFound(`Review not found: ${reviewId}`);
    }

    // Fetch comments
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

    // Fetch product variants at the review's version
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

    // Fetch prior reviews for version history context
    const priorReviews = await env.DB.prepare(
      `SELECT id, version, reviewer_type, approval_status, created_at
       FROM reviews
       WHERE product_id = ? AND id != ?
       ORDER BY version DESC, created_at DESC`,
    )
      .bind(review.product_id as string, reviewId)
      .all();

    return json({
      app: APP.NAME,
      section: "review-detail",
      review,
      comments: comments.results,
      total_comments: comments.results.length,
      revision,
      variants: variants.results,
      prior_reviews: priorReviews.results,
      available_actions: getAvailableActions(review.approval_status as string, reviewId),
      api: {
        approve: `POST /api/reviews/${reviewId}/approve`,
        reject: `POST /api/reviews/${reviewId}/reject`,
        revision: `POST /api/reviews/${reviewId}/revision`,
        add_comment: `POST /api/reviews/${reviewId}/comments`,
        version_history: `GET /api/products/${review.product_id}/version-history`,
      },
    });
  } catch (err) {
    console.error("[dashboard/review-detail]", err);
    return serverError("Failed to load review detail.");
  }
}

// ── Product Version History ──────────────────────────────────

async function handleDashboardProductHistory(
  env: Env,
  productId: string,
): Promise<Response> {
  try {
    const product = await env.DB.prepare(
      `SELECT p.*, d.name as domain_name, c.name as category_name
       FROM products p
       LEFT JOIN domains d ON p.domain_id = d.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
    )
      .bind(productId)
      .first();

    if (!product) {
      return notFound(`Product not found: ${productId}`);
    }

    // Get all reviews
    const reviews = await env.DB.prepare(
      "SELECT * FROM reviews WHERE product_id = ? ORDER BY version ASC, created_at ASC",
    )
      .bind(productId)
      .all();

    // Get all revisions
    const revisions = await env.DB.prepare(
      "SELECT * FROM revisions WHERE product_id = ? ORDER BY version_from ASC, created_at ASC",
    )
      .bind(productId)
      .all();

    // Build timeline entries
    const timeline: unknown[] = [];

    for (const r of reviews.results) {
      timeline.push({
        type: "review",
        version: r.version,
        status: r.approval_status,
        reviewer_type: r.reviewer_type,
        feedback: r.feedback,
        created_at: r.created_at,
        review_id: r.id,
      });
    }

    for (const rv of revisions.results) {
      timeline.push({
        type: "revision",
        version_from: rv.version_from,
        version_to: rv.version_to,
        reason: rv.revision_reason,
        boss_notes: rv.boss_notes,
        regenerate_targets: rv.regenerate_targets_json,
        created_at: rv.created_at,
        revision_id: rv.id,
      });
    }

    // Sort by created_at
    timeline.sort((a, b) => {
      const aTime = (a as Record<string, string>).created_at;
      const bTime = (b as Record<string, string>).created_at;
      return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
    });

    return json({
      app: APP.NAME,
      section: "product-history",
      product,
      current_version: product.current_version,
      approved_version: product.approved_version,
      timeline,
      total_reviews: reviews.results.length,
      total_revisions: revisions.results.length,
      api: {
        version_history: `GET /api/products/${productId}/version-history`,
        revisions: `GET /api/products/${productId}/revisions`,
        reviews: `GET /api/products/${productId}/reviews`,
      },
    });
  } catch (err) {
    console.error("[dashboard/product-history]", err);
    return serverError("Failed to load product history.");
  }
}

/**
 * Returns available boss actions based on review status.
 */
function getAvailableActions(
  status: string,
  reviewId: string,
): Record<string, { endpoint: string; method: string; description: string }> {
  const actions: Record<string, { endpoint: string; method: string; description: string }> = {};

  if (status === "pending") {
    actions.approve = {
      endpoint: `/api/reviews/${reviewId}/approve`,
      method: "POST",
      description: "Approve the output (optionally with notes)",
    };
    actions.reject = {
      endpoint: `/api/reviews/${reviewId}/reject`,
      method: "POST",
      description: "Reject the output (requires feedback)",
    };
    actions.request_revision = {
      endpoint: `/api/reviews/${reviewId}/revision`,
      method: "POST",
      description: "Request a revision (creates new version)",
    };
  }

  if (status === "rejected" || status === "revision_requested") {
    actions.approve = {
      endpoint: `/api/reviews/${reviewId}/approve`,
      method: "POST",
      description: "Override and approve",
    };
  }

  // Comments are always available
  actions.add_comment = {
    endpoint: `/api/reviews/${reviewId}/comments`,
    method: "POST",
    description: "Add a review comment",
  };

  return actions;
}

// ── Assets Library ──────────────────────────────────────────

async function handleDashboardAssets(env: Env): Promise<Response> {
  try {
    const assets = await env.DB.prepare(
      "SELECT * FROM assets WHERE is_active = 1 ORDER BY created_at DESC",
    ).all();

    // Group by type
    const byType: Record<string, unknown[]> = {};
    for (const row of assets.results) {
      const type = row.type as string;
      if (!byType[type]) byType[type] = [];
      byType[type].push(row);
    }

    // Group by product
    const byProduct: Record<string, unknown[]> = {};
    for (const row of assets.results) {
      const productId = (row.product_id as string) || "unlinked";
      if (!byProduct[productId]) byProduct[productId] = [];
      byProduct[productId].push(row);
    }

    return json({
      app: APP.NAME,
      section: "assets",
      message: "Asset Library — all assets grouped by type and product.",
      assets: assets.results,
      by_type: byType,
      by_product: byProduct,
      total: assets.results.length,
      supported_types: ASSET_TYPES,
      type_counts: Object.fromEntries(
        ASSET_TYPES.map((t) => [t, (byType[t] || []).length]),
      ),
      api: {
        list: "GET /api/assets",
        list_by_type: "GET /api/assets?type=image",
        list_by_product: "GET /api/products/:id/assets",
        get: "GET /api/assets/:id",
        upload: "POST /api/assets (multipart/form-data or application/json)",
        delete: "DELETE /api/assets/:id",
      },
    });
  } catch (err) {
    console.error("[dashboard/assets]", err);
    return serverError("Failed to load assets.");
  }
}

// ── Asset Detail ────────────────────────────────────────────

// ── Exports — exportable products ───────────────────────

async function handleDashboardExports(env: Env): Promise<Response> {
  try {
    const products = await env.DB.prepare(
      `SELECT p.*, d.name as domain_name, c.name as category_name
       FROM products p
       LEFT JOIN domains d ON p.domain_id = d.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.status IN ('approved', 'ready_to_publish')
       ORDER BY p.updated_at DESC`,
    ).all();

    // Group by status
    const byStatus: Record<string, unknown[]> = {};
    for (const row of products.results) {
      const status = row.status as string;
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(row);
    }

    return json({
      app: APP.NAME,
      section: "exports",
      message:
        "Export Center — export approved products as JSON, markdown, or ZIP manifest.",
      products: products.results,
      by_status: byStatus,
      total: products.results.length,
      export_formats: EXPORT_FORMATS,
      status_flow: {
        current: "approved",
        next: "ready_to_publish",
        description:
          "After export, mark as ready_to_publish to indicate the product is packaged and ready.",
      },
      api: {
        export: "GET /api/products/:id/export?format=json|markdown|zip_manifest",
        mark_ready: "POST /api/products/:id/ready-to-publish",
      },
    });
  } catch (err) {
    console.error("[dashboard/exports]", err);
    return serverError("Failed to load export center.");
  }
}

// ── Asset Detail ─────────────────────────────────────────

async function handleDashboardAssetDetail(
  env: Env,
  id: string,
): Promise<Response> {
  try {
    const asset = await env.DB.prepare(
      "SELECT * FROM assets WHERE id = ? AND is_active = 1",
    )
      .bind(id)
      .first();

    if (!asset) {
      return notFound(`Asset not found: ${id}`);
    }

    // Fetch product info if linked
    let product = null;
    if (asset.product_id) {
      product = await env.DB.prepare(
        "SELECT id, idea, status, domain_id FROM products WHERE id = ?",
      )
        .bind(asset.product_id)
        .first();
    }

    // Fetch sibling assets (same product)
    let siblings: unknown[] = [];
    if (asset.product_id) {
      const siblingResult = await env.DB.prepare(
        "SELECT id, filename, type, mime_type, file_size, created_at FROM assets WHERE product_id = ? AND is_active = 1 AND id != ? ORDER BY created_at DESC",
      )
        .bind(asset.product_id, id)
        .all();
      siblings = siblingResult.results;
    }

    return json({
      app: APP.NAME,
      section: "asset-detail",
      asset,
      product,
      siblings,
      sibling_count: siblings.length,
      api: {
        delete: `DELETE /api/assets/${id}`,
        product_assets: asset.product_id
          ? `GET /api/products/${asset.product_id}/assets`
          : null,
      },
    });
  } catch (err) {
    console.error("[dashboard/asset-detail]", err);
    return serverError("Failed to load asset detail.");
  }
}
