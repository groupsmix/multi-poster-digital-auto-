import { emptyIcon } from "../ui";

export function renderDomainsPage(): string {
  return `
    <div class="breadcrumb">
      <a href="/dashboard">Dashboard</a><span>/</span>Domains
    </div>
    <div class="empty-state">
      ${emptyIcon("globe")}
      <h2>No Domains Configured</h2>
      <p>Domains define the business verticals for your products (e.g. Digital Products, Print-on-Demand). Add your first domain to get started.</p>
    </div>
  `;
}
