import { emptyIcon } from "../ui";

export function renderSocialPage(): string {
  return `
    <div class="breadcrumb">
      <a href="/dashboard">Dashboard</a><span>/</span>Social Channels
    </div>
    <div class="empty-state">
      ${emptyIcon("share")}
      <h2>No Social Channels Configured</h2>
      <p>Social channels define the promotional outlets for your products (e.g. Instagram, TikTok, X, LinkedIn). Each channel has unique tone, hashtag rules, and length constraints for AI-generated content.</p>
    </div>
  `;
}
