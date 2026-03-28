import { emptyIcon } from "../ui";

export function renderReviewsPage(): string {
  return `
    <div class="breadcrumb">
      <a href="/dashboard">Dashboard</a><span>/</span>Review Center
    </div>
    <div class="empty-state">
      ${emptyIcon("checkCircle")}
      <h2>Review Center</h2>
      <p>All products pass through automated review and Boss/CEO approval before publishing. Reviews check quality, completeness, platform fit, SEO strength, tone, and policy compliance. Pending reviews will appear here.</p>
    </div>
  `;
}
