import { Env } from "../shared/types";
import { notFound } from "../shared/utils";
import {
  handleHealth,
  listDomains,
  getDomain,
  createDomain,
  updateDomain,
  deleteDomain,
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  listPlatforms,
  getPlatform,
  createPlatform,
  updatePlatform,
  deletePlatform,
  listSocialChannels,
  getSocialChannel,
  createSocialChannel,
  updateSocialChannel,
  deleteSocialChannel,
  listPromptTemplates,
  getPromptTemplate,
  createPromptTemplate,
  createPromptVersion,
  activatePromptVersion,
  updatePromptTemplate,
  deletePromptTemplate,
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  sleepProvider,
  wakeProvider,
  cooldownProvider,
  reportProviderError,
  reportProviderRateLimit,
  listTaskLanes,
  getTaskLane,
  resolveTaskLane,
  executeProviderChain,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  listProductVariants,
  createProductVariant,
  updateVariant,
  deleteVariant,
  startWorkflowRun,
  listWorkflowRuns,
  listProductWorkflowRuns,
  getWorkflowRun,
  completeWorkflowStep,
  failWorkflowStep,
  createReview,
  getReview,
  listProductReviews,
  approveReview,
  rejectReview,
  requestRevision,
  listPendingReviews,
  addReviewComment,
  listReviewComments,
  listProductRevisions,
  getProductVersionHistory,
  listAssets,
  listProductAssets,
  getAsset,
  uploadAsset,
  deleteAsset,
} from "./routes";

/**
 * API router — handles all requests under /api/*.
 *
 * Uses a simple URL + method match so we stay dependency-free.
 * Swap this for itty-router or Hono later if route count grows.
 */
