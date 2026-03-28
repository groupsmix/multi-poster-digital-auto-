import { Env } from "../../shared/types";
import { json, notFound } from "../../shared/utils";
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
  // Shell endpoint — confirms dashboard route is reachable
  if (path === "/dashboard" || path === "/dashboard/") {
    return json({
      app: APP.NAME,
      section: "dashboard",
      environment: env.ENVIRONMENT,
      message: "Dashboard shell ready. UI will be served here.",
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
  }

  // Placeholder for all sub-routes — returns route info
  const subRoutes = [
    "domains",
    "categories",
    "products",
    "workflows",
    "platforms",
    "social",
    "prompts",
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
