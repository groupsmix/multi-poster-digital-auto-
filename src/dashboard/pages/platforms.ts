import { emptyIcon } from "../ui";

export function renderPlatformsPage(): string {
  return `
    <div class="breadcrumb">
      <a href="/dashboard">Dashboard</a><span>/</span>Platforms
    </div>
    <div class="empty-state">
      ${emptyIcon("monitor")}
      <h2>No Platforms Configured</h2>
      <p>Platforms are the marketplaces and storefronts where your products are listed (e.g. Etsy, Gumroad, Shopify). Each platform has its own tone profile, title limits, and CTA style for content adaptation.</p>
    </div>
  `;
}
