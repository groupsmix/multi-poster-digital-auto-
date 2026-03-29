import { Env } from "../../shared/types";
import { json, notFound, serverError } from "../../shared/utils";
import { APP } from "../../config";

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

  // ── Placeholder for remaining sub-routes ────────────────
  const subRoutes = [
    "categories",
    "assets",
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

// ── Reviews ────────────────────────────────────────────────

async function handleDashboardReviews(env: Env): Promise<Response> {
  try {
    const reviews = await env.DB.prepare(
      `SELECT r.*, p.idea as product_idea, p.status as product_status
       FROM reviews r
       JOIN products p ON r.product_id = p.id
       ORDER BY r.created_at DESC
       LIMIT 50`,
    ).all();

    // Group by approval_status
    const byStatus: Record<string, unknown[]> = {};
    for (const row of reviews.results) {
      const status = row.approval_status as string;
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(row);
    }

    const pendingCount = (byStatus["pending"] || []).length;

    return json({
      app: APP.NAME,
      section: "reviews",
      message: "Boss Review Center — approve, reject, or request revisions.",
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
      api: {
        list_pending: "GET /api/reviews",
        create: "POST /api/products/:id/reviews",
        approve: "POST /api/reviews/:id/approve",
        reject: "POST /api/reviews/:id/reject",
        revision: "POST /api/reviews/:id/revision",
      },
    });
  } catch (err) {
    console.error("[dashboard/reviews]", err);
    return serverError("Failed to load reviews.");
  }
}
