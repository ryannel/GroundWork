// @vitest-environment node
import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/healthz", () => {
  it("returns 200 with a healthy status and timestamp", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(typeof body.timestamp).toBe("string");
    // timestamp must be a valid ISO date.
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});
