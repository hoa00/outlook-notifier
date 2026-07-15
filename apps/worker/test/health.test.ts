import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

describe("GET /health", () => {
  it("returns ok without upstream dependencies", async () => {
    const app = createApp();
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      service: string;
      correlationId: string;
    };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("outlook-notifier-worker");
    expect(body.correlationId).toMatch(/^[a-f0-9]+$/i);
    expect(res.headers.get("x-correlation-id")).toBe(body.correlationId);
  });

  it("propagates a valid incoming correlation id", async () => {
    const app = createApp();
    const res = await app.request(
      "/health",
      { headers: { "x-correlation-id": "abc12345" } },
      env,
    );
    expect(res.headers.get("x-correlation-id")).toBe("abc12345");
  });

  it("stays up when secrets are missing (liveness, no env gate)", async () => {
    const app = createApp();
    const stripped = { ...env, MICROSOFT_CLIENT_SECRET: "", SESSION_SECRET: "" };
    const res = await app.request("/health", {}, stripped);
    expect(res.status).toBe(200);
  });
});

