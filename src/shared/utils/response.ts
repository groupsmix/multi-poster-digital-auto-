/**
 * Tiny helpers for building consistent JSON responses.
 */

export function json<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function notFound(message = "Not found"): Response {
  return json({ error: message }, 404);
}

export function badRequest(message = "Bad request"): Response {
  return json({ error: message }, 400);
}

export function serverError(message = "Internal server error"): Response {
  return json({ error: message }, 500);
}
