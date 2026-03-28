import { ICONS } from "../ui";

export function renderHomePage(): string {
  return `
    <div class="card-grid">
      <div class="stat-card">
        <div class="stat-value">0</div>
        <div class="stat-label">Products</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">0</div>
        <div class="stat-label">Workflow Runs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">0</div>
        <div class="stat-label">Pending Reviews</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">0</div>
        <div class="stat-label">Published</div>
      </div>
    </div>

    <div class="card" style="margin-top:24px;">
      <div class="card-header">${ICONS.zap} Quick Actions</div>
      <p style="color:var(--text-secondary);font-size:14px;line-height:1.6;">
        Welcome to <strong>NEXUS</strong> — your dashboard-driven, AI-powered product operating system.
        Start by configuring your <a href="/dashboard/domains" style="color:var(--accent);">domains</a>,
        then create your first <a href="/dashboard/products" style="color:var(--accent);">product</a>.
      </p>
    </div>

    <div class="card">
      <div class="card-header">${ICONS.workflow} Recent Activity</div>
      <div class="empty-state" style="padding:32px;">
        <p style="color:var(--text-secondary);font-size:14px;">No activity yet. Create a product to get started.</p>
      </div>
    </div>
  `;
}