export async function handleApiRequest(
  request: Request,
  env: Env,
  path: string,
): Promise<Response> {
  const method = request.method.toUpperCase();

  // ── Health ────────────────────────────────────────────
  if (path === "/api/health" && method === "GET") {
    return handleHealth(env);
  }

  // ── Domains ───────────────────────────────────────────
  if (path === "/api/domains" && method === "GET") {
    return listDomains(request, env);
  }
  if (path === "/api/domains" && method === "POST") {
    return createDomain(request, env);
  }

  const domainMatch = path.match(/^\/api\/domains\/([^/]+)$/);
  if (domainMatch) {
    const id = domainMatch[1];
    if (method === "GET") return getDomain(env, id);
    if (method === "PUT") return updateDomain(request, env, id);
    if (method === "DELETE") return deleteDomain(env, id);
  }

  // ── Categories ────────────────────────────────────────
  if (path === "/api/categories" && method === "GET") {
    return listCategories(request, env);
  }
  if (path === "/api/categories" && method === "POST") {
    return createCategory(request, env);
  }

  const categoryMatch = path.match(/^\/api\/categories\/([^/]+)$/);
  if (categoryMatch) {
    const id = categoryMatch[1];
    if (method === "GET") return getCategory(env, id);
    if (method === "PUT") return updateCategory(request, env, id);
    if (method === "DELETE") return deleteCategory(env, id);
  }

  // ── Domain → Categories shortcut ─────────────────────
  const domainCategoriesMatch = path.match(
    /^\/api\/domains\/([^/]+)\/categories$/,
  );
  if (domainCategoriesMatch && method === "GET") {
    const url = new URL(request.url);
    url.searchParams.set("domain_id", domainCategoriesMatch[1]);
    const syntheticRequest = new Request(url.toString(), request);
    return listCategories(syntheticRequest, env);
  }

  // ── Platforms ─────────────────────────────────────────
  if (path === "/api/platforms" && method === "GET") {
    return listPlatforms(request, env);
  }
  if (path === "/api/platforms" && method === "POST") {
    return createPlatform(request, env);
  }

  const platformMatch = path.match(/^\/api\/platforms\/([^/]+)$/);
  if (platformMatch) {
    const id = platformMatch[1];
    if (method === "GET") return getPlatform(env, id);
    if (method === "PUT") return updatePlatform(request, env, id);
    if (method === "DELETE") return deletePlatform(env, id);
  }

  // ── Social Channels ───────────────────────────────────
  if (path === "/api/social-channels" && method === "GET") {
    return listSocialChannels(request, env);
  }
  if (path === "/api/social-channels" && method === "POST") {
    return createSocialChannel(request, env);
  }

  const socialMatch = path.match(/^\/api\/social-channels\/([^/]+)$/);
  if (socialMatch) {
    const id = socialMatch[1];
    if (method === "GET") return getSocialChannel(env, id);
    if (method === "PUT") return updateSocialChannel(request, env, id);
    if (method === "DELETE") return deleteSocialChannel(env, id);
  }

  // ── Prompt Templates ────────────────────────────────────
  if (path === "/api/prompts" && method === "GET") {
    return listPromptTemplates(request, env);
  }
  if (path === "/api/prompts" && method === "POST") {
    return createPromptTemplate(request, env);
  }

  // POST /api/prompts/:id/version — create new version
  const promptVersionMatch = path.match(/^\/api\/prompts\/([^/]+)\/version$/);
  if (promptVersionMatch && method === "POST") {
    return createPromptVersion(request, env, promptVersionMatch[1]);
  }

  // POST /api/prompts/:id/activate — activate a version
  const promptActivateMatch = path.match(/^\/api\/prompts\/([^/]+)\/activate$/);
  if (promptActivateMatch && method === "POST") {
    return activatePromptVersion(env, promptActivateMatch[1]);
  }

  const promptMatch = path.match(/^\/api\/prompts\/([^/]+)$/);
  if (promptMatch) {
    const id = promptMatch[1];
    if (method === "GET") return getPromptTemplate(env, id);
    if (method === "PUT") return updatePromptTemplate(request, env, id);
    if (method === "DELETE") return deletePromptTemplate(env, id);
  }

  // ── Providers ───────────────────────────────────────────

  // Task lanes
  if (path === "/api/providers/lanes" && method === "GET") {
    return listTaskLanes(env);
  }

  const laneMatch = path.match(/^\/api\/providers\/lanes\/([^/]+)$/);
  if (laneMatch && method === "GET") {
    return getTaskLane(env, laneMatch[1]);
  }

  // Resolve best provider for a lane (mock)
  const resolveMatch = path.match(/^\/api\/providers\/resolve\/([^/]+)$/);
  if (resolveMatch && method === "GET") {
    return resolveTaskLane(env, resolveMatch[1]);
  }

  // Execute provider chain: POST /api/providers/execute
  if (path === "/api/providers/execute" && method === "POST") {
    return executeProviderChain(request, env);
  }

  // Provider CRUD
  if (path === "/api/providers" && method === "GET") {
    return listProviders(request, env);
  }
  if (path === "/api/providers" && method === "POST") {
    return createProvider(request, env);
  }

  // Provider action routes (must be matched before :id)
  const providerSleepMatch = path.match(/^\/api\/providers\/([^/]+)\/sleep$/);
  if (providerSleepMatch && method === "POST") {
    return sleepProvider(env, providerSleepMatch[1]);
  }

  const providerWakeMatch = path.match(/^\/api\/providers\/([^/]+)\/wake$/);
  if (providerWakeMatch && method === "POST") {
    return wakeProvider(env, providerWakeMatch[1]);
  }

  const providerCooldownMatch = path.match(/^\/api\/providers\/([^/]+)\/cooldown$/);
  if (providerCooldownMatch && method === "POST") {
    return cooldownProvider(request, env, providerCooldownMatch[1]);
  }

  const providerErrorMatch = path.match(/^\/api\/providers\/([^/]+)\/report-error$/);
  if (providerErrorMatch && method === "POST") {
    return reportProviderError(request, env, providerErrorMatch[1]);
  }

  const providerRateLimitMatch = path.match(/^\/api\/providers\/([^/]+)\/report-rate-limit$/);
  if (providerRateLimitMatch && method === "POST") {
    return reportProviderRateLimit(request, env, providerRateLimitMatch[1]);
  }

  const providerMatch = path.match(/^\/api\/providers\/([^/]+)$/);
  if (providerMatch) {
    const id = providerMatch[1];
    if (method === "GET") return getProvider(env, id);
    if (method === "PUT") return updateProvider(request, env, id);
    if (method === "DELETE") return deleteProvider(env, id);
  }

  // ── Products ────────────────────────────────────────────
  if (path === "/api/products" && method === "GET") {
    return listProducts(request, env);
  }
  if (path === "/api/products" && method === "POST") {
    return createProduct(request, env);
  }

  // Product variants: /api/products/:id/variants
  const productVariantsMatch = path.match(/^\/api\/products\/([^/]+)\/variants$/);
  if (productVariantsMatch) {
    const productId = productVariantsMatch[1];
    if (method === "GET") return listProductVariants(env, productId);
    if (method === "POST") return createProductVariant(request, env, productId);
  }

  // Product workflow runs: /api/products/:id/workflows
  const productWorkflowsMatch = path.match(/^\/api\/products\/([^/]+)\/workflows$/);
  if (productWorkflowsMatch) {
    const productId = productWorkflowsMatch[1];
    if (method === "GET") return listProductWorkflowRuns(env, productId);
    if (method === "POST") return startWorkflowRun(request, env, productId);
  }

  // Product reviews: /api/products/:id/reviews
  const productReviewsMatch = path.match(/^\/api\/products\/([^/]+)\/reviews$/);
  if (productReviewsMatch) {
    const productId = productReviewsMatch[1];
    if (method === "GET") return listProductReviews(env, productId);
    if (method === "POST") return createReview(request, env, productId);
  }

  // Product revisions: /api/products/:id/revisions
  const productRevisionsMatch = path.match(/^\/api\/products\/([^/]+)\/revisions$/);
  if (productRevisionsMatch && method === "GET") {
    return listProductRevisions(env, productRevisionsMatch[1]);
  }

  // Product version history: /api/products/:id/version-history
  const productVersionHistoryMatch = path.match(/^\/api\/products\/([^/]+)\/version-history$/);
  if (productVersionHistoryMatch && method === "GET") {
    return getProductVersionHistory(env, productVersionHistoryMatch[1]);
  }

  const productMatch = path.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch) {
    const id = productMatch[1];
    if (method === "GET") return getProduct(env, id);
    if (method === "PUT") return updateProduct(request, env, id);
    if (method === "DELETE") return deleteProduct(env, id);
  }

  // ── Variants (standalone) ──────────────────────────────
  const variantMatch = path.match(/^\/api\/variants\/([^/]+)$/);
  if (variantMatch) {
    const id = variantMatch[1];
    if (method === "PUT") return updateVariant(request, env, id);
    if (method === "DELETE") return deleteVariant(env, id);
  }

  // ── Workflow Runs ──────────────────────────────────────
  if (path === "/api/workflows" && method === "GET") {
    return listWorkflowRuns(request, env);
  }

  // Workflow step actions: /api/workflows/:runId/steps/:stepId/complete
  const stepCompleteMatch = path.match(/^\/api\/workflows\/([^/]+)\/steps\/([^/]+)\/complete$/);
  if (stepCompleteMatch && method === "POST") {
    return completeWorkflowStep(request, env, stepCompleteMatch[1], stepCompleteMatch[2]);
  }

  const stepFailMatch = path.match(/^\/api\/workflows\/([^/]+)\/steps\/([^/]+)\/fail$/);
  if (stepFailMatch && method === "POST") {
    return failWorkflowStep(request, env, stepFailMatch[1], stepFailMatch[2]);
  }

  const workflowRunMatch = path.match(/^\/api\/workflows\/([^/]+)$/);
  if (workflowRunMatch && method === "GET") {
    return getWorkflowRun(env, workflowRunMatch[1]);
  }

  // ── Reviews ────────────────────────────────────────────
  if (path === "/api/reviews" && method === "GET") {
    return listPendingReviews(request, env);
  }

  const reviewApproveMatch = path.match(/^\/api\/reviews\/([^/]+)\/approve$/);
  if (reviewApproveMatch && method === "POST") {
    return approveReview(request, env, reviewApproveMatch[1]);
  }

  const reviewRejectMatch = path.match(/^\/api\/reviews\/([^/]+)\/reject$/);
  if (reviewRejectMatch && method === "POST") {
    return rejectReview(request, env, reviewRejectMatch[1]);
  }

  const reviewRevisionMatch = path.match(/^\/api\/reviews\/([^/]+)\/revision$/);
  if (reviewRevisionMatch && method === "POST") {
    return requestRevision(request, env, reviewRevisionMatch[1]);
  }

  // Review comments: /api/reviews/:id/comments
  const reviewCommentsMatch = path.match(/^\/api\/reviews\/([^/]+)\/comments$/);
  if (reviewCommentsMatch) {
    const reviewId = reviewCommentsMatch[1];
    if (method === "GET") return listReviewComments(env, reviewId);
    if (method === "POST") return addReviewComment(request, env, reviewId);
  }

  // Single review: /api/reviews/:id (must come after action routes)
  const reviewDetailMatch = path.match(/^\/api\/reviews\/([^/]+)$/);
  if (reviewDetailMatch && method === "GET") {
    return getReview(env, reviewDetailMatch[1]);
  }

  // ── Assets ──────────────────────────────────────────────
  if (path === "/api/assets" && method === "GET") {
    return listAssets(request, env);
  }
  if (path === "/api/assets" && method === "POST") {
    return uploadAsset(request, env);
  }

  const assetMatch = path.match(/^\/api\/assets\/([^/]+)$/);
  if (assetMatch) {
    const id = assetMatch[1];
    if (method === "GET") return getAsset(env, id);
    if (method === "DELETE") return deleteAsset(env, id);
  }

  // Product assets: /api/products/:id/assets
  const productAssetsMatch = path.match(/^\/api\/products\/([^/]+)\/assets$/);
  if (productAssetsMatch && method === "GET") {
    return listProductAssets(env, productAssetsMatch[1]);
  }

  return notFound(`API route not found: ${method} ${path}`);
}
