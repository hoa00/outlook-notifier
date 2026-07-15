import { createMiddleware } from "hono/factory";
import type { AppBindings } from "../env";
import { createSessionService } from "../session/service";

export const sessionMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const validated = c.get("validatedEnv");
  // Health and other routes may skip env validation; leave session unset.
  if (!validated) {
    c.set("sessionId", null);
    c.set("userId", null);
    c.set("csrfToken", null);
    await next();
    return;
  }
  const service = createSessionService(c.env.DB, validated.SESSION_SECRET);
  const resolved = await service.resolve(c.req.header("Cookie"));
  c.set("sessionId", resolved?.sessionId ?? null);
  c.set("userId", resolved?.userId ?? null);
  c.set("csrfToken", resolved?.csrfToken ?? null);
  await next();
});
