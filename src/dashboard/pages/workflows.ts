import { emptyIcon } from "../ui";

export function renderWorkflowsPage(): string {
  return `
    <div class="breadcrumb">
      <a href="/dashboard">Dashboard</a><span>/</span>Workflow Runs
    </div>
    <div class="empty-state">
      ${emptyIcon("workflow")}
      <h2>No Workflow Runs</h2>
      <p>Workflow runs track each product through the AI pipeline — research, planning, creation, adaptation, marketing, social, review, and boss approval. Runs will appear here once you start processing products.</p>
    </div>
  `;
}
