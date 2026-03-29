import { Env } from "../shared/types";

/**
 * WorkflowCoordinator — Durable Object for workflow orchestration.
 *
 * Responsibilities:
 * - Single-flight workflow coordination (prevent duplicate runs per product)
 * - Track active workflow state in durable storage
 * - Coordinate step progression
 * - Integrate with ProviderRouter DO for provider resolution
 * - Manage approval session locking
 */

interface ActiveRun {
  run_id: string;
  product_id: string;
  status: string;
  current_step: string | null;
  started_at: string;
}

export class WorkflowCoordinator implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private activeRuns: Map<string, ActiveRun>;
  private initialized: boolean;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.activeRuns = new Map();
    this.initialized = false;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    const stored =
      await this.state.storage.get<Array<[string, ActiveRun]>>("activeRuns");
    if (stored) {
      this.activeRuns = new Map(stored);
    }
    this.initialized = true;
  }

  private async persist(): Promise<void> {
    await this.state.storage.put(
      "activeRuns",
      Array.from(this.activeRuns.entries()),
    );
  }

  async fetch(request: Request): Promise<Response> {
    await this.initialize();

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // ── GET /status — overall coordinator status ───────────
    if (path === "/status" && method === "GET") {
      return this.handleStatus();
    }

    // ── POST /start — register a new workflow run ──────────
    if (path === "/start" && method === "POST") {
      return this.handleStart(request);
    }

    // ── POST /complete-step — mark a step completed ────────
    if (path === "/complete-step" && method === "POST") {
      return this.handleCompleteStep(request);
    }

    // ── POST /fail-step — mark a step failed ───────────────
    if (path === "/fail-step" && method === "POST") {
      return this.handleFailStep(request);
    }

    // ── POST /finish — mark run as finished ────────────────
    if (path === "/finish" && method === "POST") {
      return this.handleFinish(request);
    }

    // ── GET /can-start/:productId — check if product can start
    const canStartMatch = path.match(/^\/can-start\/([^/]+)$/);
    if (canStartMatch && method === "GET") {
      return this.handleCanStart(canStartMatch[1]);
    }

    // ── POST /resolve-provider — resolve provider for a step
    if (path === "/resolve-provider" && method === "POST") {
      return this.handleResolveProvider(request);
    }

    return new Response("WorkflowCoordinator: unknown route", { status: 404 });
  }

  // ── Status ──────────────────────────────────────────────

  private handleStatus(): Response {
    const runs: Record<string, unknown> = {};
    for (const [productId, run] of this.activeRuns) {
      runs[productId] = run;
    }

    return this.jsonResponse({
      id: this.state.id.toString(),
      active_runs: this.activeRuns.size,
      runs,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Start — register a new run ──────────────────────────

  private async handleStart(request: Request): Promise<Response> {
    const body = await this.parseBody(request);
    if (!body || !body.product_id || !body.run_id) {
      return this.jsonResponse(
        { error: "product_id and run_id are required" },
        400,
      );
    }

    const productId = body.product_id as string;
    const runId = body.run_id as string;

    // Check for duplicate active run
    const existing = this.activeRuns.get(productId);
    if (existing && existing.status === "running") {
      return this.jsonResponse(
        {
          error: `Product ${productId} already has an active run: ${existing.run_id}`,
          existing_run: existing,
        },
        409,
      );
    }

    // Check concurrency limit
    const maxConcurrent = 5; // from DEFAULTS.MAX_CONCURRENT_RUNS
    const runningCount = Array.from(this.activeRuns.values()).filter(
      (r) => r.status === "running",
    ).length;

    if (runningCount >= maxConcurrent) {
      return this.jsonResponse(
        {
          error: `Max concurrent runs reached (${maxConcurrent}). Please wait for a run to finish.`,
          running_count: runningCount,
        },
        429,
      );
    }

    const run: ActiveRun = {
      run_id: runId,
      product_id: productId,
      status: "running",
      current_step: (body.first_step as string) || null,
      started_at: new Date().toISOString(),
    };

    this.activeRuns.set(productId, run);
    await this.persist();

    return this.jsonResponse({
      message: `Run ${runId} registered for product ${productId}.`,
      run,
    });
  }

  // ── Complete Step ───────────────────────────────────────

  private async handleCompleteStep(request: Request): Promise<Response> {
    const body = await this.parseBody(request);
    if (!body || !body.product_id || !body.step_name) {
      return this.jsonResponse(
        { error: "product_id and step_name are required" },
        400,
      );
    }

    const productId = body.product_id as string;
    const run = this.activeRuns.get(productId);

    if (!run) {
      return this.jsonResponse(
        { error: `No active run found for product ${productId}` },
        404,
      );
    }

    run.current_step = (body.next_step as string) || null;
    this.activeRuns.set(productId, run);
    await this.persist();

    return this.jsonResponse({
      message: `Step '${body.step_name}' completed. Next: ${run.current_step || "none (workflow may be done)"}`,
      run,
    });
  }

  // ── Fail Step ──────────────────────────────────────────

  private async handleFailStep(request: Request): Promise<Response> {
    const body = await this.parseBody(request);
    if (!body || !body.product_id) {
      return this.jsonResponse(
        { error: "product_id is required" },
        400,
      );
    }

    const productId = body.product_id as string;
    const run = this.activeRuns.get(productId);

    if (!run) {
      return this.jsonResponse(
        { error: `No active run found for product ${productId}` },
        404,
      );
    }

    const finalStatus = (body.run_status as string) || "failed";
    run.status = finalStatus;
    run.current_step = null;
    this.activeRuns.set(productId, run);
    await this.persist();

    return this.jsonResponse({
      message: `Run for product ${productId} marked as ${finalStatus}.`,
      run,
    });
  }

  // ── Finish — mark run completed and remove from active ──

  private async handleFinish(request: Request): Promise<Response> {
    const body = await this.parseBody(request);
    if (!body || !body.product_id) {
      return this.jsonResponse(
        { error: "product_id is required" },
        400,
      );
    }

    const productId = body.product_id as string;
    const run = this.activeRuns.get(productId);

    if (!run) {
      return this.jsonResponse(
        { error: `No active run found for product ${productId}` },
        404,
      );
    }

    run.status = "completed";
    run.current_step = null;

    // Keep completed runs in map for reference but mark as done
    this.activeRuns.set(productId, run);
    await this.persist();

    return this.jsonResponse({
      message: `Run ${run.run_id} for product ${productId} completed.`,
      run,
    });
  }

  // ── Can Start — check if product can start a new run ────

  private handleCanStart(productId: string): Response {
    const existing = this.activeRuns.get(productId);

    if (existing && existing.status === "running") {
      return this.jsonResponse({
        can_start: false,
        reason: `Product already has an active run: ${existing.run_id}`,
        existing_run: existing,
      });
    }

    const runningCount = Array.from(this.activeRuns.values()).filter(
      (r) => r.status === "running",
    ).length;
    const maxConcurrent = 5;

    if (runningCount >= maxConcurrent) {
      return this.jsonResponse({
        can_start: false,
        reason: `Max concurrent runs reached (${maxConcurrent}).`,
        running_count: runningCount,
      });
    }

    return this.jsonResponse({ can_start: true });
  }

  // ── Resolve Provider — delegate to ProviderRouter DO ────

  private async handleResolveProvider(request: Request): Promise<Response> {
    const body = await this.parseBody(request);
    if (!body || !body.task_lane) {
      return this.jsonResponse(
        { error: "task_lane is required" },
        400,
      );
    }

    const lane = body.task_lane as string;

    try {
      const routerId = this.env.PROVIDER_ROUTER.idFromName("global");
      const routerStub = this.env.PROVIDER_ROUTER.get(routerId);

      const resolveResponse = await routerStub.fetch(
        new Request(`https://provider-router/resolve/${lane}`),
      );

      const result = await resolveResponse.json();
      return this.jsonResponse(result, resolveResponse.status);
    } catch (err) {
      console.error("[WorkflowCoordinator/resolve-provider]", err);
      return this.jsonResponse(
        { error: "Failed to resolve provider from ProviderRouter." },
        500,
      );
    }
  }

  // ── Internal helpers ────────────────────────────────────

  private async parseBody(
    request: Request,
  ): Promise<Record<string, unknown> | null> {
    try {
      const text = await request.text();
      if (!text) return null;
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
