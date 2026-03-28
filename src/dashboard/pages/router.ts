import { emptyIcon } from "../ui";

export function renderRouterPage(): string {
  return `
    <div class="breadcrumb">
      <a href="/dashboard">Dashboard</a><span>/</span>AI Router
    </div>
    <div class="empty-state">
      ${emptyIcon("cpu")}
      <h2>AI Router</h2>
      <p>Configure AI provider routing by task lane. The router uses free-first selection — Workers AI and free providers are used by default. Paid providers (OpenAI, Anthropic) stay sleeping until an API key is provided.</p>
    </div>
  `;
}
