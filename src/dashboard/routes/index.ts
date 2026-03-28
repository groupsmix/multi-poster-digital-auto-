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

  // ── Placeholder for all other sub-routes ──────────────
  const subRoutes = [
    "categories",
    "products",
    "workflows",
    "router",
    "reviews",
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
