import { emptyIcon } from "../ui";

export function renderProductsPage(): string {
  return `
    <div class="breadcrumb">
      <a href="/dashboard">Dashboard</a><span>/</span>Products
    </div>
    <div class="empty-state">
      ${emptyIcon("package")}
      <h2>No Products Yet</h2>
      <p>Products are the core units of work in NEXUS. Each product goes through a multi-step AI workflow from idea to publication. Create your first product to begin.</p>
    </div>
  `;
}
