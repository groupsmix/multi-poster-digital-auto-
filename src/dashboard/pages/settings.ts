import { emptyIcon } from "../ui";

export function renderSettingsPage(): string {
  return `
    <div class="breadcrumb">
      <a href="/dashboard">Dashboard</a><span>/</span>Settings
    </div>
    <div class="empty-state">
      ${emptyIcon("settings")}
      <h2>Settings</h2>
      <p>Configure global system settings — API keys for paid providers, default workflow templates, notification preferences, and environment configuration.</p>
    </div>
  `;
}
