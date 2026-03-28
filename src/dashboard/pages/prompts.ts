import { emptyIcon } from "../ui";

export function renderPromptsPage(): string {
  return `
    <div class="breadcrumb">
      <a href="/dashboard">Dashboard</a><span>/</span>Prompt Studio
    </div>
    <div class="empty-state">
      ${emptyIcon("fileText")}
      <h2>Prompt Studio</h2>
      <p>Design, version, and manage AI prompt templates for each role in the workflow — Researcher, Planner, Creator, Adapter, Marketing, Social, and Reviewer. Prompts are markdown-based and support domain, platform, and social scoping.</p>
    </div>
  `;
}
