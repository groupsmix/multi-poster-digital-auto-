import { Env } from "../../shared/types";
import { renderLayout } from "../ui/layout";
import type { PageMeta } from "../ui/layout";
import {
  renderHomePage,
  renderDomainsPage,
  renderProductsPage,
  renderWorkflowsPage,
  renderPlatformsPage,
  renderSocialPage,
  renderPromptsPage,
  renderRouterPage,
  renderReviewsPage,
  renderAssetsPage,
  renderPublishPage,
  renderSettingsPage,
} from "../pages";

/**
 * Dashboard shell router — handles all requests under /dashboard/*.
 * Serves server-rendered HTML pages with sidebar navigation.
 */

interface PageDef {
  title: string;
  render: () => string;
}

const PAGES: Record<string, PageDef> = {
  "/dashboard":           { title: "Home",            render: renderHomePage },
  "/dashboard/domains":   { title: "Domains",         render: renderDomainsPage },
  "/dashboard/products":  { title: "Products",        render: renderProductsPage },
  "/dashboard/workflows": { title: "Workflow Runs",   render: renderWorkflowsPage },
  "/dashboard/platforms": { title: "Platforms",        render: renderPlatformsPage },
  "/dashboard/social":    { title: "Social Channels",  render: renderSocialPage },
  "/dashboard/prompts":   { title: "Prompt Studio",   render: renderPromptsPage },
  "/dashboard/router":    { title: "AI Router",       render: renderRouterPage },
  "/dashboard/reviews":   { title: "Review Center",   render: renderReviewsPage },
  "/dashboard/assets":    { title: "Assets Library",  render: renderAssetsPage },
  "/dashboard/publish":   { title: "Publish Center",  render: renderPublishPage },
  "/dashboard/settings":  { title: "Settings",        render: renderSettingsPage },
};

export async function handleDashboardRequest(
  _request: Request,
  env: Env,
  path: string,
): Promise<Response> {
  // Normalize trailing slash
  const normalizedPath = path.endsWith("/") && path !== "/dashboard/"
    ? path.slice(0, -1)
    : path === "/dashboard/" ? "/dashboard" : path;

  // Match a sub-route prefix (e.g. /dashboard/domains/anything → domains page)
  let matchedPath = normalizedPath;
  if (!PAGES[matchedPath]) {
    for (const key of Object.keys(PAGES)) {
      if (key !== "/dashboard" && normalizedPath.startsWith(key + "/")) {
        matchedPath = key;
        break;
      }
    }
  }

  const page = PAGES[matchedPath];
  if (!page) {
    // 404 page
    const meta: PageMeta = {
      title: "Not Found",
      activePath: "",
      environment: env.ENVIRONMENT ?? "development",
    };
    const body = `
      <div class="empty-state">
        <div class="empty-state-icon" style="font-size:48px;">404</div>
        <h2>Page Not Found</h2>
        <p>The dashboard page <code>${path}</code> does not exist. Use the sidebar to navigate to an available section.</p>
      </div>
    `;
    return new Response(renderLayout(meta, body), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const meta: PageMeta = {
    title: page.title,
    activePath: matchedPath,
    environment: env.ENVIRONMENT ?? "development",
  };

  return new Response(renderLayout(meta, page.render()), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
