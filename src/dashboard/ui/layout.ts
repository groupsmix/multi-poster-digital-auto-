/**
 * Dashboard HTML layout shell.
 * Renders the sidebar, topbar, and wraps page content.
 */
import { DASHBOARD_CSS } from "./styles";
import { ICONS } from "./icons";

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  section?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { path: "/dashboard", label: "Home", icon: ICONS.home },
  { path: "/dashboard/domains", label: "Domains", icon: ICONS.globe, section: "Content" },
  { path: "/dashboard/products", label: "Products", icon: ICONS.package },
  { path: "/dashboard/workflows", label: "Workflow Runs", icon: ICONS.workflow },
  { path: "/dashboard/platforms", label: "Platforms", icon: ICONS.monitor, section: "Distribution" },
  { path: "/dashboard/social", label: "Social Channels", icon: ICONS.share },
  { path: "/dashboard/prompts", label: "Prompt Studio", icon: ICONS.fileText, section: "AI Engine" },
  { path: "/dashboard/router", label: "AI Router", icon: ICONS.cpu },
  { path: "/dashboard/reviews", label: "Review Center", icon: ICONS.checkCircle, section: "Quality" },
  { path: "/dashboard/assets", label: "Assets Library", icon: ICONS.image, section: "Publishing" },
  { path: "/dashboard/publish", label: "Publish Center", icon: ICONS.send },
  { path: "/dashboard/settings", label: "Settings", icon: ICONS.settings, section: "System" },
];

export interface PageMeta {
  title: string;
  activePath: string;
  environment: string;
}

export function renderLayout(meta: PageMeta, bodyHtml: string): string {
  const sidebarLinks = NAV_ITEMS.map((item) => {
    const isActive = meta.activePath === item.path;
    const sectionHeader = item.section
      ? `<div class="sidebar-section">${item.section}</div>`
      : "";
    return `${sectionHeader}<a href="${item.path}" class="${isActive ? "active" : ""}"><span class="nav-icon">${item.icon}</span>${item.label}</a>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title} — NEXUS</title>
  <style>${DASHBOARD_CSS}</style>
</head>
<body>
  <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <span>${ICONS.zap}</span> NEXUS
    </div>
    <nav class="sidebar-nav">
      ${sidebarLinks}
    </nav>
    <div class="sidebar-footer">
      NEXUS v0.1.0 &middot; ${meta.environment}
    </div>
  </aside>

  <div class="main">
    <header class="topbar">
      <div style="display:flex;align-items:center;gap:12px;">
        <button class="hamburger" onclick="toggleSidebar()" aria-label="Menu">${ICONS.menu}</button>
        <span class="topbar-title">${meta.title}</span>
      </div>
      <span class="topbar-env">${meta.environment}</span>
    </header>
    <div class="content">
      ${bodyHtml}
    </div>
  </div>

  <script>
    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebarOverlay').classList.toggle('open');
    }
  </script>
</body>
</html>`;
}
