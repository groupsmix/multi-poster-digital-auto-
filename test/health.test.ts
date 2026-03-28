import { describe, it, expect } from "vitest";
import { APP } from "../src/config";

/**
 * Unit tests for the base skeleton.
 * These validate types and config without needing a running Worker.
 */

describe("config/constants", () => {
  it("exports correct app metadata", () => {
    expect(APP.NAME).toBe("NEXUS");
    expect(APP.VERSION).toBe("0.1.0");
    expect(APP.DESCRIPTION).toBeDefined();
  });
});

describe("shared/utils/response", () => {
  it("json() returns a Response with correct status and content-type", async () => {
    const { json } = await import("../src/shared/utils/response");
    const res = json({ ok: true }, 201);
    expect(res.status).toBe(201);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("notFound() returns 404", async () => {
    const { notFound } = await import("../src/shared/utils/response");
    const res = notFound("gone");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "gone" });
  });

  it("badRequest() returns 400", async () => {
    const { badRequest } = await import("../src/shared/utils/response");
    const res = badRequest();
    expect(res.status).toBe(400);
  });

  it("serverError() returns 500", async () => {
    const { serverError } = await import("../src/shared/utils/response");
    const res = serverError();
    expect(res.status).toBe(500);
  });
});

describe("shared/types", () => {
  it("status types are importable", async () => {
    // This test validates that the type module compiles and exports exist
    const mod = await import("../src/shared/types/status");
    expect(mod).toBeDefined();
  });
});
