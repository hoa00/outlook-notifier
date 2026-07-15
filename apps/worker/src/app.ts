import { Hono } from "hono";
import type { AppBindings } from "./env";
import { correlationMiddleware } from "./middleware/correlation";
import { envMiddleware } from "./middleware/env";
import { sessionMiddleware } from "./middleware/session";
import { csrfMiddleware } from "./middleware/csrf";
import { errorHandler } from "./middleware/error-handler";
import { healthRoutes } from "./routes/health";

export function createApp() {
  const app = new Hono<AppBindings>();

  app.onError(errorHandler);
  app.use("*", correlationMiddleware);
  app.use("*", envMiddleware);
  app.use("*", sessionMiddleware);
  app.use("*", csrfMiddleware);

  app.route("/", healthRoutes);

  app.notFound((c) => {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "NOT_FOUND",
          correlationId: c.get("correlationId"),
        },
      },
      404,
    );
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
