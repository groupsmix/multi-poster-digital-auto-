import { describe, it, expect } from "vitest";

describe("shared/utils/slug", () => {
  it("converts name to lowercase hyphenated slug", async () => {
    const { toSlug } = await import("../src/shared/utils/slug");
    expect(toSlug("Digital Products")).toBe("digital-products");
  });

  it("strips special characters", async () => {
    const { toSlug } = await import("../src/shared/utils/slug");
    expect(toSlug("E-Commerce & Retail")).toBe("e-commerce-retail");
    expect(toSlug("Print-on-Demand (POD)")).toBe("print-on-demand-pod");
  });

  it("collapses consecutive hyphens", async () => {
    const { toSlug } = await import("../src/shared/utils/slug");
    expect(toSlug("foo---bar")).toBe("foo-bar");
  });

  it("trims leading/trailing hyphens", async () => {
    const { toSlug } = await import("../src/shared/utils/slug");
    expect(toSlug("--hello--")).toBe("hello");
  });

  it("handles underscores as hyphens", async () => {
    const { toSlug } = await import("../src/shared/utils/slug");
    expect(toSlug("search_research")).toBe("search-research");
  });

  it("returns empty string for empty input", async () => {
    const { toSlug } = await import("../src/shared/utils/slug");
    expect(toSlug("")).toBe("");
  });
});

describe("shared/utils/id", () => {
  it("generates an id with the given prefix", async () => {
    const { generateId } = await import("../src/shared/utils/id");
    const id = generateId("dom_");
    expect(id).toMatch(/^dom_[a-f0-9]{16}$/);
  });

  it("generates unique ids", async () => {
    const { generateId } = await import("../src/shared/utils/id");
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it("works without prefix", async () => {
    const { generateId } = await import("../src/shared/utils/id");
    const id = generateId();
    expect(id).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe("shared/utils/validate", () => {
  it("returns errors for missing required fields", async () => {
    const { validateFields } = await import("../src/shared/utils/validate");
    const errors = validateFields(
      {},
      [{ field: "name", required: true, type: "string" }],
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("name");
    expect(errors[0]).toContain("required");
  });

  it("returns errors for wrong type", async () => {
    const { validateFields } = await import("../src/shared/utils/validate");
    const errors = validateFields(
      { name: 123 },
      [{ field: "name", type: "string" }],
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("string");
  });

  it("returns errors for maxLength violation", async () => {
    const { validateFields } = await import("../src/shared/utils/validate");
    const errors = validateFields(
      { name: "a".repeat(300) },
      [{ field: "name", type: "string", maxLength: 200 }],
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("200");
  });

  it("returns no errors for valid input", async () => {
    const { validateFields } = await import("../src/shared/utils/validate");
    const errors = validateFields(
      { name: "Valid Name", count: 5 },
      [
        { field: "name", required: true, type: "string", maxLength: 200 },
        { field: "count", type: "number" },
      ],
    );
    expect(errors).toHaveLength(0);
  });

  it("skips optional missing fields", async () => {
    const { validateFields } = await import("../src/shared/utils/validate");
    const errors = validateFields(
      {},
      [{ field: "icon", type: "string" }],
    );
    expect(errors).toHaveLength(0);
  });

  it("parseJsonBody returns null for invalid JSON", async () => {
    const { parseJsonBody } = await import("../src/shared/utils/validate");
    const req = new Request("http://localhost", {
      method: "POST",
      body: "not json",
    });
    const result = await parseJsonBody(req);
    expect(result).toBeNull();
  });

  it("parseJsonBody parses valid JSON", async () => {
    const { parseJsonBody } = await import("../src/shared/utils/validate");
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });
    const result = await parseJsonBody(req);
    expect(result).toEqual({ name: "test" });
  });

  it("parseJsonBody returns null for empty body", async () => {
    const { parseJsonBody } = await import("../src/shared/utils/validate");
    const req = new Request("http://localhost", {
      method: "POST",
      body: "",
    });
    const result = await parseJsonBody(req);
    expect(result).toBeNull();
  });
});
