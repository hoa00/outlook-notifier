import { Hono } from "hono";
import type { AppBindings } from "../env";

export const healthRoutes = new Hono<AppBindings>();

healthRoutes.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "outlook-notifier-worker",
    correlationId: c.get("correlationId"),
  });
});
