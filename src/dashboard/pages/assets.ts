import { emptyIcon } from "../ui";

export function renderAssetsPage(): string {
  return `
    <div class="breadcrumb">
      <a href="/dashboard">Dashboard</a><span>/</span>Assets Library
    </div>
    <div class="empty-state">
      ${emptyIcon("image")}
      <h2>Assets Library</h2>
      <p>Manage images, files, and generated assets stored in R2. Assets are linked to products and variants for use across platforms and social channels.</p>
    </div>
  `;
}
