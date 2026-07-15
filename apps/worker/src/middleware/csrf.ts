import { createMiddleware } from "hono/factory";
import type { AppBindings } from "../env";
import { AppError } from "../errors/app-error";
import { ErrorCode } from "../errors/codes";
import { CSRF_COOKIE, parseCookieHeader } from "../session/cookie";
import { timingSafeEqualString } from "../session/crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Double-submit cookie CSRF for future authenticated mutations under /api/*.
 * Requires matching X-CSRF-Token header and csrf cookie when session is present.
 */
export const csrfMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) {
    await next();
    return;
  }

  const path = new URL(c.req.url).pathname;
  if (!path.startsWith("/api/")) {
    await next();
    return;
  }

  const userId = c.get("userId");
  if (!userId) {
    await next();
    return;
  }

  const headerToken = c.req.header("X-CSRF-Token");
  const cookies = parseCookieHeader(c.req.header("Cookie"));
  const cookieToken = cookies[CSRF_COOKIE];

  if (
    !headerToken ||
    !cookieToken ||
    !timingSafeEqualString(headerToken, cookieToken)
  ) {
    throw new AppError(ErrorCode.CSRF_FAILED, "CSRF validation failed");
  }

  await next();
});
