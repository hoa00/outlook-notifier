import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppBindings } from "../src/env";
import { correlationMiddleware } from "../src/middleware/correlation";
import { envMiddleware } from "../src/middleware/env";
import { sessionMiddleware } from "../src/middleware/session";
import { csrfMiddleware } from "../src/middleware/csrf";
import { errorHandler } from "../src/middleware/error-handler";
import { applyInitialMigration } from "./helpers/apply-migrations";
import { UsersRepository } from "../src/repositories/users";
import { createSessionService } from "../src/session/service";
import { syntheticUser } from "./fixtures/synthetic";

function buildApp() {
  const app = new Hono<AppBindings>();
  app.onError(errorHandler);
  app.use("*", correlationMiddleware);
  app.use("*", envMiddleware);
  app.use("*", sessionMiddleware);
  app.use("*", csrfMiddleware);
  app.post("/api/settings", (c) => c.json({ ok: true }));
  return app;
}

describe("CSRF middleware", () => {
  it("rejects authenticated mutation without matching CSRF token", async () => {
    await applyInitialMigration(env.DB);
    const users = new UsersRepository(env.DB);
    await users.create({ ...syntheticUser, id: "user-csrf-fail" });
    const sessions = createSessionService(env.DB, env.SESSION_SECRET);
    const created = await sessions.create("user-csrf-fail", false);
    const app = buildApp();

    const res = await app.request(
      "/api/settings",
      {
        method: "POST",
        headers: {
          Cookie: created.setCookies.map((c) => c.split(";")[0]).join("; "),
        },
      },
      env,
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("CSRF_FAILED");
  });

  it("allows authenticated mutation with matching CSRF header and cookie", async () => {
    await applyInitialMigration(env.DB);
    const users = new UsersRepository(env.DB);
    await users.create({ ...syntheticUser, id: "user-csrf-ok" });
    const sessions = createSessionService(env.DB, env.SESSION_SECRET);
    const created = await sessions.create("user-csrf-ok", false);
    const cookieHeader = created.setCookies.map((c) => c.split(";")[0]).join("; ");
    const app = buildApp();

    const res = await app.request(
      "/api/settings",
      {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
          "X-CSRF-Token": created.csrfToken,
        },
      },
      env,
    );
    expect(res.status).toBe(200);
  });
});
