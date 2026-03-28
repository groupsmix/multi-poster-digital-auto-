import { emptyIcon } from "../ui";

export function renderPublishPage(): string {
  return `
    <div class="breadcrumb">
      <a href="/dashboard">Dashboard</a><span>/</span>Publish Center
    </div>
    <div class="empty-state">
      ${emptyIcon("send")}
      <h2>Publish Center</h2>
      <p>Schedule and track publishing jobs for approved products. Each job targets a specific platform and can be queued, retried, or cancelled. Publishing status and history will appear here.</p>
    </div>
  `;
}
