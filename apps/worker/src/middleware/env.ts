import { createMiddleware } from "hono/factory";
import type { AppBindings } from "../env";
import { validateBindings } from "../env";
import { AppError } from "../errors/app-error";
import { ErrorCode } from "../errors/codes";
import { EnvValidationError } from "../schemas/env";

/** Liveness routes skip secret/env validation. */
const SKIP_ENV_PATHS = new Set(["/health"]);

export const envMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (SKIP_ENV_PATHS.has(path)) {
    await next();
    return;
  }

  try {
    const validated = validateBindings(c.env);
    c.set("validatedEnv", validated);
  } catch (err) {
    if (err instanceof EnvValidationError) {
      throw new AppError(ErrorCode.ENV_VALIDATION_FAILED, err.message);
    }
    throw err;
  }
  await next();
});
