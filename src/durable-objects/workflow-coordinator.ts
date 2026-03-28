import { Env } from "../shared/types";

/**
 * WorkflowCoordinator — Durable Object placeholder.
 *
 * Will be used for:
 * - provider cooldown state management
 * - single-flight workflow coordination
 * - preventing duplicate job execution
 * - approval session locking
 *
 * No business logic yet — just the class shell so bindings work.
 */
export class WorkflowCoordinator implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/status") {
      return new Response(
        JSON.stringify({
          id: this.state.id.toString(),
          status: "idle",
          message: "WorkflowCoordinator placeholder — no active workflows.",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response("WorkflowCoordinator ready", { status: 200 });
  }
}
